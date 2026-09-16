"""Reporting calculations: statements"""
from services.reporting.context import *
from services.reporting.accounting_core import _calc_balances, _calc_balances_before, _get_accounts_map, _group_from_unit

async def _laba_rugi(start_date: str, end_date: str, unit_usaha_id: Optional[str] = None,
                     include_closing: bool = True):
    """Laba Rugi. include_closing=True (default) → periode yang sudah tutup buku
    otomatis TIDAK muncul (baik tx operasional maupun jurnal penutupnya di-skip).
    include_closing=False → operational only (dipakai Perubahan Ekuitas untuk
    menampilkan laba periode yang bermigrasi ke Saldo Laba).
    """
    from services.reporting.accounting_core import _get_accounts_map, _group_from_unit
    q: dict = {"date": {"$gte": start_date, "$lte": end_date}, "unit_usaha_id": unit_usaha_id}
    if not include_closing:
        q["is_closing"] = {"$ne": True}
    txs = await db.transactions.select(q, None).all(20000)
    grp = await _group_from_unit(unit_usaha_id)
    accounts = await _get_accounts_map(grp)
    # Kalau include_closing (mode default report Laba Rugi), skip SEMUA tx (operasional
    # + jurnal penutup) yang jatuh di bulan yang sudah closed. Efeknya: berapa pun
    # rentang tanggal yang dipilih user, laba rugi untuk periode ditutup tetap 0.
    if include_closing:
        closed_docs = await db.closed_periods.select(
            {"group": grp}, {"_id": 0, "period": 1}
        ).all(500)
        closed_periods = {c["period"] for c in closed_docs}
        if closed_periods:
            txs = [tx for tx in txs if (tx.get("date") or "")[:7] not in closed_periods]
    bal: dict = {}
    for tx in txs:
        amt = to_amount(tx.get("amount"))
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        bal.setdefault(d, {"debit": 0, "credit": 0})
        bal.setdefault(c, {"debit": 0, "credit": 0})
        bal[d]["debit"] += amt
        bal[c]["credit"] += amt
    for code, v in bal.items():
        acc = accounts.get(code)
        if acc and acc["normal_balance"] == "debit":
            v["saldo"] = v["debit"] - v["credit"]
        elif acc:
            v["saldo"] = v["credit"] - v["debit"]
    pendapatan_items, beban_items = [], []
    total_p = 0.0
    total_b = 0.0
    for code, acc in sorted(accounts.items()):
        b = bal.get(code)
        if not b:
            continue
        saldo = b.get("saldo", 0)
        if acc["category"] == "pendapatan" and saldo != 0:
            pendapatan_items.append({"code": code, "name": acc["name"], "amount": saldo})
            total_p += saldo
        if acc["category"] == "beban" and saldo != 0:
            beban_items.append({"code": code, "name": acc["name"], "amount": saldo})
            total_b += saldo
    return {
        "pendapatan": pendapatan_items,
        "beban": beban_items,
        "total_pendapatan": total_p,
        "total_beban": total_b,
        "laba_bersih": total_p - total_b,
    }

async def _neraca(as_of_date: str, unit_usaha_id: Optional[str] = None):
    bal, accounts = await _calc_balances(None, as_of_date, unit_usaha_id)
    aset, kewajiban, ekuitas = [], [], []
    tot_a, tot_k, tot_e = 0.0, 0.0, 0.0
    for code, acc in sorted(accounts.items()):
        b = bal.get(code)
        if not b:
            continue
        saldo = b.get("saldo", 0)
        if acc["category"] == "aset" and saldo != 0:
            aset.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_a += saldo
        if acc["category"] == "kewajiban" and saldo != 0:
            kewajiban.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_k += saldo
        if acc["category"] == "ekuitas" and saldo != 0:
            ekuitas.append({"code": code, "name": acc["name"], "amount": saldo, "sub": acc.get("subcategory", "")})
            tot_e += saldo
    # Laba tahun berjalan sintetis: _laba_rugi include closing → auto net-zero periode ditutup
    lr = await _laba_rugi("1900-01-01", as_of_date, unit_usaha_id)
    laba = lr["laba_bersih"]
    if laba != 0:
        ekuitas.append({"code": "L/R", "name": "Laba/Rugi Tahun Berjalan (kalkulasi)", "amount": laba, "sub": "saldo_laba"})
        tot_e += laba
    return {
        "as_of": as_of_date,
        "aset": aset, "kewajiban": kewajiban, "ekuitas": ekuitas,
        "total_aset": tot_a, "total_kewajiban": tot_k, "total_ekuitas": tot_e,
        "total_pasiva": tot_k + tot_e, "balanced": abs(tot_a - (tot_k + tot_e)) < 0.01,
    }

