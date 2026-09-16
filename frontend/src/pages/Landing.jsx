import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { fmtRp, API } from "@/lib/api";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { ArrowRight, Buildings, HandHeart, ChartLineUp } from "@phosphor-icons/react";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

export default function Landing() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    axios.get(`${API}/public/summary`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.message));
  }, []);

  const trend = (data?.trend || []).map(t => ({
    label: MONTH_LABELS[Number(t.month.slice(5,7)) - 1] || t.month,
    pendapatan: t.pendapatan, beban: t.beban,
  }));
  // Grafik selalu memakai chart batang penuh 12 bulan supaya proporsional.

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="landing-page">
      {/* ===== Subtle batik motif background (SVG, tone lavender) ===== */}
      <BatikBackdrop />

      {/* ===== Top bar ===== */}
      <header className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-transparent.png" alt="Logo BUMDES" data-testid="landing-logo"
               className="w-10 h-10 sm:w-12 sm:h-12 object-contain opacity-90" />
          <div className="leading-tight">
            <div className="font-heading font-bold text-sm sm:text-base" style={{ color: "var(--primary-dark)" }}>
              BUMDes Karya Raharja
            </div>
            <div className="text-[10px] sm:text-xs tracking-wide"
                 style={{ color: "var(--text-muted)" }}>Desa Wonoharjo</div>
          </div>
        </div>
        <Link to="/login" data-testid="landing-login-top"
              className="btn btn-outline text-xs sm:text-sm"
              style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(6px)" }}>
          Masuk <ArrowRight size={14} />
        </Link>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-24 pb-8 sm:pb-10 text-center">
        <div className="inline-block px-3.5 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold tracking-[0.18em] mb-6 fade-slow"
             style={{ background: "var(--primary-light)", color: "var(--primary-dark)" }}>
          PAPAN KINERJA · BUMDes · TAHUN {data?.year || new Date().getFullYear()}
        </div>
        <h1 className="modern-brand-title text-3xl sm:text-5xl lg:text-6xl leading-[1.08] fade-slow"
            style={{ color: "var(--primary-dark)", animationDelay: "0.08s" }}>
          SIA BUMDes{" "}
          <span style={{ background: "linear-gradient(120deg, #4A9DC1 0%, #7BC0DC 40%, #A8DDD5 80%, #F4C48A 100%)",
                         WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Karya Raharja
          </span>
        </h1>
        <p className="mt-5 sm:mt-6 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto fade-slow"
           style={{ color: "var(--text-secondary)", animationDelay: "0.16s" }}>
          Sistem Informasi Akuntansi &amp; Transparansi Keuangan Terintegrasi.
          <br />
          Berdaya dari Desa, Berkontribusi untuk Wonoharjo.
        </p>
      </section>

      {/* ===== Angka utama (agregat BUMDES pusat) ===== */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-6" data-testid="landing-stats">
        {err && <p className="text-center text-sm" style={{ color: "var(--status-error)" }}>Gagal memuat data ringkasan.</p>}
        {!data && !err && <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>Memuat...</p>}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={ChartLineUp} label="Total Pendapatan"
                      value={fmtRp(data.total_pendapatan)}
                      tint="#DCEFF7" iconColor="#3F86A6"
                      delay={0.24} testId="stat-pendapatan" />
            <StatCard icon={ChartLineUp} label="Total Beban"
                      value={fmtRp(data.total_beban)}
                      tint="#FDF1E4" iconColor="#B47536"
                      delay={0.32} testId="stat-beban" />
            <StatCard icon={Buildings} label="Laba Bersih"
                      value={fmtRp(data.laba_bersih)}
                      tint="#DFF3EC" iconColor="#3E8B77"
                      big={true} delay={0.40} testId="stat-laba" />
            <StatCard icon={HandHeart} label="Kontribusi PADes (est.)"
                      value={fmtRp(data.pades_estimasi)}
                      tint="#FFF1D6" iconColor="#B0873C"
                      delay={0.48} testId="stat-pades" />
          </div>
        )}
      </section>

      {/* ===== Chart tren (compact) ===== */}
      {data && trend.length > 0 && (
        <section className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 pt-4 pb-10 sm:pb-14">
          <div className="rounded-2xl p-4 sm:p-5"
               style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)",
                        border: "1px solid var(--border)" }}>
            <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="font-heading text-base sm:text-lg font-semibold"
                    style={{ color: "var(--primary-dark)" }}>
                  Tren Pendapatan &amp; Beban {data.year}
                </h3>
                <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Diperbarui langsung dari transaksi resmi.
                </p>
              </div>
            </div>
            <ResponsiveContainer width="99%" height={220}>
              <LineChart data={trend} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                       tickFormatter={(v) => v >= 1000000 ? `${Math.round(v/1_000_000)}jt` : v >= 1000 ? `${Math.round(v/1000)}rb` : v}
                       width={44} />
                <Tooltip formatter={(v) => fmtRp(v)}
                         contentStyle={{ background: "white", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                <Line type="monotone" dataKey="pendapatan" name="Pendapatan" stroke="#4A9DC1" strokeWidth={2.4}
                      dot={{ r: 3, strokeWidth: 2, stroke: "#4A9DC1", fill: "#fff" }}
                      activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="beban" name="Beban" stroke="#E8B872" strokeWidth={2.4}
                      dot={{ r: 3, strokeWidth: 2, stroke: "#E8B872", fill: "#fff" }}
                      activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ===== Bagian 3 · Narasi Komitmen ===== */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
        <div className="rounded-2xl p-6 sm:p-10"
             style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(6px)",
                      border: "1px solid var(--border)" }}>
          <h3 className="font-heading text-xl sm:text-3xl font-bold mb-4 text-center sm:text-left"
              style={{ color: "var(--primary-dark)" }}>
            Akuntabilitas Real-Time Melalui Inovasi Digital
          </h3>
          <blockquote
            data-testid="narasi-komitmen"
            className="relative rounded-xl px-5 sm:px-8 py-6 sm:py-7 mb-6 overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(220,239,247,0.85) 0%, rgba(223,243,236,0.75) 55%, rgba(255,241,214,0.75) 100%)",
              backdropFilter: "blur(8px)",
              borderLeft: "4px solid var(--primary-dark)",
              boxShadow:
                "0 4px 18px rgba(46,79,124,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {/* Ornamen tanda kutip pembuka */}
            <span
              aria-hidden="true"
              className="absolute -top-3 left-3 font-heading select-none pointer-events-none"
              style={{
                fontSize: "5rem",
                lineHeight: 1,
                color: "var(--primary-dark)",
                opacity: 0.14,
              }}
            >
              &ldquo;
            </span>
            {/* Ornamen tanda kutip penutup */}
            <span
              aria-hidden="true"
              className="absolute -bottom-8 right-4 font-heading select-none pointer-events-none"
              style={{
                fontSize: "5rem",
                lineHeight: 1,
                color: "var(--primary-dark)",
                opacity: 0.14,
              }}
            >
              &rdquo;
            </span>
            <div
              className="relative font-body text-sm sm:text-base leading-relaxed text-justify space-y-3.5 tracking-[-0.01em]"
              style={{ color: "var(--text-secondary)" }}
            >
              <p>
                SIA BUMDes Karya Raharja adalah wujud nyata komitmen BUMDes Karya Raharja Desa
                Wonoharjo dalam menerapkan tata kelola keuangan yang transparan, akuntable, dan
                profesional dengan berpedoman pada Kepmendesa PDTT No. 136 Tahun 2022.
              </p>
              <p>
                Data yang ditampilkan di atas adalah data yang diperoleh secara{" "}
                <strong className="italic font-bold" style={{ color: "var(--primary-dark)" }}>
                  real-time
                </strong>{" "}
                dari hasil pencatatan transaksi aktivitas usaha BUMDes.
              </p>
              <p>
                Kehadiran platform ini memastikan setiap rupiah pendapatan dioptimalkan untuk
                meminimalkan beban, memaksimalkan laba bersih, dan memperbesar kontribusi PADes
                demi pembangunan desa yang berkelanjutan.
              </p>
            </div>
          </blockquote>
          <div className="text-center sm:text-left">
            <Link to="/login" data-testid="landing-login-bottom" className="btn btn-primary">
              Masuk ke Dasbor <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-center">
        <p className="text-[11px] sm:text-xs" style={{ color: "var(--text-muted)" }}>
          © {new Date().getFullYear()} BUMDes Karya Raharja Wonoharjo. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tint, iconColor, big, testId, delay = 0 }) {
  return (
    <div data-testid={testId}
         className="rounded-2xl p-4 sm:p-5 stat-card fade-slow"
         style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(6px)",
                  border: "1px solid var(--border)", animationDelay: `${delay}s`,
                  transition: "transform 0.35s cubic-bezier(.2,.8,.2,1), box-shadow 0.35s ease" }}>
      <div className="flex items-center justify-between mb-2.5 sm:mb-3.5">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-transform"
             style={{ background: tint }}>
          <Icon size={20} weight="duotone" color={iconColor} />
        </div>
      </div>
      <div className="text-[10px] sm:text-[11px] tracking-[0.14em] font-semibold uppercase leading-tight"
           style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className={`font-heading font-bold tabular-nums mt-1 leading-tight ${big ? "text-xl sm:text-3xl" : "text-lg sm:text-2xl"}`}
           style={{ color: big ? "var(--primary-dark)" : "var(--text-primary)",
                    letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

/* Backdrop — gradient ocean lembut tanpa motif SVG. */
function BatikBackdrop() {
  return (
    <>
      {/* Gradient ocean lembut — biru pesisir turun perlahan ke pasir hangat */}
      <div className="absolute inset-0 pointer-events-none"
           style={{
             background:
               "linear-gradient(180deg, #F2F7FB 0%, #E8F1F7 25%, #E1ECF4 50%, #E6EDF2 72%, #EFEDE4 88%, #F6EEDD 100%)"
           }} />

      {/* Highlight cahaya ocean di pojok kiri atas */}
      <div className="absolute pointer-events-none"
           style={{
             top: 0, left: 0, width: "65%", height: "60%",
             background:
               "radial-gradient(ellipse at 15% 5%, rgba(198,225,239,0.55) 0%, rgba(220,239,247,0.18) 45%, rgba(220,239,247,0) 75%)",
           }} />
      {/* Highlight pasir sunset di pojok kanan bawah */}
      <div className="absolute pointer-events-none"
           style={{
             bottom: 0, right: 0, width: "60%", height: "55%",
             background:
               "radial-gradient(ellipse at 95% 95%, rgba(250,235,205,0.5) 0%, rgba(250,235,205,0.15) 45%, rgba(255,241,214,0) 75%)",
           }} />
      {/* Overlay lembut horizontal — menyatukan langit & pantai */}
      <div className="absolute inset-x-0 pointer-events-none"
           style={{
             top: "35%", height: "35%",
             background:
               "linear-gradient(180deg, rgba(232,241,247,0) 0%, rgba(232,241,247,0.35) 50%, rgba(232,241,247,0) 100%)",
           }} />
    </>
  );
}
