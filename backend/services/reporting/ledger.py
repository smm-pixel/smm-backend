"""Reporting calculations: ledger"""
from services.reporting.context import *
from services.reporting.accounting_core import _get_accounts_map, _group_from_unit

async def _ledger_data(account_code: str, start_date: Optional[str], end_date: Optional[str], unit_usaha_id: Optional[str] = None):
    """Buku Besar per akun: daftar transaksi + saldo berjalan."""
    grp = await _group_from_unit(unit_usaha_id)
    acc = await db.accounts.select_one({"code": account_code, "group": grp}, None)
    if not acc:
        raise HTTPException(status_code=404, detail=f"Kode akun {account_code} tidak ditemukan di kelompok {grp}")

    base_or = {"any_of": [{"debit_account_code": account_code}, {"credit_account_code": account_code}]}
    q: dict = dict(base_or)
    if grp == "BUMDES":
        q["unit_usaha_id"] = None
    else:
        q["unit_usaha_id"] = unit_usaha_id
    if start_date or end_date:
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        q["date"] = date_filter

    saldo_awal = 0.0
    if start_date:
        prev_q = {
            "$or": [{"debit_account_code": account_code}, {"credit_account_code": account_code}],
            "date": {"below": start_date},
        }
        if grp == "BUMDES":
            prev_q["unit_usaha_id"] = None
        else:
            prev_q["unit_usaha_id"] = unit_usaha_id
        prev_txs = await db.transactions.select(prev_q, None).all(20000)
        for tx in prev_txs:
            amount = to_amount(tx.get("amount"))
            d = amount if tx["debit_account_code"] == account_code else 0
            k = amount if tx["credit_account_code"] == account_code else 0
            if acc["normal_balance"] == "debit":
                saldo_awal += d - k
            else:
                saldo_awal += k - d

    txs = await db.transactions.select(q, None).order("date", 1).all(20000)

    running = saldo_awal
    entries = []
    accounts_map = await _get_accounts_map(grp)
    for tx in txs:
        amount = to_amount(tx.get("amount"))
        d = amount if tx["debit_account_code"] == account_code else 0
        k = amount if tx["credit_account_code"] == account_code else 0
        other = tx["credit_account_code"] if tx["debit_account_code"] == account_code else tx["debit_account_code"]
        if acc["normal_balance"] == "debit":
            running += d - k
        else:
            running += k - d
        entries.append({
            "id": tx.get("id"),
            "date": tx.get("date"),
            "description": tx.get("description"),
            "reference": tx.get("reference"),
            "debit": d, "credit": k,
            "balance": round(running, 2),
            "other_account_code": other,
            "other_account_name": accounts_map.get(other, {}).get("name", other),
            "unit_usaha_id": tx.get("unit_usaha_id"),
        })

    return {
        "account": acc,
        "saldo_awal": saldo_awal,
        "entries": entries,
        "saldo_akhir": running,
        "total_debit": sum(e["debit"] for e in entries),
        "total_credit": sum(e["credit"] for e in entries),
        "period": {"start": start_date, "end": end_date},
    }
