import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { fmtRp, fmtDate, API } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import { useConfirm } from "@/components/ConfirmProvider";
import { useSort } from "@/lib/useSort";
import { Plus, Trash, Pencil, Receipt, FileArrowUp, DownloadSimple, FileXls, Paperclip, LinkSimple, GoogleDriveLogo, X } from "@phosphor-icons/react";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const YEAR_MIN = 2022, YEAR_MAX = 2030;
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);
const pad = (n) => String(n).padStart(2, "0");

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  unit_usaha_id: "",
  transaction_type: "",
  description: "",
  amount: "",
  debit_account_code: "",
  credit_account_code: "",
  reference: "",
};

export default function Transactions() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canWrite = can(user, "admin", "direktur", "bendahara", "pengelola");
  const canImport = can(user, "admin", "direktur", "bendahara");
  const canBulkDelete = can(user, "admin", "direktur", "bendahara");
  const isPengelola = user?.role === "pengelola";

  const [txs, setTxs] = useState([]);
  const [units, setUnits] = useState([]);
  const [types, setTypes] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const proofInputRef = useRef(null);
  const [driveStatus, setDriveStatus] = useState(null);

  // Load Drive status for admin
  useEffect(() => {
    if (user?.role === "admin") {
      api.get("/admin/gdrive/status").then(r => setDriveStatus(r.data)).catch(() => {});
    }
  }, [user]);

  const connectDrive = async () => {
    try {
      const r = await api.get("/admin/gdrive/connect");
      window.open(r.data.auth_url, "_blank", "width=560,height=720");
      // Poll status setiap 3 detik untuk update state setelah user selesai OAuth
      const iv = setInterval(async () => {
        try {
          const s = await api.get("/admin/gdrive/status");
          if (s.data?.connected) {
            setDriveStatus(s.data);
            clearInterval(iv);
            notify(`Google Drive terhubung sebagai ${s.data.email}`);
          }
        } catch {}
      }, 3000);
      setTimeout(() => clearInterval(iv), 180000);
    } catch (er) { notify("Gagal memulai koneksi Drive"); }
  };

  const uploadProof = async (tx) => {
    if (driveStatus && !driveStatus.connected && user?.role === "admin") {
      notify("Google Drive belum terhubung. Klik 'Hubungkan Drive' dulu.");
      return;
    }
    const current = (tx.proofs || (tx.proof ? [tx.proof] : []));
    if (current.length >= 3) {
      notify("Maksimal 3 file bukti per transaksi.");
      return;
    }
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
    inp.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 1024 * 1024) { notify("Ukuran file maksimal 1 MB"); return; }
      const fd = new FormData();
      fd.append("file", f);
      try {
        const res = await fetch(`${API}/transactions/${tx.id}/proof`, {
          method: "POST", credentials: "include", body: fd,
        });
        const data = await res.json();
        if (!res.ok) { notify(data.detail || "Gagal upload bukti"); return; }
        const last = (data.proofs || []).slice(-1)[0];
        notify(`Bukti terupload: ${last?.file_name || "OK"}`);
        load();
      } catch (er) { notify("Gagal upload: " + er.message); }
    };
    inp.click();
  };

  const deleteProof = async (tx, fileId, fileName) => {
    if (!(await confirm({ title: "Hapus bukti transaksi", description: `Hapus file bukti "${fileName}"? File juga akan dihapus dari Google Drive.`, confirmLabel: "Hapus", destructive: true }))) return;
    try {
      const res = await fetch(`${API}/transactions/${tx.id}/proofs/${fileId}`, {
        method: "DELETE", credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { notify(data.detail || "Gagal hapus bukti"); return; }
      load();
    } catch (er) { notify("Gagal hapus: " + er.message); }
  };

  // Unified tab + month filter
  const [activeGroup, setActiveGroup] = useState("BUMDES"); // BUMDES | UU01..UU06
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [periodMode, setPeriodMode] = useState("monthly");
  const [customPreset, setCustomPreset] = useState("ytd");
  const [customStart, setCustomStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [t, u, tt, a] = await Promise.all([
      api.get("/transactions"),
      api.get("/unit-usaha"),
      api.get("/transaction-types"),
      api.get("/accounts"),
    ]);
    setTxs(t.data); setUnits(u.data); setTypes(tt.data); setAccounts(a.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sinkronisasi bukti dengan Google Drive di background:
  // jika pemilik akun Drive menghapus file di Drive, entri di aplikasi ikut hilang.
  useEffect(() => {
    if (!can(user, "admin", "direktur", "bendahara", "pengelola")) return;
    let ignore = false;
    (async () => {
      try {
        const r = await api.post("/transactions/verify-proofs");
        if (!ignore && r.data?.removed > 0) load();
      } catch {}
    })();
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Pengelola pinned to own unit tab
  useEffect(() => {
    if (isPengelola && units.length && user?.unit_usaha_id) {
      const own = units.find(x => x.id === user.unit_usaha_id);
      if (own && activeGroup !== own.code) setActiveGroup(own.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPengelola, units, user]);

  // Pre-select pengelola's own unit as default for new form
  useEffect(() => {
    if (isPengelola && user?.unit_usaha_id && !editingId && !form.unit_usaha_id) {
      setForm(f => ({ ...f, unit_usaha_id: user.unit_usaha_id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, editingId]);

  const filteredTypes = useMemo(() => {
    let list;
    if (!form.unit_usaha_id) {
      list = types.filter(t => (t.group || "BUMDES") === "BUMDES");
    } else {
      const unitCode = units.find(u => u.id === form.unit_usaha_id)?.code;
      list = unitCode ? types.filter(t => (t.group || "BUMDES") === unitCode) : [];
    }
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "id", { sensitivity: "base" }));
  }, [types, form.unit_usaha_id, units]);

  const filteredAccounts = useMemo(() => {
    const grp = form.unit_usaha_id
      ? (units.find(u => u.id === form.unit_usaha_id)?.code || "BUMDES")
      : "BUMDES";
    return accounts.filter(a => (a.group || "BUMDES") === grp);
  }, [accounts, form.unit_usaha_id, units]);

  const onTypeChange = (code) => {
    const t = types.find(x => x.code === code);
    setForm(f => ({
      ...f, transaction_type: code,
      debit_account_code: t?.debit || f.debit_account_code,
      credit_account_code: t?.credit || f.credit_account_code,
      description: (editingId ? f.description : t?.name) || f.description,
    }));
  };

  const onUnitChange = (unitId) => {
    setForm(f => ({ ...f, unit_usaha_id: unitId, transaction_type: "" }));
  };

  const openCreate = () => {
    setEditingId(null);
    // Default unit: sesuai tab aktif
    let initialUnit = "";
    if (activeGroup !== "BUMDES") {
      initialUnit = units.find(u => u.code === activeGroup)?.id || "";
    }
    if (isPengelola) initialUnit = user.unit_usaha_id || "";
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10), unit_usaha_id: initialUnit });
    setShowForm(true);
  };

  const openEdit = (tx) => {
    setEditingId(tx.id);
    setForm({
      date: tx.date, unit_usaha_id: tx.unit_usaha_id || "",
      transaction_type: tx.transaction_type || "",
      description: tx.description || "", amount: String(tx.amount || 0),
      debit_account_code: tx.debit_account_code || "",
      credit_account_code: tx.credit_account_code || "",
      reference: tx.reference || "",
    });
    setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, amount: parseFloat(form.amount) };
      if (editingId) await api.put(`/transactions/${editingId}`, body);
      else await api.post("/transactions", body);
      setShowForm(false); setEditingId(null);
      load();
    } catch (er) { notify(er.response?.data?.detail || "Gagal menyimpan"); }
  };

  const del = async (id) => {
    if (!(await confirm({ title: "Hapus transaksi", description: "Transaksi akan dihapus dan tidak dapat dipulihkan.", confirmLabel: "Hapus", destructive: true }))) return;
    await api.delete(`/transactions/${id}`);
    load();
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!(await confirm({ title: "Hapus transaksi terpilih", description: `Hapus ${ids.length} transaksi terpilih? Aksi ini tidak dapat dibatalkan.`, confirmLabel: "Hapus semua", destructive: true }))) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/transactions/${id}`)));
    } catch (er) {
      notify("Sebagian gagal dihapus: " + (er.response?.data?.detail || er.message));
    }
    setSelected(new Set());
    load();
  };

  const downloadTemplate = async () => {
    const res = await fetch(`${API}/transactions/template`, { credentials: "include" });
    if (!res.ok) { notify("Gagal download template"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "Template-Transaksi-BUMDES.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${API}/transactions/import`, {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await res.json();
      if (!res.ok) { notify(data.detail || "Gagal impor"); return; }
      setImportResult(data);
      load();
    } catch (er) { notify("Gagal impor: " + er.message); }
    finally { e.target.value = ""; }
  };

  const unitOf = (id) => units.find(u => u.id === id);
  const accName = (c) => accounts.find(a => a.code === c)?.name || c;
  const canEditRow = (tx) => {
    if (!canWrite) return false;
    if (isPengelola) return tx.unit_usaha_id === user.unit_usaha_id;
    return true;
  };

  // Fixed group order keeps the selector consistent with the UU01–UU06 business units.
  const groupTabs = useMemo(() => {
    const tabs = [
      { key: "BUMDES", label: "BUMDES - Pusat" },
      ...["UU01", "UU02", "UU03", "UU04", "UU05", "UU06"]
        .map(code => {
          const unit = units.find(u => u.code === code);
          return unit ? { key: code, label: `${code} - ${unit.name}` } : null;
        })
        .filter(Boolean),
    ];
    return isPengelola
      ? tabs.filter(t => t.key === units.find(u => u.id === user?.unit_usaha_id)?.code)
      : tabs;
  }, [units, isPengelola, user]);

  // Filter tx by activeGroup + month/year
  const activeUnitId = useMemo(() => {
    if (activeGroup === "BUMDES") return null;
    return units.find(u => u.code === activeGroup)?.id || null;
  }, [activeGroup, units]);

  const monthPrefix = `${year}-${pad(month)}`;
  const customStartDate = customPreset === "ytd" ? `${year}-01-01` : customPreset === "qtd" ? `${year}-${pad(Math.floor((month - 1) / 3) * 3 + 1)}-01` : customPreset === "mtd" ? `${year}-${pad(month)}-01` : customStart;
  const customEndDate = customPreset === "ytd" || customPreset === "qtd" || customPreset === "mtd" ? new Date().toISOString().slice(0, 10) : customEnd;
  const yearPrefix = `${year}-`;
  const filteredTxs = useMemo(() => {
  return txs.filter(t => {
  const inGroup = activeGroup === "BUMDES" ? !t.unit_usaha_id : t.unit_usaha_id === activeUnitId;
  const inPeriod = periodMode === "yearly" ? (t.date || "").startsWith(yearPrefix) : periodMode === "custom" ? (t.date || "") >= customStartDate && (t.date || "") <= customEndDate : (t.date || "").startsWith(monthPrefix);
  return inGroup && inPeriod;
  });
  }, [txs, activeGroup, activeUnitId, monthPrefix, yearPrefix, periodMode, customStartDate, customEndDate]);

  const sortState = useSort(filteredTxs, "date", "desc");

  // Reset selection when tab/month changes
  useEffect(() => { setSelected(new Set()); }, [activeGroup, year, month]);

  const toggleSel = (id) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const exportExcel = async () => {
    if (sortState.sorted.length === 0) {
const proceed = await confirm({
  title: "Export tanpa transaksi",
  description: `Tidak ada transaksi ${activeGroup} pada ${MONTHS[month - 1]} ${year}. Tetap unduh file kosong?`,
  confirmLabel: "Unduh file",
  });
  if (!proceed) return;
    }
  const first = periodMode === "yearly" ? `${year}-01-01` : periodMode === "custom" ? customStartDate : `${year}-${pad(month)}-01`;
  // Use local-date components (avoid toISOString UTC-shift bug)
  const jsLast = periodMode === "yearly" ? new Date(year, 12, 0) : periodMode === "custom" ? new Date(`${customEndDate}T00:00:00`) : new Date(year, month, 0);
    const last = `${jsLast.getFullYear()}-${pad(jsLast.getMonth() + 1)}-${pad(jsLast.getDate())}`;
    const params = new URLSearchParams({ start_date: first, end_date: last });
    if (activeGroup === "BUMDES") params.set("unit_usaha_id", "");
    else if (activeUnitId) params.set("unit_usaha_id", activeUnitId);
    const res = await fetch(`${API}/transactions/export?${params}`, { credentials: "include" });
    if (!res.ok) { notify("Gagal export Excel"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Transaksi_${activeGroup}_${first}_sd_${last}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAll = async () => {
    if (txs.length === 0) {
      notify("Belum ada transaksi di sistem.");
      return;
    }
if (!(await confirm({
  title: "Export semua transaksi",
  description: `Export SEMUA ${txs.length} transaksi dari seluruh unit dan periode ke satu file Excel multi-sheet?`,
  confirmLabel: "Export semua",
  }))) return;
    const res = await fetch(`${API}/transactions/export?all_data=true`, { credentials: "include" });
    if (!res.ok) { notify("Gagal export semua data"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `Transaksi_Semua_Data_${today}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {user?.blocked_periods && user.blocked_periods.length > 0 && (
        <div className="card fade-in" data-testid="tx-blocked-banner"
             style={{ background: "#FDECEA", border: "1px solid #f5c6c1" }}>
          <p className="text-sm" style={{ color: "#8A4141" }}>
            <b>Periode terkunci:</b>{" "}
            {user.blocked_periods.slice().sort().join(", ")}. Anda tidak dapat menambah/mengubah/menghapus transaksi pada periode tersebut.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="label mb-1">JOURNAL ENTRY</p>
          <h1 className="font-heading text-3xl font-bold page-h1">Transaksi Keuangan</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Input transaksi cepat — laporan terbentuk otomatis.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {user?.role === "admin" && (
            <button data-testid="btn-connect-drive" onClick={connectDrive}
                    className="btn btn-outline flex-1 sm:flex-none"
                    title={driveStatus?.email ? `Terhubung: ${driveStatus.email}` : "Belum terhubung"}>
              <GoogleDriveLogo size={16} weight="duotone"
                               color={driveStatus?.connected ? "#3E8B77" : "#B47536"} />
              {driveStatus?.connected ? "Drive Terhubung" : "Hubungkan Drive"}
            </button>
          )}
          {canImport && (
            <>
              <button data-testid="btn-download-template" onClick={downloadTemplate} className="btn btn-outline flex-1 sm:flex-none">
                <DownloadSimple size={16} weight="duotone" color="#2E4F7C" /> Download Template
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                     data-testid="import-file-input" onChange={onFileChange} />
              <button data-testid="btn-import-excel" onClick={onImportClick} className="btn btn-outline flex-1 sm:flex-none">
                <FileArrowUp size={16} weight="duotone" color="#2E4F7C" /> Impor Excel
              </button>
            </>
          )}
          <button data-testid="btn-export-tx-excel" onClick={exportExcel} className="btn btn-outline flex-1 sm:flex-none">
            <FileXls size={16} weight="duotone" color="#2E4F7C" /> Export Excel
          </button>
          <button data-testid="btn-export-tx-all" onClick={exportAll} className="btn btn-outline flex-1 sm:flex-none">
            <FileXls size={16} weight="duotone" color="#3A5A7D" /> Export Semua Data
          </button>
          <button data-testid="btn-new-tx" onClick={openCreate}
                  disabled={!canWrite}
                  className={`btn btn-primary flex-1 sm:flex-none ${!canWrite ? "opacity-50 cursor-not-allowed" : ""}`}>
            <Plus size={18} weight="bold" /> Tambah Transaksi
          </button>
        </div>
      </div>

      {importResult && (
        <div className="card fade-in" data-testid="import-result"
             style={{ background: "#EEF3F9", border: "1px solid #DCE8FE" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-heading font-semibold mb-1">Hasil Impor</h4>
              <p className="text-sm">Berhasil: <b>{importResult.inserted}</b> dari <b>{importResult.total_rows}</b> baris.</p>
              {importResult.errors?.length > 0 && (
                <ul className="text-xs mt-2 space-y-0.5" style={{ color: "#8A4141" }}>
                  {importResult.errors.slice(0, 10).map((e, i) => (<li key={i}>Baris {e.row}: {e.error}</li>))}
                  {importResult.errors.length > 10 && <li>+ {importResult.errors.length - 10} error lainnya</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="btn btn-outline text-xs">Tutup</button>
          </div>
        </div>
      )}

      {showForm && canWrite && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editingId ? "Edit Transaksi" : "Transaksi Baru"}
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tanggal</label>
              <input data-testid="tx-date" type="date" required className="input"
                     value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Unit Usaha (opsional)</label>
              <select data-testid="tx-unit" className="select" value={form.unit_usaha_id}
                      onChange={(e) => onUnitChange(e.target.value)}
                      disabled={isPengelola}>
                {!isPengelola && <option value="">— BUMDES (umum) —</option>}
                {units
                  .filter(u => !isPengelola || u.id === user?.unit_usaha_id)
                  .map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Jenis Transaksi
                {form.unit_usaha_id && (
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                    (difilter berdasarkan unit terpilih)
                  </span>
                )}
              </label>
              <select data-testid="tx-type" required className="select" value={form.transaction_type}
                      onChange={(e) => onTypeChange(e.target.value)}>
                <option value="">— pilih jenis —</option>
                {filteredTypes.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nominal (Rp)</label>
              <input data-testid="tx-amount" type="number" min="0" step="1" required className="input"
                     value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                     placeholder="100000" />
            </div>
            <div>
              <label className="label">Nomor Referensi (opsional)</label>
              <input data-testid="tx-ref" className="input"
                     value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })}
                     placeholder="mis. nota-001" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Keterangan</label>
              <input data-testid="tx-desc" required className="input"
                     value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                     placeholder="Keterangan detail transaksi" />
            </div>
            <div>
              <label className="label">Debit</label>
              <select data-testid="tx-debit" className="select" value={form.debit_account_code}
                      onChange={(e) => setForm({ ...form, debit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {filteredAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Kredit</label>
              <select data-testid="tx-credit" className="select" value={form.credit_account_code}
                      onChange={(e) => setForm({ ...form, credit_account_code: e.target.value })} required>
                <option value="">— pilih akun —</option>
                {filteredAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn btn-outline">Batal</button>
              <button data-testid="tx-save" type="submit" className="btn btn-primary">
                {editingId ? "Simpan Perubahan" : "Simpan Transaksi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unified group and monthly period filters */}
      <div className="card" data-testid="tx-filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
          <div>
            <label className="label" htmlFor="tx-group-select">Kelompok</label>
            <select id="tx-group-select" data-testid="tx-group-select" className="select"
                    value={activeGroup} onChange={(e) => setActiveGroup(e.target.value)} disabled={isPengelola}>
              {groupTabs.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
  <div>
  <label className="label" htmlFor="tx-period-mode">Periode</label>
  <select id="tx-period-mode" data-testid="tx-period-mode" className="select" value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
  <option value="monthly">Bulanan</option>
  <option value="yearly">Tahunan</option>
  <option value="custom">Custom</option>
  </select>
  {periodMode === "custom" && <>
  <select className="select mt-2" value={customPreset} onChange={(e) => setCustomPreset(e.target.value)}>
    <option value="ytd">Year to Date</option><option value="qtd">Quarter to Date</option><option value="mtd">Month to Date</option><option value="dates">Pilih tanggal</option>
  </select>
  {customPreset === "dates" && <div className="grid grid-cols-2 gap-2 mt-2"><input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /><input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></div>}
  </>}
  </div>
  {periodMode === "monthly" && <div>
  <label className="label" htmlFor="tx-month">Bulan</label>
            <select id="tx-month" data-testid="tx-month" className="select"
                    value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
  </select>
  </div>}
  <div>
  <label className="label" htmlFor="tx-year">Tahun</label>
            <select id="tx-year" data-testid="tx-year" className="select"
                    value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="text-xs px-3 py-2 rounded-lg"
               style={{ background: "var(--primary-light)", color: "#2E4F7C", fontWeight: 600 }}>
            Tampilkan: {MONTHS[month - 1]} {year} · {activeGroup}
          </div>
          {canBulkDelete && selected.size > 0 && (
            <button data-testid="btn-bulk-delete" onClick={bulkDelete}
                    className="btn text-xs sm:col-span-4 justify-self-start"
                    style={{ background: "#D97878", color: "white" }}>
              <Trash size={14} /> Hapus {selected.size} Terpilih
            </button>
          )}
        </div>
      </div>

      {/* Unified Table */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)", background: "#F6FAFE" }}>
          <h3 className="font-heading font-semibold" data-testid="tx-table-title">
            Transaksi {activeGroup} — {MONTHS[month - 1]} {year}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {sortState.sorted.length} transaksi ditemukan.
          </p>
        </div>
        <div className="h-scroll">
          <table className="tbl" data-testid="tx-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                {canBulkDelete && (
                  <th style={{ width: 32 }}>
                    <input type="checkbox" data-testid="tx-select-all"
                           checked={sortState.sorted.length > 0 && sortState.sorted.every(r => selected.has(r.id))}
                           onChange={(e) => {
                             if (e.target.checked) setSelected(new Set(sortState.sorted.map(r => r.id)));
                             else setSelected(new Set());
                           }} />
                  </th>
                )}
                <th {...sortState.headerProps("date")}>Tanggal{sortState.sortIndicator("date")}</th>
                {activeGroup !== "BUMDES" && <th>Unit</th>}
                <th {...sortState.headerProps("description")}>Keterangan{sortState.sortIndicator("description")}</th>
                <th {...sortState.headerProps("debit_account_code")}>Debit{sortState.sortIndicator("debit_account_code")}</th>
                <th {...sortState.headerProps("credit_account_code")}>Kredit{sortState.sortIndicator("credit_account_code")}</th>
                <th className="num" {...sortState.headerProps("amount")}>Jumlah{sortState.sortIndicator("amount")}</th>
                <th>Bukti</th>
                {canWrite && <th></th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={99} className="text-center py-6">Memuat...</td></tr>
              ) : sortState.sorted.length === 0 ? (
                <tr><td colSpan={99} className="text-center py-10">
                  <Receipt size={32} weight="duotone" color="#8E88A5" style={{ margin: "0 auto 8px" }} />
                  <div style={{ color: "var(--text-muted)" }}>
                    Belum ada transaksi <b>{activeGroup}</b> pada <b>{MONTHS[month - 1]} {year}</b>.
                  </div>
                </td></tr>
              ) : sortState.sorted.map((t) => (
                <tr key={t.id}>
                  {canBulkDelete && (
                    <td>
                      <input type="checkbox" data-testid={`sel-tx-${t.id}`}
                             checked={selected.has(t.id)}
                             onChange={() => toggleSel(t.id)} />
                    </td>
                  )}
                  <td>{fmtDate(t.date)}</td>
                  {activeGroup !== "BUMDES" && (
                    <td><span className="badge">{unitOf(t.unit_usaha_id)?.code}</span></td>
                  )}
                  <td className="max-w-xs truncate">{t.description}</td>
                  <td className="text-xs">{accName(t.debit_account_code)}</td>
                  <td className="text-xs">{accName(t.credit_account_code)}</td>
                  <td className="num font-semibold tabular-nums">{fmtRp(t.amount)}</td>
                  <td>
                    {(() => {
                      const proofs = t.proofs || (t.proof ? [t.proof] : []);
                      const editable = canEditRow(t);
                      if (proofs.length === 0) {
                        return editable ? (
                          <button data-testid={`upload-proof-${t.id}`} onClick={() => uploadProof(t)}
                                  className="text-xs flex items-center gap-1"
                                  style={{ color: "var(--text-muted)" }}>
                            <Paperclip size={13} /> Upload
                          </button>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
                        );
                      }
                      return (
                        <div className="flex flex-col gap-1">
                          {proofs.map((p) => (
                            <div key={p.file_id} className="flex items-center gap-1.5">
                              <a href={p.url} target="_blank" rel="noreferrer"
                                 data-testid={`view-proof-${t.id}-${p.file_id}`}
                                 className="text-xs flex items-center gap-1 underline truncate max-w-[180px]"
                                 style={{ color: "#2E4F7C" }}
                                 title={p.file_name}>
                                <LinkSimple size={13} /> {p.file_name}
                              </a>
                              {editable && (
                                <button data-testid={`del-proof-${t.id}-${p.file_id}`}
                                        onClick={() => deleteProof(t, p.file_id, p.file_name)}
                                        title="Hapus bukti"
                                        className="p-1 rounded hover:bg-red-50">
                                  <X size={12} color="#D97878" />
                                </button>
                              )}
                            </div>
                          ))}
                          {editable && proofs.length < 3 && (
                            <button data-testid={`add-proof-${t.id}`} onClick={() => uploadProof(t)}
                                    className="text-[11px] flex items-center gap-1 mt-0.5"
                                    style={{ color: "var(--text-muted)" }}>
                              <Paperclip size={11} /> Tambah ({proofs.length}/3)
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  {canWrite && (
                    <td><div className="flex gap-1">
                      {canEditRow(t) && <button data-testid={`edit-tx-${t.id}`} onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-yellow-50"><Pencil size={16} color="#4C86C4" /></button>}
                      {can(user, "admin", "direktur", "bendahara") && <button data-testid={`del-tx-${t.id}`} onClick={() => del(t.id)} className="p-1.5 rounded-md hover:bg-red-50"><Trash size={16} color="#D97878" /></button>}
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