async def _arus_kas(start_date: str, end_date: str, unit_usaha_id: Optional[str] = None):
    """Cash flow — detect kas/bank accounts via subcategory='kas_bank' (no hardcoded codes)."""
    from services.reporting.accounting_core import _get_accounts_map, _group_from_unit
    q = {"date": {"$gte": start_date, "$lte": end_date}, "unit_usaha_id": unit_usaha_id}
    txs = await db.transactions.select(q, None).all(20000)
    grp = await _group_from_unit(unit_usaha_id)
    accounts = await _get_accounts_map(grp)
    kas_codes = {code for code, acc in accounts.items() if acc.get("subcategory") == "kas_bank"}
    kas_masuk = []
    kas_keluar = []
    tot_masuk, tot_keluar = 0.0, 0.0
    for tx in txs:
        amt = to_amount(tx.get("amount"))
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        if d in kas_codes and c not in kas_codes:
            desc = accounts.get(c, {}).get("name", c)
            kas_masuk.append({"date": tx.get("date"), "description": tx.get("description") or desc, "amount": amt})
            tot_masuk += amt
        elif c in kas_codes and d not in kas_codes:
            desc = accounts.get(d, {}).get("name", d)
            kas_keluar.append({"date": tx.get("date"), "description": tx.get("description") or desc, "amount": amt})
            tot_keluar += amt
    kas_masuk.sort(key=lambda x: x.get("date") or "")
    kas_keluar.sort(key=lambda x: x.get("date") or "")
    return {
        "kas_masuk": kas_masuk, "kas_keluar": kas_keluar,
        "total_masuk": tot_masuk, "total_keluar": tot_keluar,
        "arus_kas_bersih": tot_masuk - tot_keluar,
    }

