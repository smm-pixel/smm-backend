import { useCallback, useEffect, useMemo, useState } from "react";
import api, { fmtRp, fmtDate, API } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import { Books, MagnifyingGlass, FilePdf, FileXls } from "@phosphor-icons/react";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const YEAR_MIN = 2022, YEAR_MAX = 2030;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
const pad = (n) => String(n).padStart(2, "0");

export default function BukuBesar() {
  const { user } = useAuth();
  const isPengelola = user?.role === "pengelola";

  const [accounts, setAccounts] = useState([]);
  const [units, setUnits] = useState([]);
  const [group, setGroup] = useState("BUMDES"); // active tab
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [periodMode, setPeriodMode] = useState("monthly");
  const [customPreset, setCustomPreset] = useState("ytd");
  const [customStart, setCustomStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const customStartDate = customPreset === "ytd" ? `${year}-01-01` : customPreset === "qtd" ? `${year}-${pad(Math.floor((month - 1) / 3) * 3 + 1)}-01` : customPreset === "mtd" ? `${year}-${pad(month)}-01` : customStart;
  const customEndDate = customPreset === "ytd" || customPreset === "qtd" || customPreset === "mtd" ? new Date().toISOString().slice(0, 10) : customEnd;
  const startDate = periodMode === "yearly" ? `${year}-01-01` : periodMode === "custom" ? customStartDate : `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = periodMode === "yearly" ? `${year}-12-31` : periodMode === "custom" ? customEndDate : `${year}-${pad(month)}-${pad(lastDay)}`;
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/accounts"), api.get("/unit-usaha")]).then(([a, u]) => {
      setAccounts(a.data); setUnits(u.data);
      // pengelola: pin ke unit sendiri
      if (isPengelola && user?.unit_usaha_id) {
        const own = u.data.find(x => x.id === user.unit_usaha_id);
        if (own) setGroup(own.code);
      }
    });
  }, [isPengelola, user]);

  // unit_usaha_id derived from active tab
  const activeUnitId = useMemo(() => {
    if (group === "BUMDES") return null;
    return units.find(u => u.code === group)?.id || null;
  }, [group, units]);

  const loadLedger = useCallback(async (code) => {
    if (!code) { setLedger(null); return; }
    setLoading(true);
    try {
      const params = { account_code: code, start_date: startDate, end_date: endDate };
      if (activeUnitId) params.unit_usaha_id = activeUnitId;
      const r = await api.get("/reports/ledger", { params });
      setLedger(r.data);
    } catch (er) { notify(er.response?.data?.detail || "Gagal memuat buku besar"); }
    finally { setLoading(false); }
  }, [startDate, endDate, activeUnitId]);

  useEffect(() => { if (selected) loadLedger(selected); }, [selected, loadLedger]);

  // When switching group tab, reset selection
  useEffect(() => { setSelected(""); setLedger(null); }, [group]);

  const downloadPdf = async () => download("pdf");
  const downloadExcel = async () => download("excel");
  const download = async (kind) => {
    if (!selected) return;
    const p = new URLSearchParams({ account_code: selected, start_date: startDate, end_date: endDate });
    if (activeUnitId) p.set("unit_usaha_id", activeUnitId);
    const res = await fetch(`${API}/reports/ledger/${kind}?${p}`, {
      credentials: "include",
    });
    if (!res.ok) { notify(`Gagal mengunduh ${kind}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = kind === "pdf" ? "pdf" : "xlsx";
    a.href = url; a.download = `Buku-Besar_${group}_${selected}_${startDate}_sd_${endDate}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  // Filter accounts by active group
  const groupAccounts = useMemo(
    () => accounts.filter(a => (a.group || "BUMDES") === group),
    [accounts, group]
  );
  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groupAccounts;
    return groupAccounts.filter(a => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [groupAccounts, search]);

  const groupTabs = useMemo(() => {
    const tabs = [{ key: "BUMDES", label: "BUMDES - Pusat" }];
    ["UU01", "UU02", "UU03", "UU04", "UU05", "UU06"].forEach(code => {
      const u = units.find(unit => unit.code === code);
      if (u) tabs.push({ key: u.code, label: `${u.code} - ${u.name}` });
    });
    return isPengelola
      ? tabs.filter(t => t.key !== "BUMDES" && t.key === units.find(u => u.id === user?.unit_usaha_id)?.code)
      : tabs;
  }, [units, isPengelola, user]);

  return (
    <div className="space-y-6" data-testid="ledger-page">
      <div>
        <p className="label mb-1">GENERAL LEDGER</p>
        <h1 className="font-heading text-3xl font-bold flex items-center gap-2 page-h1">
          <Books size={26} weight="duotone" color="#2E4F7C" /> Buku Besar per Akun
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Tiap kelompok punya buku besar sendiri. Pilih tab kelompok terlebih dahulu, lalu klik akun untuk melihat riwayat transaksinya.
        </p>
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start" data-testid="ledger-filters">
        <div>
          <label className="label" htmlFor="ledger-group-select">Kelompok</label>
          <select id="ledger-group-select" data-testid="ledger-group-select" className="select"
                  value={group} disabled={isPengelola} onChange={(e) => setGroup(e.target.value)}>
            {groupTabs.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ledger-period-mode">Periode</label>
          <select id="ledger-period-mode" data-testid="ledger-period-mode" className="select" value={periodMode} onChange={(e) => { setPeriodMode(e.target.value); setSelected(""); setLedger(null); }}>
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
            <option value="custom">Custom</option>
          </select>
          {periodMode === "custom" && <>
            <select className="select mt-2" value={customPreset} onChange={(e) => setCustomPreset(e.target.value)}><option value="ytd">Year to Date</option><option value="qtd">Quarter to Date</option><option value="mtd">Month to Date</option><option value="dates">Pilih tanggal</option></select>
            {customPreset === "dates" && <div className="grid grid-cols-2 gap-2 mt-2"><input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /><input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>}
          </>}
        </div>
        {periodMode === "monthly" && <div>
          <label className="label" htmlFor="ledger-month">Bulan</label>
          <select id="ledger-month" data-testid="ledger-month" className="select" value={month}
                  onChange={(e) => { setMonth(Number(e.target.value)); setSelected(""); setLedger(null); }}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>}
        <div>
          <label className="label" htmlFor="ledger-year">Tahun</label>
          <select id="ledger-year" data-testid="ledger-year" className="select" value={year}
                  onChange={(e) => { setYear(Number(e.target.value)); setSelected(""); setLedger(null); }}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="ledger-search">Cari Akun</label>
          <div className="relative">
            <MagnifyingGlass size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" color="#8E88A5" />
            <input id="ledger-search" data-testid="ledger-search" className="input pl-10"
                   placeholder="Cari berdasarkan kode atau nama akun"
                   value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: list akun */}
        <div className="card p-0 overflow-hidden lg:col-span-1" style={{ maxHeight: 600, overflowY: "auto" }}>
          <div className="p-4" style={{ borderBottom: "1px solid var(--border)", background: "#F6FAFE" }}>
            <p className="label mb-0">Akun {group} ({filteredAccounts.length})</p>
          </div>
          <ul data-testid="ledger-account-list">
            {filteredAccounts.length === 0 ? (
              <li className="p-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                Belum ada akun pada kelompok <b>{group}</b>.
              </li>
            ) : filteredAccounts.map(a => {
              const active = a.code === selected;
              return (
                <li key={a.code}>
                  <button data-testid={`ledger-acc-${a.code}`}
                          onClick={() => setSelected(a.code)}
                          className="w-full text-left px-4 py-2.5 border-b transition-colors"
                          style={{
                            background: active ? "var(--primary-light)" : "transparent",
                            borderColor: "var(--border)",
                          }}>
                    <div className="font-mono text-xs font-semibold" style={{ color: active ? "#2E4F7C" : "var(--text-secondary)" }}>{a.code}</div>
                    <div className="text-sm" style={{ color: active ? "#1A2E1E" : "var(--text-primary)" }}>{a.name}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: ledger detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card text-center py-16">
              <Books size={40} weight="duotone" color="#8E88A5" style={{ margin: "0 auto 12px" }} />
              <p style={{ color: "var(--text-muted)" }}>Pilih akun di sebelah kiri untuk melihat buku besar <b>{group}</b>.</p>
            </div>
          ) : loading ? (
            <div className="card text-center py-10">Memuat...</div>
          ) : ledger ? (
            <div className="card p-0 overflow-hidden">
              <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="label mb-0">Buku Besar · {group}</p>
                    <h3 className="font-heading text-xl font-bold" data-testid="ledger-title">
                      {ledger.account.code} — {ledger.account.name}
                    </h3>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      Kategori: {ledger.account.category} • Saldo normal: {ledger.account.normal_balance}
                    </p>
                  </div>
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="text-right">
                      <div className="label">Saldo Akhir</div>
                      <div className="font-heading text-xl font-bold" style={{ color: "#2E4F7C" }} data-testid="ledger-final-balance">
                        {fmtRp(ledger.saldo_akhir)}
                      </div>
                    </div>
                    <button data-testid="btn-ledger-pdf" onClick={downloadPdf} className="btn btn-outline">
                      <FilePdf size={16} weight="duotone" color="#D97878" /> Export PDF
                    </button>
                    <button data-testid="btn-ledger-excel" onClick={downloadExcel} className="btn btn-outline">
                      <FileXls size={16} weight="duotone" color="#2E4F7C" /> Export Excel
                    </button>
                  </div>
                </div>
              </div>
              <div className="h-scroll">
                <table className="tbl" data-testid="ledger-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Keterangan</th>
                      <th>Akun Lawan</th>
                      <th>Ref.</th>
                      <th className="num">Debit</th>
                      <th className="num">Kredit</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: "#EEF3F9" }}>
                      <td colSpan={6} className="font-semibold">Saldo Awal</td>
                      <td className="num font-semibold">{fmtRp(ledger.saldo_awal)}</td>
                    </tr>
                    {ledger.entries.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--text-muted)" }}>
                        Tidak ada transaksi pada periode ini.
                      </td></tr>
                    ) : ledger.entries.map((e) => (
                      <tr key={e.id}>
                        <td>{fmtDate(e.date)}</td>
                        <td className="max-w-xs">{e.description}</td>
                        <td className="text-xs">
                          <div className="font-mono">{e.other_account_code}</div>
                          <div style={{ color: "var(--text-muted)" }}>{e.other_account_name}</div>
                        </td>
                        <td className="text-xs">{e.reference || "-"}</td>
                        <td className="num">{e.debit ? fmtRp(e.debit) : "-"}</td>
                        <td className="num">{e.credit ? fmtRp(e.credit) : "-"}</td>
                        <td className="num font-semibold tabular-nums">{fmtRp(e.balance)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#DCE8FE" }}>
                      <td colSpan={4} className="font-bold" style={{ color: "#2E4F7C" }}>TOTAL PERIODE</td>
                      <td className="num font-bold">{fmtRp(ledger.total_debit)}</td>
                      <td className="num font-bold">{fmtRp(ledger.total_credit)}</td>
                      <td className="num font-bold">{fmtRp(ledger.saldo_akhir)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
