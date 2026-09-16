import { useEffect, useMemo, useState } from "react";
import api, { fmtRp, ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { TrendUp, TrendDown, Coin, Storefront, ReceiptX, CalendarBlank, Lock } from "@phosphor-icons/react";

const COLORS = ["#7BA7E1", "#A8DADC", "#E1C3F4", "#E8B872", "#DCE8FE", "#5C6E5E"];
const TOOLTIP_STYLE = { background: "white", border: "1px solid #E8EAE6", borderRadius: 8 };
const PIE_LEGEND_STYLE = { fontSize: 11 };
const yTickFormatter = (v) => (v >= 1e6 ? `${(v/1e6).toFixed(1)}Jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}rb` : v);

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const YEAR_MIN = 2022, YEAR_MAX = 2030;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

// granularity → what backend returns (day/month)
// bucket → how frontend re-aggregates for chart (day/week/month)
const PERIOD_OPTIONS = [
  { key: "hari_ini", label: "Hari ini", granularity: "day", bucket: "day" },
  { key: "minggu_ini", label: "Minggu ini", granularity: "day", bucket: "day" },
  { key: "bulan_ini", label: "Bulan ini", granularity: "day", bucket: "week" },
  { key: "3bulan", label: "3 bulan terakhir", granularity: "month", bucket: "month" },
  { key: "6bulan", label: "6 bulan terakhir", granularity: "month", bucket: "month" },
  { key: "bulanan", label: "Bulanan (pilih bulan)", granularity: "day", bucket: "week" },
  { key: "tahunan", label: "Tahunan (pilih tahun)", granularity: "month", bucket: "month" },
  { key: "custom", label: "Custom (tanggal awal – akhir)", granularity: "month", bucket: "month" },
];

function pad(n) { return String(n).padStart(2, "0"); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function computeRange({ period, month, year, customStart, customEnd }) {
  const now = new Date();
  const endToday = iso(now);
  switch (period) {
    case "hari_ini":
      return { start: endToday, end: endToday };
    case "minggu_ini": {
      const day = now.getDay() || 7; // Sunday=0 → 7
      const start = new Date(now); start.setDate(now.getDate() - (day - 1));
      return { start: iso(start), end: endToday };
    }
    case "bulan_ini": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: iso(start), end: endToday };
    }
    case "3bulan": {
      const start = new Date(now); start.setMonth(now.getMonth() - 2); start.setDate(1);
      return { start: iso(start), end: endToday };
    }
    case "6bulan": {
      const start = new Date(now); start.setMonth(now.getMonth() - 5); start.setDate(1);
      return { start: iso(start), end: endToday };
    }
    case "bulanan": {
      // month = 1..12 within current year
      const y = now.getFullYear();
      const start = new Date(y, month - 1, 1);
      const end = new Date(y, month, 0); // last day
      return { start: iso(start), end: iso(end) };
    }
    case "tahunan": {
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    case "custom":
      return { start: customStart, end: customEnd };
    default:
      return { start: undefined, end: endToday };
  }
}

// Re-bucket a list of {month: "YYYY-MM-DD"|"YYYY-MM", pendapatan, beban}
// into the target granularity for the chart.
function bucketize(list, targetBucket) {
  if (!list || list.length === 0) return [];
  if (targetBucket === "day" || targetBucket === "month") {
    // Already in the right shape, just rename label for readability
    return list.map((r) => ({ ...r, month: labelize(r.month, targetBucket) }));
  }
  // targetBucket === "week": input is per-day rows
  const map = new Map();
  for (const r of list) {
    const d = new Date(r.month);
    if (isNaN(d.getTime())) continue;
    // week starting Monday
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day - 1));
    const key = iso(monday);
    const prev = map.get(key) || { pendapatan: 0, beban: 0 };
    map.set(key, {
      pendapatan: prev.pendapatan + (r.pendapatan || 0),
      beban: prev.beban + (r.beban || 0),
    });
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ month: `Minggu ${new Date(k).getDate()}/${new Date(k).getMonth() + 1}`, ...v }));
}

function labelize(key, bucket) {
  if (bucket === "day") {
    // YYYY-MM-DD → DD/MM
    const parts = key.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return key;
  }
  if (bucket === "month") {
    // YYYY-MM → Mmm YY
    const parts = key.split("-");
    if (parts.length >= 2) {
      const m = Number(parts[1]);
      return `${MONTHS[m - 1]?.slice(0, 3) || m} ${parts[0].slice(2)}`;
    }
    return key;
  }
  return key;
}

