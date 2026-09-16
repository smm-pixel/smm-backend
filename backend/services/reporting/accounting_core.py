"""Reporting calculations: accounting core"""
from services.reporting.context import *

async def _get_accounts_map(group: Optional[str] = None):
    """Return {code: doc} of accounts. If group is provided, scope to that group only
    (needed because different groups may share the same code)."""
    q: dict = {}
    if group:
        q["group"] = group
    docs = await db.accounts.select(q, None).all(500)
    return {d["code"]: d for d in docs}

async def _group_from_unit(unit_usaha_id: Optional[str]) -> str:
    """Derive kelompok string ('BUMDES' | 'UUxx') from a transaction's unit_usaha_id."""
    if not unit_usaha_id:
        return "BUMDES"
    u = await db.unit_usaha.select_one({"id": unit_usaha_id}, {"_id": 0, "code": 1})
    return (u or {}).get("code") or "BUMDES"

async def _calc_balances(start_date: Optional[str], end_date: Optional[str], unit_usaha_id: Optional[str] = None):
    """Return {account_code: {debit, credit, saldo}} based on tx filter.
    unit_usaha_id=None → BUMDES scope only (tx where unit_usaha_id is null)."""
    q: dict = {"unit_usaha_id": unit_usaha_id}
    if start_date and end_date:
        q["date"] = {"$gte": start_date, "$lte": end_date}
    txs = await db.transactions.select(q, None).all(20000)
    bal: dict = {}
    for tx in txs:
        amt = to_amount(tx.get("amount"))
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        bal.setdefault(d, {"debit": 0, "credit": 0})
        bal.setdefault(c, {"debit": 0, "credit": 0})
        bal[d]["debit"] += amt
        bal[c]["credit"] += amt
    grp = await _group_from_unit(unit_usaha_id)
    accounts = await _get_accounts_map(grp)
    for code, v in bal.items():
        acc = accounts.get(code)
        if acc:
            if acc["normal_balance"] == "debit":
                v["saldo"] = v["debit"] - v["credit"]
            else:
                v["saldo"] = v["credit"] - v["debit"]
        else:
            v["saldo"] = v["debit"] - v["credit"]
    return bal, accounts

async def _calc_balances_before(before_date: str, unit_usaha_id: Optional[str] = None):
    """Return balance strictly before a given date (exclusive)."""
    q: dict = {"date": {"$lt": before_date}, "unit_usaha_id": unit_usaha_id}
    txs = await db.transactions.select(q, None).all(20000)
    bal: dict = {}
    for tx in txs:
        amt = to_amount(tx.get("amount"))
        d = tx["debit_account_code"]
        c = tx["credit_account_code"]
        bal.setdefault(d, {"debit": 0, "credit": 0})
        bal.setdefault(c, {"debit": 0, "credit": 0})
        bal[d]["debit"] += amt
        bal[c]["credit"] += amt
    grp = await _group_from_unit(unit_usaha_id)
    accounts = await _get_accounts_map(grp)
    for code, v in bal.items():
        acc = accounts.get(code)
        if acc:
            if acc["normal_balance"] == "debit":
                v["saldo"] = v["debit"] - v["credit"]
            else:
                v["saldo"] = v["credit"] - v["debit"]
        else:
            v["saldo"] = v["debit"] - v["credit"]
    return bal, accounts
