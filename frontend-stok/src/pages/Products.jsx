import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Package, Plus, X, Loader2 } from "lucide-react";
import api, { request, getApiError, fmtRp } from "@/lib/api.js";

const UNIT_USAHA_ID = "UU05";

const KATEGORI_OPTIONS = ["Sembako", "Minuman", "Makanan Ringan", "Rumah Tangga", "Lainnya"];
const SATUAN_OPTIONS = ["pcs", "kg", "pack", "liter", "botol", "dus"];

const EMPTY_FORM = {
  sku: "",
  nama_produk: "",
  kategori: KATEGORI_OPTIONS[0],
  satuan: SATUAN_OPTIONS[0],
  harga_beli: "",
  harga_jual: "",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const loadProducts = async () => {
    setLoading(true);
    setLoadError("");
    try {
      // withCredentials on the shared client sends the HttpOnly session cookie.
      const data = await request(api.get("/stok/produk"));
      setProducts(Array.isArray(data) ? data : data?.items ?? []);
    } catch (error) {
      setLoadError(getApiError(error, "Gagal memuat data produk."));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <section data-testid="stok-products-page">
      <header className="page-header mb-6 flex w-full flex-wrap items-start justify-between gap-4 text-left">
        <div className="min-w-0 text-left">
          <h1 className="text-xl font-semibold text-slate-900">Master Produk &amp; Harga</h1>
          <p className="text-sm text-slate-500">Daftar barang Unit Toko Offline (UU05) beserta stok dan harga.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Plus size={16} aria-hidden="true" /> Tambah Produk Baru
        </button>
      </header>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="table-wrap rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">SKU / Kode</th>
              <th className="px-4 py-3 font-medium">Nama Produk</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 text-right font-medium">Stok Saat Ini</th>
              <th className="px-4 py-3 font-medium">Satuan</th>
              <th className="px-4 py-3 text-right font-medium">Harga Beli</th>
              <th className="px-4 py-3 text-right font-medium">Harga Jual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Loader2 size={22} className="mx-auto mb-2 animate-spin text-slate-300" aria-hidden="true" />
                  Memuat data produk…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Package size={28} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />
                  Belum ada produk. Tambahkan produk baru untuk memulai.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id ?? p.sku} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.sku ?? "-"}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{p.nama_produk ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.kategori ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{p.stok_saat_ini ?? p.stok ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{p.satuan ?? "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtRp(p.harga_beli)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{fmtRp(p.harga_jual)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <ProductModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadProducts();
          }}
        />
      ) : null}
    </section>
  );
}

function ProductModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim(),
        nama_produk: form.nama_produk.trim(),
        kategori: form.kategori,
        satuan: form.satuan,
        harga_beli: Number(form.harga_beli) || 0,
        harga_jual: Number(form.harga_jual) || 0,
        // The backend enforces UU05; this is sent for explicit compatibility.
        unit_id: UNIT_USAHA_ID,
      };
      await request(api.post("/stok/produk", payload));
      onSaved();
    } catch (err) {
      setError(getApiError(err, "Gagal menyimpan produk."));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white text-left shadow-xl sm:max-h-[calc(100dvh-3rem)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="product-modal-title" className="text-base font-semibold text-slate-900">Tambah Produk Baru</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Tutup">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU / Kode" required>
              <input value={form.sku} onChange={setField("sku")} required className="input" placeholder="mis. BRS-5KG" />
            </Field>
            <Field label="Kategori">
              <select value={form.kategori} onChange={setField("kategori")} className="input">
                {KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Nama Produk" required>
            <input value={form.nama_produk} onChange={setField("nama_produk")} required className="input" placeholder="mis. Beras Premium 5 kg" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Satuan">
              <select value={form.satuan} onChange={setField("satuan")} className="input">
                {SATUAN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Harga Beli" required>
              <input type="number" min="0" step="1" value={form.harga_beli} onChange={setField("harga_beli")} required className="input" placeholder="0" />
            </Field>
            <Field label="Harga Jual" required>
              <input type="number" min="0" step="1" value={form.harga_jual} onChange={setField("harga_jual")} required className="input" placeholder="0" />
            </Field>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Batal
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {saving ? "Menyimpan…" : "Simpan Produk"}
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