function periodLabel(state) {
  const opt = PERIOD_OPTIONS.find(p => p.key === state.period);
  if (state.period === "bulanan") return `${MONTHS[state.month - 1]} ${new Date().getFullYear()}`;
  if (state.period === "tahunan") return `Tahun ${state.year}`;
  if (state.period === "custom") return `${state.customStart} s.d. ${state.customEnd}`;
  return opt?.label || "";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [state, setState] = useState({
    period: "tahunan",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    customStart: `${YEAR_MIN}-01-01`,
    customEnd: iso(new Date()),
  });

  const currentOpt = PERIOD_OPTIONS.find(p => p.key === state.period) || PERIOD_OPTIONS[6];

  useEffect(() => {
    setLoading(true);
    const { start, end } = computeRange(state);
    api.get("/reports/dashboard", {
      params: { start_date: start, end_date: end, granularity: currentOpt.granularity },
    }).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [state, currentOpt.granularity]);

  const kpis = useMemo(() => data ? [
    { key: "pendapatan", label: "Total Pendapatan", value: data.total_pendapatan, icon: TrendUp, bg: "var(--primary-light)", color: "#2E4F7C" },
    { key: "beban", label: "Total Beban", value: data.total_beban, icon: TrendDown, bg: "#FDE9D0", color: "#4C86C4" },
    { key: "laba", label: "Laba Bersih", value: data.laba_bersih, icon: Coin, bg: "var(--secondary-blue)", color: "#3A5A7D" },
    { key: "tx", label: "Jumlah Transaksi", value: data.total_transactions, icon: ReceiptX, bg: "var(--secondary-purple)", color: "#2E4F7C", isCount: true },
  ] : [], [data]);

  // Aggregate chart data based on selected bucket, and pick chart type
  const chartData = useMemo(() => {
    if (!data?.monthly) return [];
    return bucketize(data.monthly, currentOpt.bucket);
  }, [data, currentOpt.bucket]);
  const useBar = chartData.length <= 1;

  if (loading && !data) return <div className="text-sm">Memuat dashboard...</div>;
  if (!data) return <div className="text-sm">Tidak ada data.</div>;

  const jabatan = ROLE_LABELS[user?.role] || "Pengguna";
  const pLabel = periodLabel(state);

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Banner: Periode Terkunci */}
      {user?.blocked_periods && user.blocked_periods.length > 0 && (
        <div className="card fade-in" data-testid="blocked-periods-banner"
             style={{ background: "#FDECEA", border: "1px solid #f5c6c1" }}>
          <div className="flex items-start gap-3">
            <Lock size={22} weight="duotone" color="#8A4141" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="font-heading font-semibold" style={{ color: "#8A4141" }}>
                {user.blocked_periods.length} periode terkunci oleh Admin
              </p>
              <p className="text-sm mt-1" style={{ color: "#8A4141" }}>
                Anda tidak dapat menambah, mengubah, atau menghapus transaksi pada:{" "}
                <b>{
                  user.blocked_periods
                    .slice()
                    .sort()
                    .map(p => {
                      const [y, m] = p.split("-");
                      return `${MONTHS[Number(m) - 1]} ${y}`;
                    })
                    .join(" · ")
                }</b>
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="label mb-1">Selamat Datang</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold page-h1" data-testid="dashboard-greeting">
          {jabatan}, ini ringkasan data BUMDES.
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          BUMDES Karya Raharja • {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Period selector */}
      <div className="card card-sm" data-testid="period-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="label flex items-center gap-1">
              <CalendarBlank size={14} weight="duotone" /> Periode
            </label>
            <select data-testid="period-select" className="select"
                    value={state.period}
                    onChange={(e) => setState(s => ({ ...s, period: e.target.value }))}>
              {PERIOD_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {state.period === "bulanan" && (
            <div className="min-w-[160px]">
              <label className="label">Pilih Bulan</label>
              <select data-testid="period-month" className="select"
                      value={state.month}
                      onChange={(e) => setState(s => ({ ...s, month: Number(e.target.value) }))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          )}

          {state.period === "tahunan" && (
            <div className="min-w-[140px]">
              <label className="label">Pilih Tahun</label>
              <select data-testid="period-year" className="select"
                      value={state.year}
                      onChange={(e) => setState(s => ({ ...s, year: Number(e.target.value) }))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          {state.period === "custom" && (
            <>
              <div className="min-w-[160px]">
                <label className="label">Tanggal Awal</label>
                <input data-testid="period-custom-start" type="date" className="input"
                       min={`${YEAR_MIN}-01-01`} max={`${YEAR_MAX}-12-31`}
                       value={state.customStart}
                       onChange={(e) => setState(s => ({ ...s, customStart: e.target.value }))} />
              </div>
              <div className="min-w-[160px]">
                <label className="label">Tanggal Akhir</label>
                <input data-testid="period-custom-end" type="date" className="input"
                       min={`${YEAR_MIN}-01-01`} max={`${YEAR_MAX}-12-31`}
                       value={state.customEnd}
                       onChange={(e) => setState(s => ({ ...s, customEnd: e.target.value }))} />
              </div>
            </>
          )}

          <div className="text-xs px-3 py-2 rounded-lg" data-testid="period-label"
               style={{ background: "var(--primary-light)", color: "#2E4F7C", fontWeight: 600 }}>
            {pLabel}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.key} className="card card-sm" data-testid={`kpi-${k.key}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                  <Icon size={18} weight="duotone" color={k.color} />
                </div>
              </div>
              <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>{k.label}</p>
              <p className="font-heading text-xl sm:text-2xl font-bold mt-1 tabular-nums">
                {k.isCount ? k.value : fmtRp(k.value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="font-heading text-lg font-semibold mb-4" data-testid="trend-title">
            Pendapatan &amp; Beban ({pLabel})
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="99%" height={280}>
              {useBar ? (
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EAE6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} />
                  <Tooltip formatter={(v) => fmtRp(v)} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="pendapatan" name="Pendapatan" fill="#7BA7E1" radius={[4,4,0,0]} />
                  <Bar dataKey="beban" name="Beban" fill="#E8B872" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8EAE6" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={yTickFormatter} />
                  <Tooltip formatter={(v) => fmtRp(v)} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="pendapatan" name="Pendapatan"
                        stroke="#7BA7E1" strokeWidth={3}
                        dot={{ fill: "#7BA7E1", r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="beban" name="Beban"
                        stroke="#E8B872" strokeWidth={3}
                        dot={{ fill: "#E8B872", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>Belum ada transaksi pada periode ini.</p>
          )}
        </div>

        <div className="card">
          <h3 className="font-heading text-lg font-semibold mb-4">Kontribusi Per Unit</h3>
          <p className="text-[11px] -mt-3 mb-3" style={{ color: "var(--text-muted)" }}>
            Berdasarkan laba bersih per unit (unit dengan laba positif).
          </p>
          {data.unit_summaries?.some(u => (u.laba || 0) > 0) ? (
            <ResponsiveContainer width="99%" height={240}>
              <PieChart>
                <Pie data={data.unit_summaries.filter(u => (u.laba || 0) > 0)}
                     dataKey="laba" nameKey="code" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {data.unit_summaries.filter(u => (u.laba || 0) > 0).map((u, i) => (
                    <Cell key={u.id} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmtRp(v)} />
                <Legend wrapperStyle={PIE_LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm py-16 text-center" style={{ color: "var(--text-muted)" }}>Belum ada unit dengan laba positif pada periode ini.</p>
          )}
        </div>
      </div>

      {/* Data Unit Usaha */}
      <div className="card p-0 overflow-hidden">
        <div className="p-5" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2" data-testid="unit-table-title">
            <Storefront size={20} weight="duotone" color="#2E4F7C" /> Data Unit Usaha
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Periode: {pLabel}</p>
        </div>
        <div className="h-scroll">
          <table className="tbl" data-testid="unit-summary-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Unit Usaha</th>
                <th className="num">Pendapatan</th>
                <th className="num">Beban</th>
                <th className="num">Laba Bersih</th>
              </tr>
            </thead>
            <tbody>
              {data.unit_summaries.map((u) => (
                <tr key={u.id}>
                  <td><span className="badge">{u.code}</span></td>
                  <td className="font-medium">{u.name}</td>
                  <td className="num">{fmtRp(u.pendapatan)}</td>
                  <td className="num">{fmtRp(u.beban)}</td>
                  <td className="num font-semibold" style={{ color: u.laba >= 0 ? "#2E4F7C" : "#D97878" }}>{fmtRp(u.laba)}</td>
                </tr>
              ))}
              {data.unit_summaries.length > 0 && (() => {
                const totP = data.unit_summaries.reduce((s, u) => s + (u.pendapatan || 0), 0);
                const totB = data.unit_summaries.reduce((s, u) => s + (u.beban || 0), 0);
                const totL = data.unit_summaries.reduce((s, u) => s + (u.laba || 0), 0);
                return (
                  <tr data-testid="unit-total-row" style={{ background: "#DCE8FE" }}>
                    <td></td>
                    <td className="font-bold" style={{ color: "#2E4F7C" }}>TOTAL 6 UNIT USAHA</td>
                    <td className="num font-bold tabular-nums" style={{ color: "#2E4F7C" }}>{fmtRp(totP)}</td>
                    <td className="num font-bold tabular-nums" style={{ color: "#2E4F7C" }}>{fmtRp(totB)}</td>
                    <td className="num font-bold tabular-nums" style={{ color: totL >= 0 ? "#2E4F7C" : "#D97878" }}>{fmtRp(totL)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