async def _perubahan_ekuitas(start_date: str, end_date: str, unit_usaha_id: Optional[str] = None):
    """Return the numbered BUMDES equity statement; unit statements are disabled."""
    if unit_usaha_id:
        return {"start_date": start_date, "end_date": end_date, "disabled": True, "rows": []}

    lr = await _laba_rugi(start_date, end_date, None, include_closing=False)
    bal_awal, accounts = await _calc_balances_before(start_date, None)

    def _sum_by(sub: str) -> float:
        return sum(bal_awal.get(code, {}).get("saldo", 0) for code, account in accounts.items()
                   if account.get("category") == "ekuitas" and account.get("subcategory") == sub)

    modal_desa_awal = _sum_by("modal_desa")
    modal_masyarakat_awal = _sum_by("modal_masyarakat")
    q = {"date": {"$gte": start_date, "$lte": end_date}, "unit_usaha_id": None}
    txs = await db.transactions.select(q, None).all(20000)
    tambah_desa = tambah_masyarakat = 0.0
    bagi_hasil_desa = bagi_hasil_masyarakat = 0.0
    for tx in txs:
        credit = accounts.get(tx["credit_account_code"], {})
        debit = accounts.get(tx["debit_account_code"], {})
        amount = to_amount(tx.get("amount"))
        if credit.get("category") == "ekuitas" and credit.get("subcategory") == "modal_desa": tambah_desa += amount
        if credit.get("category") == "ekuitas" and credit.get("subcategory") == "modal_masyarakat": tambah_masyarakat += amount
        if debit.get("category") == "ekuitas" and debit.get("subcategory") == "bagi_hasil_desa": bagi_hasil_desa += amount
        if debit.get("category") == "ekuitas" and debit.get("subcategory") == "bagi_hasil_masyarakat": bagi_hasil_masyarakat += amount

    modal_akhir = modal_desa_awal + modal_masyarakat_awal + tambah_desa + tambah_masyarakat
    laba_bersih = to_amount(lr["laba_bersih"])
    bagi_pengurus = laba_bersih * 0.35
    bagi_penasihat = laba_bersih * 0.07
    bagi_pengawas = laba_bersih * 0.05
    dana_sosial = laba_bersih * 0.05
    pades = laba_bersih * 0.30
    saldo_laba_dibagikan = bagi_pengurus + bagi_penasihat + bagi_pengawas + dana_sosial
    saldo_laba_tahun_lalu = _sum_by("saldo_laba")
    laba_ditahan = laba_bersih - saldo_laba_dibagikan
    saldo_laba_akhir = saldo_laba_tahun_lalu + laba_ditahan - pades - bagi_hasil_masyarakat
    rows = [
        {"no": 1, "label": "PENYERTAAN MODAL", "amount": None, "kind": "section"},
        {"no": 2, "label": "Penyertaan modal awal", "amount": modal_desa_awal + modal_masyarakat_awal, "indent": 0},
        {"no": 3, "label": "Penyertaan Modal Desa", "amount": modal_desa_awal, "indent": 1},
        {"no": 4, "label": "Penyertaan Modal Masyarakat", "amount": modal_masyarakat_awal, "indent": 1},
        {"no": 5, "label": "Penambahan investasi periode berjalan", "amount": tambah_desa + tambah_masyarakat, "indent": 0},
        {"no": 6, "label": "Penyertaan Modal Desa", "amount": tambah_desa, "indent": 1},
        {"no": 7, "label": "Penyertaan Modal Masyarakat", "amount": tambah_masyarakat, "indent": 1},
        {"no": 8, "label": "Penyertaan Modal Akhir (3+4+6+7)", "amount": modal_akhir, "bold": True},
        {"no": 9, "label": "SALDO LABA", "amount": None, "kind": "section"},
        {"no": 10, "label": "Saldo Laba Awal", "amount": saldo_laba_tahun_lalu, "indent": 0},
        {"no": 11, "label": "Saldo laba belum dicadangkan", "amount": saldo_laba_tahun_lalu, "indent": 1},
        {"no": 12, "label": "Saldo laba dicadangkan untuk modal BUMDES", "amount": _sum_by("saldo_laba"), "indent": 1},
        {"no": 13, "label": "Laba (Rugi) periode berjalan", "amount": laba_ditahan, "indent": 1},
        {"no": 14, "label": "Bagi Hasil Penyertaan", "amount": None, "indent": 0, "bold": True},
        {"no": 15, "label": "Bagi Hasil Penyertaan Modal Desa (PADes 30%)", "amount": pades, "indent": 1},
        {"no": 16, "label": "Bagi Hasil Penyertaan Modal Masyarakat", "amount": bagi_hasil_masyarakat, "indent": 1},
        {"no": 17, "label": "Saldo Laba Akhir (11+12+13-15-16)", "amount": saldo_laba_akhir, "bold": True},
        {"no": 18, "label": "EKUITAS AKHIR (8+17)", "amount": modal_akhir + saldo_laba_akhir, "bold": True},
    ]
    return {
        "start_date": start_date,
        "end_date": end_date,
        "rows": rows,
        "ekuitas_akhir": modal_akhir + saldo_laba_akhir,
        "penyertaan_modal_akhir": modal_akhir,
        "saldo_laba_akhir": saldo_laba_akhir,
        "penyertaan_modal_awal": modal_desa_awal + modal_masyarakat_awal,
        "modal_desa_awal": modal_desa_awal,
        "modal_masyarakat_awal": modal_masyarakat_awal,
        "tambah_desa": tambah_desa,
        "tambah_masyarakat": tambah_masyarakat,
        "saldo_laba_awal": saldo_laba_tahun_lalu,
        "laba_periode": laba_ditahan,
        "bagi_hasil_desa": pades,
        "bagi_hasil_masyarakat": bagi_hasil_masyarakat,
    }
