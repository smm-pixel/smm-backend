import { useEffect, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Clock,
  Send,
} from "lucide-react";
import api, { fmtRp, fmtDateTime, getApiError } from "@/lib/api.js";

export default function DashboardStok() {
  const [summary, setSummary] = useState({
    total_belum_sinkron: 0,
    pending_count: 0,
    last_synced_at: null,
  });
  const [lowStock, setLowStock] = useState([]);
  const [activities, setActivities] = useState([]);

  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");

  // Load the weekly sync summary from the backend. Endpoints may not exist yet,
  // so failures fall back to a clean zeroed state instead of crashing.
  useEffect(() => {
    let active = true;
    api
      .get("/stok/masuk/ringkasan-mingguan")
      .then((r) => {
        if (!active) return;
        const data = r.data ?? {};
        setSummary({
          total_belum_sinkron: data.total_belum_sinkron ?? data.total_biaya ?? 0,
          pending_count: data.pending_count ?? data.jumlah_item ?? 0,
          last_synced_at: data.last_synced_at ?? null,
        });
        setLowStock(data.low_stock ?? []);
        setActivities(data.recent_activities ?? []);
      })
      .catch(() => {
        /* backend inventory endpoints not wired yet — keep placeholder state */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    try {
      // credentials are sent automatically via the shared axios client
      // (withCredentials: true), passing the HttpOnly JWT session cookie.
      const r = await api.post("/stok/masuk/sinkronisasi-mingguan");
      setSynced(true);
      setSummary((s) => ({
        ...s,
        total_belum_sinkron: 0,
        pending_count: 0,
        last_synced_at: r.data?.synced_at ?? new Date().toISOString(),
      }));
    } catch (err) {
      setError(getApiError(err, "Gagal mengirim rekapitulasi ke Keuangan Unit."));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section data-testid="stok-dashboard-page" className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Dashboard &amp; Sinkronisasi</h1>
        <p className="text-sm text-slate-500">
          Rekapitulasi pembelian dan pergerakan stok Unit Toko Offline (UU05).
        </p>
      </header>

      {/* High-visibility weekly finance sync card */}
      <div className="overflow-hidden rounded-2xl border border-brand/30 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-light/60 px-6 py-3">
          <RefreshCw size={16} className="text-brand-dark" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-brand-dark">
            Status Sinkronisasi Keuangan Mingguan &mdash; Unit UU05
          </h2>
        </div>

        <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">Total Pembelian Minggu Ini (Belum Sinkron)</p>
              {summary.pending_count > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <Clock size={12} aria-hidden="true" />
                  {summary.pending_count} tertunda
                </span>
              )}
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              {fmtRp(summary.total_belum_sinkron)}
            </p>
            {summary.last_synced_at && (
              <p className="mt-1 text-xs text-slate-400">
                Sinkronisasi terakhir: {fmtDateTime(summary.last_synced_at)}
              </p>
            )}
          </div>

          <div className="md:text-right">
            {synced ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={18} aria-hidden="true" />
                Sukses Terbuku di Keuangan
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send size={18} aria-hidden="true" />
                    Kirim Rekapitulasi ke Keuangan Unit
                  </>
                )}
              </button>
            )}
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low stock alerts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Notifikasi Stok Minimum</h3>
          </div>
          {lowStock.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              Tidak ada produk di bawah stok minimum.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-slate-400" aria-hidden="true" />
                    <span className="text-sm text-slate-700">{item.name}</span>
                  </div>
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                    Sisa {item.stock} {item.unit || ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activities */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock size={16} className="text-slate-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-900">Aktivitas Terbaru</h3>
          </div>
          {activities.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
              Belum ada aktivitas tercatat.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activities.map((act) => (
                <li key={act.id} className="py-2.5">
                  <p className="text-sm text-slate-700">{act.description}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(act.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
