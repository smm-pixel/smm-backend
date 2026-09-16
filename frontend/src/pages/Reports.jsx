import { useEffect, useMemo, useState } from "react";
import api, { fmtRp, API } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import { useConfirm } from "@/components/ConfirmProvider";
import { FilePdf, FileXls, ChartLine, Scales, Coins, TrendUp, BookOpen, ChartBar, Lock } from "@phosphor-icons/react";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const YEAR_MIN = 2022, YEAR_MAX = 2030;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
const pad = (n) => String(n).padStart(2, "0");
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const monthRange = (year, month) => {
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
};

// Sub-tabs report: keys sama untuk BUMDES dan Unit — backend pakai unit_usaha_id untuk scoping.
const REPORTS = [
  { key: "laba-rugi", label: "Laporan Laba Rugi", icon: ChartLine, needsRange: true },
  { key: "perubahan-ekuitas", label: "Laporan Perubahan Ekuitas", icon: TrendUp, needsRange: true },
  { key: "neraca", label: "Laporan Posisi Keuangan (Neraca)", icon: Scales, needsRange: false },
  { key: "arus-kas", label: "Laporan Arus Kas", icon: Coins, needsRange: true },
  { key: "calk", label: "Catatan atas Laporan Keuangan (CaLK)", icon: BookOpen, needsRange: true },
];

