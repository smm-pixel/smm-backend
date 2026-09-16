"""Reporting calculations: unit reports"""
from services.reporting.context import *

async def _per_unit_report(start_date: str, end_date: str):
    q = {"date": {"$gte": start_date, "$lte": end_date}}
    txs = await db.transactions.select(q, None).all(20000)
    # Accounts per group (BUMDES + each unit) — needed to correctly categorize by unit
    all_docs = await db.accounts.select({}, None).all(500)
    acc_by_group: dict = {}
    for d in all_docs:
        acc_by_group.setdefault(d.get("group", "BUMDES"), {})[d["code"]] = d
    accounts_bumdes = acc_by_group.get("BUMDES", {})
    units = await db.unit_usaha.select({}, None).all(50)
    unit_group_map = {u["id"]: u["code"] for u in units}

    # ==== BUMDES section (choice 3b: include closing entries so realisasi tahun berjalan tetap tampil) ====
    p_bumdes = 0.0
    b_bumdes = 0.0
    for tx in txs:
        if tx.get("unit_usaha_id"):
            continue  # skip unit txs
        # closing entries: DR pendapatan / CR beban → skip supaya laba operasional utuh
        if tx.get("is_closing"):
            continue
        d_acc = accounts_bumdes.get(tx["debit_account_code"], {})
        c_acc = accounts_bumdes.get(tx["credit_account_code"], {})
        amt = to_amount(tx.get("amount"))
        if c_acc.get("category") == "pendapatan":
            p_bumdes += amt
        if d_acc.get("category") == "beban":
            b_bumdes += amt
    laba_bumdes = p_bumdes - b_bumdes
    # 82% distribution (only when laba positif)
    def _pct(p): return round(laba_bumdes * p / 100, 2) if laba_bumdes > 0 else 0
    bumdes = {
        "code": "BUMDES", "name": "BUMDES Karya Raharja",
        "pendapatan": p_bumdes, "beban": b_bumdes, "laba_bersih": laba_bumdes,
        "share_modal_18": _pct(18),
        "share_pades_30": _pct(30),
        "share_penasihat_7": _pct(7),
        "share_pengawas_5": _pct(5),
        "share_pengurus_35": _pct(35),
        "share_dana_sosial_5": _pct(5),
    }

    # ==== Per-unit section ====
    result = []
    for u in units:
        grp = unit_group_map.get(u["id"]) or "BUMDES"
        acc_map = acc_by_group.get(grp, {})
        pendapatan = 0.0
        beban = 0.0
        for tx in txs:
            if tx.get("unit_usaha_id") != u["id"]:
                continue
            if tx.get("is_closing"):
                continue
            d_acc = acc_map.get(tx["debit_account_code"], {})
            c_acc = acc_map.get(tx["credit_account_code"], {})
            amount = to_amount(tx.get("amount"))
            if c_acc.get("category") == "pendapatan":
                pendapatan += amount
            if d_acc.get("category") == "beban":
                beban += amount
        laba = pendapatan - beban
        result.append({
            "id": u["id"], "code": u["code"], "name": u["name"],
            "pendapatan": pendapatan, "beban": beban, "laba_bersih": laba,
            "share_pengelola_30": round(laba * 0.30, 2) if laba > 0 else 0,
            "share_bumdes_70": round(laba * 0.70, 2) if laba > 0 else 0,
        })
    result.sort(key=lambda x: x.get("code") or "")
    return {"period": {"start": start_date, "end": end_date}, "bumdes": bumdes, "units": result}
