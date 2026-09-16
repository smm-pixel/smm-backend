import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const today = () => new Date().toISOString().slice(0, 10);
import {
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Loader2,
} from "lucide-react";
import api, { request, getApiError, fmtRp, fmtDateTime } from "@/lib/api.js";

const UNIT_USAHA_ID = "UU05";

// "in" -> Stok Masuk (pembelian), "out" -> Stok Keluar (pengurangan)
const MUTATION_META = {
  in: {
    label: "Stok Masuk",
    icon: ArrowDownToLine,
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  out: {
    label: "Stok Keluar",
    icon: ArrowUpFromLine,
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
};

export default function StockLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalType, setModalType] = useState(null); // "in" | "out" | null

  const loadLogs = async () => {
    setLoading(true);
    setLoadError("");
    try {
      // Session cookie travels automatically via withCredentials.
      const data = await request(api.get("/stok/mutasi"));
      setLogs(Array.isArray(data) ? data : data?.items ?? []);
    } catch (error) {
      setLoadError(getApiError(error, "Gagal memuat riwayat mutasi."));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <section data-testid="stok-logs-page">
      <header className="page-header mb-6 flex w-full flex-wrap items-start justify-between gap-4 text-left">
        <div className="min-w-0 text-left">
          <h1 className="text-xl font-semibold text-slate-900">Log Mutasi Barang</h1>
          <p className="text-sm text-slate-500">Riwayat stok masuk dan keluar Unit Toko Offline (UU05).</p>
        </div>
        <div className="action-group flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setModalType("in")}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <ArrowDownToLine size={16} aria-hidden="true" /> Input Pembelian (Stok Masuk)
          </button>
          <button
            type="button"
            onClick={() => setModalType("out")}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            <ArrowUpFromLine size={16} aria-hidden="true" /> Input Pengurangan (Stok Keluar)
          </button>
        </div>
      </header>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="table-wrap rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Nama Produk</th>
              <th className="px-4 py-3 font-medium">Jenis Mutasi</th>
              <th className="px-4 py-3 text-right font-medium">Jumlah</th>
              <th className="px-4 py-3 text-right font-medium">Total Biaya</th>
              <th className="px-4 py-3 font-medium">Status Keuangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={22} className="mx-auto mb-2 animate-spin text-slate-300" aria-hidden="true" />
                  Memuat riwayat mutasi…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <ArrowLeftRight size={28} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
                  Belum ada mutasi. Catat pembelian atau pengurangan stok untuk memulai.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const meta = MUTATION_META[log.jenis] ?? MUTATION_META.in;
                const Icon = meta.icon;
                const synced = ["terbuku", "terkirim"].includes(log.status_keuangan);
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{fmtDateTime(log.tanggal ?? log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{log.nama_produk ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                        <Icon size={12} aria-hidden="true" /> {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{log.jumlah ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{fmtRp(log.total_biaya)}</td>
                    <td className="px-4 py-3">
                      {synced ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Terkirim ke Keuangan
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                          Belum Sinkron
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalType ? (
        <MutationModal
          type={modalType}
          onClose={() => setModalType(null)}
          onSaved={() => {
            setModalType(null);
            loadLogs();
          }}
        />
      ) : null}
    </section>
  );
}

function MutationModal({ type, onClose, onSaved }) {
  const isIn = type === "in";
  const meta = MUTATION_META[type];
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ produk_id: "", tanggal: today(), jumlah: "", harga_satuan: "", keterangan: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Populate the product picker; cookie auth handled by the shared client.
    request(api.get("/stok/produk"))
      .then((data) => setProducts(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => setProducts([]));
  }, []);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const jumlah = Number(form.jumlah) || 0;
  const hargaSatuan = Number(form.harga_satuan) || 0;
  const totalBiaya = jumlah * hargaSatuan;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        jenis: type, // "in" | "out"
        produk_id: form.produk_id,
        tanggal: form.tanggal,
        jumlah,
        harga_satuan: hargaSatuan,
        total_biaya: totalBiaya,
        keterangan: form.keterangan.trim(),
        unit_usaha_id: UNIT_USAHA_ID,
      };
      await request(api.post("/stok/mutasi", payload));
      onSaved();
    } catch (err) {
      setError(getApiError(err, "Gagal menyimpan mutasi."));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="mutation-modal-title">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white text-left shadow-xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="mutation-modal-title" className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
              {meta.label}
            </span>
            {isIn ? "Input Pembelian" : "Input Pengurangan"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <Field label="Tanggal Transaksi" required>
            <input type="date" value={form.tanggal} onChange={setField("tanggal")} required className="input" />
          </Field>

          <Field label="Produk" required>
            <select value={form.produk_id} onChange={setField("produk_id")} required className="input">
              <option value="" disabled>Pilih produk…</option>
              {products.map((p) => (
                <option key={p.id ?? p.sku} value={p.id ?? p.sku}>
                  {p.nama_produk} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Jumlah" required>
              <input type="number" min="1" step="1" value={form.jumlah} onChange={setField("jumlah")} required className="input" placeholder="0" />
            </Field>
            <Field label={isIn ? "Harga Beli / Satuan" : "Harga / Satuan"} required>
              <input type="number" min="0" step="1" value={form.harga_satuan} onChange={setField("harga_satuan")} required className="input" placeholder="0" />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">Total Biaya</span>
            <span className="text-base font-semibold tabular-nums text-slate-900">{fmtRp(totalBiaya)}</span>
          </div>

          <Field label="Keterangan">
            <input value={form.keterangan} onChange={setField("keterangan")} className="input" placeholder="Opsional, mis. nama pemasok / alasan pengurangan" />
          </Field>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${isIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {saving ? "Menyimpan…" : "Simpan Mutasi"}
            </button>
          </div>
          </div>
        </form>
      </div>
    </div>
    , document.body
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}