export default function Reports() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isPengelola = user?.role === "pengelola";
  const isAdmin = user?.role === "admin";

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [periodMode, setPeriodMode] = useState("monthly");
  const [customPreset, setCustomPreset] = useState("ytd");
  const [customStart, setCustomStart] = useState(`${currentYear}-01-01`);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const { start: monthlyStart, end: monthlyEnd } = monthRange(year, month);
  const customRange = customPreset === "ytd" ? [`${year}-01-01`, new Date().toISOString().slice(0, 10)] : customPreset === "qtd" ? [`${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`, new Date().toISOString().slice(0, 10)] : customPreset === "mtd" ? [`${year}-${String(month).padStart(2, "0")}-01`, new Date().toISOString().slice(0, 10)] : [customStart, customEnd];
  const start = periodMode === "yearly" ? `${year}-01-01` : periodMode === "custom" ? customRange[0] : monthlyStart;
  const end = periodMode === "yearly" ? `${year}-12-31` : periodMode === "custom" ? customRange[1] : monthlyEnd;
  // tab: laporan | kinerja
  const [tab, setTab] = useState("laporan");
  const [active, setActive] = useState("laba-rugi");
  // Dropdown 7 kelompok
  const [groupKey, setGroupKey] = useState("BUMDES");  // BUMDES | UU01..UU06
  const [units, setUnits] = useState([]);
  const [data, setData] = useState(null);
  const [kinerja, setKinerja] = useState(null);
  const [loading, setLoading] = useState(false);

  // Tutup Buku (admin only)
  const [closePeriod, setClosePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [closeGroup, setCloseGroup] = useState("BUMDES");
  const [closedList, setClosedList] = useState([]);
  const loadClosed = () => api.get("/reports/closed-periods").then(r => setClosedList(r.data));
  useEffect(() => { if (isAdmin) loadClosed(); }, [isAdmin]);
  const doClose = async () => {
    if (!(await confirm({ title: "Tutup buku", description: `Tutup buku periode ${closePeriod} untuk ${closeGroup}?`, confirmLabel: "Tutup buku", destructive: true }))) return;
    try {
      const r = await api.post("/reports/close-period", { period: closePeriod, group: closeGroup });
      notify(`Berhasil ditutup. Jurnal dibuat: ${r.data.entries}. Laba bersih: Rp ${r.data.laba_bersih.toLocaleString("id-ID")}`);
      loadClosed();
    } catch (er) { notify(er.response?.data?.detail || "Gagal tutup buku"); }
  };
  const doReopen = async (period, grp) => {
    if (!(await confirm({ title: "Batalkan tutup buku", description: `Batalkan tutup buku ${period} (${grp})?`, confirmLabel: "Batalkan", destructive: true }))) return;
    try { await api.delete("/reports/close-period", { params: { period, group: grp } }); loadClosed(); }
    catch (er) { notify(er.response?.data?.detail || "Gagal batalkan"); }
  };

  useEffect(() => {
    api.get("/unit-usaha").then(r => {
      setUnits(r.data);
      if (isPengelola && user?.unit_usaha_id) {
        const own = r.data.find(u => u.id === user.unit_usaha_id);
        if (own) setGroupKey(own.code);
      }
    });
  }, [isPengelola, user]);

  const visibleReports = groupKey === "BUMDES" ? REPORTS : REPORTS.filter(r => !["perubahan-ekuitas", "calk"].includes(r.key));
  const cfg = visibleReports.find(r => r.key === active) || visibleReports[0];
  useEffect(() => {
    if (groupKey !== "BUMDES" && ["perubahan-ekuitas", "calk"].includes(active)) {
      setActive("neraca");
      setData(null);
    }
  }, [groupKey, active]);
  const groupOptions = useMemo(() => {
    const list = [{ code: "BUMDES", name: "Pusat", id: null }];
    ["UU01", "UU02", "UU03", "UU04", "UU05", "UU06"].forEach(code => {
      const u = units.find(unit => unit.code === code);
      if (u) list.push({ code: u.code, name: u.name, id: u.id });
    });
    return isPengelola
      ? list.filter(o => o.code === units.find(u => u.id === user?.unit_usaha_id)?.code)
      : list;
  }, [units, isPengelola, user]);

  const activeUnitId = useMemo(() => {
    if (groupKey === "BUMDES") return null;
    return units.find(u => u.code === groupKey)?.id || null;
  }, [groupKey, units]);

  const load = async () => {
    setLoading(true); setData(null); setKinerja(null);
    try {
      if (tab === "kinerja") {
        const r = await api.get("/reports/per-unit", { params: { start_date: start, end_date: end } });
        setKinerja(r.data);
      } else if (cfg) {
        const params = cfg.needsRange
          ? { start_date: start, end_date: end }
          : { as_of_date: end };
        if (activeUnitId) params.unit_usaha_id = activeUnitId;
        const r = await api.get(`/reports/${cfg.key}`, { params });
        setData(r.data);
      }
    } catch (er) { notify(er.response?.data?.detail || "Gagal memuat laporan"); }
    finally { setLoading(false); }
  };

  const download = async (kind) => {
    let urlPath, filename;
    if (tab === "kinerja") {
      const params = new URLSearchParams({ start_date: start, end_date: end });
      urlPath = `${API}/reports/per-unit/${kind}?${params}`;
      filename = `Rekap-Kinerja_${start}_sd_${end}.${kind === "pdf" ? "pdf" : "xlsx"}`;
    } else {
      if (!cfg) return;
      const params = new URLSearchParams(cfg.needsRange
        ? { start_date: start, end_date: end }
        : { as_of_date: end });
      if (activeUnitId) params.set("unit_usaha_id", activeUnitId);
      urlPath = `${API}/reports/${cfg.key}/${kind}?${params}`;
      filename = `${cfg.key}_${groupKey}.${kind === "pdf" ? "pdf" : "xlsx"}`;
    }
    const res = await fetch(urlPath, { credentials: "include" });
    if (!res.ok) { notify(`Gagal export ${kind.toUpperCase()}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <p className="label mb-1">FINANCIAL STATEMENTS</p>
        <h1 className="font-heading text-3xl font-bold page-h1">Laporan Keuangan</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          {isPengelola
            ? "Anda hanya dapat mengakses laporan unit usaha yang Anda kelola."
            : "Dua tab: Laporan Keuangan (pilih kelompok BUMDES atau salah satu unit usaha) dan Rekap Kinerja."}
        </p>
      </div>

      <div className="tab-strip" data-testid="reports-toplevel-tabs">
        <button data-testid="tab-laporan" onClick={() => { setTab("laporan"); setData(null); setKinerja(null); }}
                className={`btn ${tab === "laporan" ? "btn-primary" : "btn-outline"}`}>
          <Scales size={16} weight={tab === "laporan" ? "fill" : "regular"} /> Laporan Keuangan
        </button>
        {!isPengelola && (
          <button data-testid="tab-kinerja" onClick={() => { setTab("kinerja"); setData(null); setKinerja(null); }}
                  className={`btn ${tab === "kinerja" ? "btn-primary" : "btn-outline"}`}>
            <ChartBar size={16} weight={tab === "kinerja" ? "fill" : "regular"} /> Rekap Kinerja
          </button>
        )}
      </div>

      {tab === "laporan" && (
        <>
          <div className="card">
            <label className="label" htmlFor="report-group-select">Kelompok</label>
            <select id="report-group-select" data-testid="report-group-select" className="select" value={groupKey}
                    disabled={isPengelola}
                    onChange={(e) => { setGroupKey(e.target.value); setData(null); }}>
              {groupOptions.map(o => <option key={o.code} value={o.code}>{o.code === "BUMDES" ? "BUMDES - Pusat" : `${o.code} - ${o.name}`}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              <div>
                <label className="label" htmlFor="report-type-select">Jenis Laporan Keuangan</label>
                <select id="report-type-select" data-testid="report-type-select" className="select" value={active}
                        onChange={(e) => { setActive(e.target.value); setData(null); }}>
                  {visibleReports.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="report-period-mode">Periode</label>
                <select id="report-period-mode" data-testid="report-period-mode" className="select" value={periodMode} onChange={(e) => { setPeriodMode(e.target.value); setData(null); setKinerja(null); }}>
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
                <label className="label" htmlFor="report-month">Bulan</label>
                <select id="report-month" data-testid="report-month" className="select" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setData(null); setKinerja(null); }}>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>}
              <div>
                <label className="label" htmlFor="report-year">Tahun</label>
                <select id="report-year" data-testid="report-year" className="select" value={year} onChange={(e) => { setYear(Number(e.target.value)); setData(null); setKinerja(null); }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button data-testid="btn-load-report" onClick={load} className="btn btn-primary">
                {loading ? "Memuat..." : "Tampilkan Laporan"}
              </button>
            </div>
          </div>
        </>
      )}

      {tab === "kinerja" && (
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            <div>
              <label className="label" htmlFor="performance-period-mode">Periode</label>
              <select id="performance-period-mode" data-testid="performance-period-mode" className="select" value={periodMode} onChange={(e) => { setPeriodMode(e.target.value); setKinerja(null); }}>
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
            {periodMode === "monthly" && <div>
              <label className="label" htmlFor="performance-month">Bulan</label>
              <select id="performance-month" data-testid="performance-month" className="select" value={month} onChange={(e) => { setMonth(Number(e.target.value)); setKinerja(null); }}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>}
            <div>
              <label className="label" htmlFor="performance-year">Tahun</label>
              <select id="performance-year" data-testid="performance-year" className="select" value={year} onChange={(e) => { setYear(Number(e.target.value)); setKinerja(null); }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button data-testid="btn-load-performance" onClick={load} className="btn btn-primary">
              {loading ? "Memuat..." : "Tampilkan Laporan"}
            </button>
          </div>
        </div>
      )}

      {tab === "kinerja" && kinerja && (
        <>
          {/* ==== Tabel Kinerja BUMDES ==== */}
          <div className="card fade-in" data-testid="kinerja-bumdes-card">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h3 className="font-heading text-xl font-semibold">Kinerja BUMDES</h3>
              <div className="flex gap-2 flex-wrap">
                <button data-testid="btn-export-kinerja-pdf" onClick={() => download("pdf")} className="btn btn-outline">
                  <FilePdf size={16} weight="duotone" color="#D97878" /> Export PDF
                </button>
                <button data-testid="btn-export-kinerja-excel" onClick={() => download("excel")} className="btn btn-outline">
                  <FileXls size={16} weight="duotone" color="#2E4F7C" /> Export Excel
                </button>
              </div>
            </div>

            {/* Mobile: stacked layout (< 768px) */}
            <div className="sm:hidden space-y-3" data-testid="bumdes-kinerja-mobile">
              <div className="flex items-center justify-between gap-3 pb-2"
                   style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="badge">BUMDES</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>periode terpilih</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="label">Pendapatan</div><div className="font-semibold text-sm tabular-nums">{fmtRp(kinerja.bumdes?.pendapatan || 0)}</div></div>
                <div><div className="label">Beban</div><div className="font-semibold text-sm tabular-nums">{fmtRp(kinerja.bumdes?.beban || 0)}</div></div>
                <div><div className="label">Laba Bersih</div>
                  <div className="font-bold text-base tabular-nums"
                       style={{ color: (kinerja.bumdes?.laba_bersih || 0) >= 0 ? "#2E4F7C" : "#D97878" }}>
                    {fmtRp(kinerja.bumdes?.laba_bersih || 0)}
                  </div>
                </div>
                <div><div className="label">18% Modal</div>
                  <div className="font-semibold text-sm tabular-nums" style={{ color: "#3A5A7D" }}
                       data-testid="bumdes-modal-18-m">{fmtRp(kinerja.bumdes?.share_modal_18 || 0)}</div>
                </div>
              </div>
              <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="label mb-1">82% Unsur Lain</div>
                <ul className="text-xs space-y-1">
                  <li className="flex justify-between"><span>PADes (30%)</span><b className="tabular-nums">{fmtRp(kinerja.bumdes?.share_pades_30 || 0)}</b></li>
                  <li className="flex justify-between"><span>Penasihat (7%)</span><b className="tabular-nums">{fmtRp(kinerja.bumdes?.share_penasihat_7 || 0)}</b></li>
                  <li className="flex justify-between"><span>Pengawas (5%)</span><b className="tabular-nums">{fmtRp(kinerja.bumdes?.share_pengawas_5 || 0)}</b></li>
                  <li className="flex justify-between"><span>Pengurus (35%)</span><b className="tabular-nums">{fmtRp(kinerja.bumdes?.share_pengurus_35 || 0)}</b></li>
                  <li className="flex justify-between"><span>Dana Sosial (5%)</span><b className="tabular-nums">{fmtRp(kinerja.bumdes?.share_dana_sosial_5 || 0)}</b></li>
                </ul>
              </div>
            </div>

            {/* Desktop/tablet: full table (>= 768px) */}
            <div className="hidden sm:block h-scroll">
              <table className="tbl" data-testid="bumdes-kinerja-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th className="num">Pendapatan</th>
                    <th className="num">Beban</th>
                    <th className="num">Laba Bersih</th>
                    <th className="num">18% Modal</th>
                    <th>82% Unsur Lain</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["PADes (30%)", "share_pades_30", "bumdes-pades-30"],
                    ["Penasihat (7%)", "share_penasihat_7", "bumdes-penasihat-7"],
                    ["Pengawas (5%)", "share_pengawas_5", "bumdes-pengawas-5"],
                    ["Pengurus (35%)", "share_pengurus_35", "bumdes-pengurus-35"],
                    ["Dana Sosial (5%)", "share_dana_sosial_5", "bumdes-dana-sosial-5"],
                  ].map(([label, valueKey, testId], index) => (
                    <tr key={valueKey}>
                      {index === 0 && <>
                        <td rowSpan={5}><span className="badge">BUMDES</span></td>
                        <td rowSpan={5} className="num">{fmtRp(kinerja.bumdes?.pendapatan || 0)}</td>
                        <td rowSpan={5} className="num">{fmtRp(kinerja.bumdes?.beban || 0)}</td>
                        <td rowSpan={5} className="num font-semibold" style={{ color: (kinerja.bumdes?.laba_bersih || 0) >= 0 ? "#2E4F7C" : "#D97878" }}>
                          {fmtRp(kinerja.bumdes?.laba_bersih || 0)}
                        </td>
                        <td rowSpan={5} className="num" style={{ color: "#3A5A7D" }} data-testid="bumdes-modal-18">
                          {fmtRp(kinerja.bumdes?.share_modal_18 || 0)}
                        </td>
                      </>}
                      <td data-testid={testId}>{label} = <b>{fmtRp(kinerja.bumdes?.[valueKey] || 0)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ==== Tabel Kinerja Per Unit ==== */}
          <div className="card fade-in">
            <h3 className="font-heading text-xl font-semibold mb-4">Kinerja Per Unit Usaha</h3>
            <div className="h-scroll">
              <table className="tbl" data-testid="per-unit-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Kode</th><th>Unit Usaha</th>
                    <th className="num">Pendapatan</th><th className="num">Beban</th>
                    <th className="num">Laba Bersih</th>
                    <th className="num">30% Pengelola</th><th className="num">70% BUMDES</th>
                  </tr>
                </thead>
                <tbody>
                  {kinerja.units.map(u => (
                    <tr key={u.id}>
                      <td><span className="badge">{u.code}</span></td>
                      <td className="font-medium">{u.name}</td>
                      <td className="num">{fmtRp(u.pendapatan)}</td>
                      <td className="num">{fmtRp(u.beban)}</td>
                      <td className="num font-semibold" style={{ color: u.laba_bersih >= 0 ? "#2E4F7C" : "#D97878" }}>{fmtRp(u.laba_bersih)}</td>
                      <td className="num" style={{ color: "#2E4F7C" }}>{fmtRp(u.share_pengelola_30)}</td>
                      <td className="num" style={{ color: "#3A5A7D" }}>{fmtRp(u.share_bumdes_70)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "laporan" && data && cfg && (
        <div className="card fade-in">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h3 className="font-heading text-xl font-semibold">{cfg.label}
              <span className="ml-2 badge">{groupKey}</span>
            </h3>
            <div className="flex gap-2">
              <button data-testid="btn-export-pdf" onClick={() => download("pdf")} className="btn btn-outline">
                <FilePdf size={16} weight="duotone" color="#D97878" /> Export PDF
              </button>
              <button data-testid="btn-export-excel" onClick={() => download("excel")} className="btn btn-outline">
                <FileXls size={16} weight="duotone" color="#2E4F7C" /> Export Excel
              </button>
            </div>
          </div>
          <div className="h-scroll">
            <ReportBody active={active} data={data} />
          </div>
          {/* Alokasi Bagi Hasil Unit (30/70) */}
          {active === "laba-rugi" && activeUnitId && (
            <div className="mt-6 p-4 rounded-lg" data-testid="bagi-hasil-info"
                 style={{ background: "#EEF3F9", border: "1px solid var(--border)" }}>
              <h4 className="font-heading font-semibold mb-2" style={{ color: "#2E4F7C" }}>
                Alokasi Bagi Hasil Unit Usaha {groupKey}:
              </h4>
              <ol className="text-sm space-y-1 ml-5" style={{ listStyleType: "decimal" }}>
                <li>Pengelola Unit (30%) = <b style={{ color: "#2E4F7C" }} data-testid="share-pengelola">{fmtRp(Math.round((data.laba_bersih || 0) * 0.30))}</b></li>
                <li>BUMDES (70%) = <b style={{ color: "#3A5A7D" }} data-testid="share-bumdes">{fmtRp(Math.round((data.laba_bersih || 0) * 0.70))}</b></li>
              </ol>
            </div>
          )}
          {/* Alokasi Bagi Hasil BUMDES 6-way (untuk Laba Rugi BUMDES) */}
          {active === "laba-rugi" && !activeUnitId && !isPengelola && (
            <div className="mt-6 p-4 rounded-lg" data-testid="alokasi-bumdes-info"
                 style={{ background: "#EEF3F9", border: "1px solid var(--border)" }}>
              <h4 className="font-heading font-semibold mb-2" style={{ color: "#2E4F7C" }}>
                Alokasi Bagi Hasil Usaha BUMDES:
              </h4>
              <ol className="text-sm space-y-1 ml-5" style={{ listStyleType: "decimal" }}>
                {[
                  ["PADes", 30, "#4C86C4"],
                  ["Modal BUMDES", 18, "#3A5A7D"],
                  ["Penasihat", 7, "#2E4F7C"],
                  ["Pengawas", 5, "#2E4F7C"],
                  ["Pengurus", 35, "#8A4141"],
                  ["Dana Sosial", 5, "#6B5F8A"],
                ].map(([label, pct, color]) => (
                  <li key={label}>{label} ({pct}%) = <b style={{ color }} data-testid={`share-${label.toLowerCase().replace(/ /g, "-")}`}>{fmtRp(Math.round((data.laba_bersih || 0) * pct / 100))}</b></li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Tutup Buku Bulanan (admin only) */}
      {isAdmin && (
        <div className="card" data-testid="close-period-card">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={20} weight="duotone" color="#8A4141" />
            <h3 className="font-heading font-semibold">Tutup Buku Bulanan</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Generate jurnal penutup fisik (tutup pendapatan/beban ke Ikhtisar L/R, transfer ke Saldo Laba) untuk 1 grup 1 bulan.
            Grup harus punya akun ber-subcategory <b>ikhtisar_laba_rugi</b> dan <b>saldo_laba</b>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Periode</label>
              <input type="month" className="input" data-testid="close-period-input"
                     value={closePeriod} onChange={(e) => setClosePeriod(e.target.value)} />
            </div>
            <div>
              <label className="label">Kelompok</label>
              <select className="select" data-testid="close-group-select"
                      value={closeGroup} onChange={(e) => setCloseGroup(e.target.value)}>
                <option value="BUMDES">BUMDES</option>
                {units.map(u => <option key={u.code} value={u.code}>{u.code} - {u.name}</option>)}
              </select>
            </div>
            <button data-testid="btn-close-period" onClick={doClose} className="btn btn-primary">
              <Lock size={16} /> Tutup Buku
            </button>
          </div>
          {closedList.length > 0 && (
            <div className="mt-4">
              <p className="label mb-2">Periode Sudah Ditutup ({closedList.length})</p>
              <div className="flex flex-wrap gap-2">
                {closedList.map(c => (
                  <div key={c.period + c.group} className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
                       style={{ background: "#EEF3F9", border: "1px solid var(--border)" }}>
                    <Lock size={12} color="#8A4141" />
                    <span><b>{c.period}</b> · {c.group} · Laba {fmtRp(c.laba_bersih || 0)}</span>
                    <button data-testid={`reopen-${c.period}-${c.group}`}
                            onClick={() => doReopen(c.period, c.group)}
                            className="text-xs" style={{ color: "#8A4141", textDecoration: "underline" }}>
                      Batalkan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportBody({ active, data }) {
  if (active === "laba-rugi") {
    return (
      <table className="tbl" style={{ minWidth: 480 }}>
        <thead><tr><th>Kode</th><th>Nama Akun</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>PENDAPATAN</td></tr>
          {data.pendapatan.map((it) => (<tr key={it.code}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Pendapatan</td><td className="num font-semibold">{fmtRp(data.total_pendapatan)}</td></tr>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>BEBAN</td></tr>
          {data.beban.map((it) => (<tr key={it.code}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Beban</td><td className="num font-semibold">{fmtRp(data.total_beban)}</td></tr>
          <tr style={{ background: "#DCE8FE" }}><td></td><td className="font-bold" style={{ color: "#2E4F7C" }}>LABA / (RUGI) BERSIH</td><td className="num font-bold" style={{ color: "#2E4F7C" }}>{fmtRp(data.laba_bersih)}</td></tr>
        </tbody>
      </table>
    );
  }
  if (active === "neraca") {
    return (
      <>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>Per: {data.as_of}</p>
        <table className="tbl" style={{ minWidth: 480 }}>
          <thead><tr><th>Kode</th><th>Akun</th><th className="num">Jumlah</th></tr></thead>
          <tbody>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>ASET</td></tr>
            {data.aset.map((it) => (<tr key={`a-${it.code}`}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Aset</td><td className="num font-semibold">{fmtRp(data.total_aset)}</td></tr>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>KEWAJIBAN</td></tr>
            {data.kewajiban.map((it) => (<tr key={`k-${it.code}`}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Kewajiban</td><td className="num font-semibold">{fmtRp(data.total_kewajiban)}</td></tr>
            <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>EKUITAS</td></tr>
            {data.ekuitas.map((it, i) => (<tr key={`e-${it.code}-${i}`}><td>{it.code}</td><td>{it.name}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
            <tr><td></td><td className="font-semibold">Total Ekuitas</td><td className="num font-semibold">{fmtRp(data.total_ekuitas)}</td></tr>
            <tr style={{ background: "#DCE8FE" }}><td></td><td className="font-bold">TOTAL PASIVA</td><td className="num font-bold">{fmtRp(data.total_pasiva)}</td></tr>
          </tbody>
        </table>
        <p className="text-xs mt-3" style={{ color: data.balanced ? "#2E4F7C" : "#D97878" }}>
          {data.balanced ? "✓ Neraca seimbang" : "⚠ Neraca belum seimbang — periksa transaksi."}
        </p>
      </>
    );
  }
  if (active === "arus-kas") {
    return (
      <table className="tbl" style={{ minWidth: 480 }}>
        <thead><tr><th>Tanggal</th><th>Keterangan</th><th className="num">Jumlah</th></tr></thead>
        <tbody>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>KAS MASUK</td></tr>
          {data.kas_masuk.map((it, i) => (<tr key={`m-${it.date}-${i}`}><td>{it.date}</td><td>{it.description}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Kas Masuk</td><td className="num font-semibold">{fmtRp(data.total_masuk)}</td></tr>
          <tr><td colSpan={3} className="font-semibold" style={{ background: "#EEF3F9" }}>KAS KELUAR</td></tr>
          {data.kas_keluar.map((it, i) => (<tr key={`k-${it.date}-${i}`}><td>{it.date}</td><td>{it.description}</td><td className="num">{fmtRp(it.amount)}</td></tr>))}
          <tr><td></td><td className="font-semibold">Total Kas Keluar</td><td className="num font-semibold">{fmtRp(data.total_keluar)}</td></tr>
          <tr style={{ background: "#DCE8FE" }}><td></td><td className="font-bold">ARUS KAS BERSIH</td><td className="num font-bold">{fmtRp(data.arus_kas_bersih)}</td></tr>
        </tbody>
      </table>
    );
  }
  if (active === "perubahan-ekuitas") {
    const row = (item) => item.kind === "section" ? (
      <tr key={item.no} style={{ background: "#DCE8FE", fontWeight: 700 }}><td>{item.no}</td><td>{item.label}</td><td></td></tr>
    ) : (
      <tr key={item.no} style={item.bold ? { background: "#EEF3F9", fontWeight: 700 } : undefined}>
        <td>{item.no}</td><td style={{ paddingLeft: 12 + (item.indent || 0) * 20 }}>{item.label}</td><td className="num">{fmtRp(item.amount)}</td>
      </tr>
    );
    return <table className="tbl" style={{ minWidth: 620 }}><thead><tr><th>No.</th><th>Uraian</th><th className="num">Jumlah (Rp)</th></tr></thead><tbody>{data.rows.map(row)}</tbody></table>;
  }
  if (active === "calk") {
    return (
      <div className="space-y-5 text-sm">
        <section>
          <h4 className="font-heading font-semibold mb-2">1. Informasi Umum</h4>
          <ul className="space-y-1">
            {Object.entries(data.informasi_umum).map(([k, v]) => (
              <li key={k}>• <b>{k.replace(/_/g, " ")}</b>: {v}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="font-heading font-semibold mb-2">2. Ringkasan Kinerja</h4>
          <table className="tbl">
            <tbody>
              {Object.entries(data.ringkasan_kinerja).map(([k, v]) => (
                <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="num">{fmtRp(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h4 className="font-heading font-semibold mb-2">3. Kebijakan Akuntansi</h4>
          <ul className="space-y-1">
            {data.kebijakan_akuntansi.map((k) => <li key={k}>• {k}</li>)}
          </ul>
        </section>
      </div>
    );
  }
  return null;
}
