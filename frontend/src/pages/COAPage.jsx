import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import { useConfirm } from "@/components/ConfirmProvider";
import { useSort } from "@/lib/useSort";
import { Plus, Pencil, Trash, DownloadSimple, UploadSimple, Warning } from "@phosphor-icons/react";

const CAT_LABELS = {
  aset: "Aset", kewajiban: "Kewajiban", ekuitas: "Ekuitas",
  pendapatan: "Pendapatan", hpp: "Harga Pokok Penjualan", beban: "Beban",
};

const SUBCATEGORIES = {
  aset: ["aset_lancar", "kas_bank", "aset_tetap"],
  kewajiban: ["kewajiban_jangka_pendek", "kewajiban_jangka_panjang"],
  ekuitas: ["modal_desa", "modal_masyarakat", "saldo_laba",
            "bagi_hasil_desa", "bagi_hasil_masyarakat", "ikhtisar_laba_rugi"],
  pendapatan: ["pendapatan_operasional", "pendapatan_non_operasional"],
  hpp: ["hpp_barang_jadi", "hpp_produksi", "biaya_angkut_barang"],
  beban: ["beban_operasional", "beban_administrasi", "beban_lain_lain"],
};

const DEFAULT_NB = {
  aset: "debit", kewajiban: "kredit", ekuitas: "kredit",
  pendapatan: "kredit", hpp: "debit", beban: "debit",
};

const emptyAcc = {
  code: "", name: "", category: "aset", subcategory: "aset_lancar",
  normal_balance: "debit",
};
const emptyTT = { code: "", name: "", debit: "", credit: "" };

export default function COAPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const isAdmin = user?.role === "admin";
  const canAdd = isAdmin;

  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([]);
  const [group, setGroup] = useState("BUMDES");
  const [activeSection, setActiveSection] = useState("accounts");

  const [filter, setFilter] = useState(""); // category filter (aset/kewajiban/...)

  const [showAcc, setShowAcc] = useState(false);
  const [editAccCode, setEditAccCode] = useState(null);
  const [accForm, setAccForm] = useState(emptyAcc);
  const [accErr, setAccErr] = useState("");

  const [showTT, setShowTT] = useState(false);
  const [editTTCode, setEditTTCode] = useState(null);
  const [ttForm, setTtForm] = useState(emptyTT);
  const [ttErr, setTtErr] = useState("");
  const accountFileRef = useRef(null);
  const transactionFileRef = useRef(null);

  const downloadTemplate = async (section) => {
    try {
      const isTransactions = section === "transaction-types";
      const templatePath = isTransactions ? "transaction-types/template" : "accounts/template";
      const res = await fetch(`${API}/${templatePath}?group=${encodeURIComponent(group)}`, { credentials: "include" });
      if (!res.ok) { notify("Gagal mengunduh template"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = section === "transaction-types" ? "Template-Jenis-Transaksi.xlsx" : "Template-Kode-Akun.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch (er) { notify(er.message || "Gagal"); }
  };

  const importFile = async (e, section) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isTransactions = section === "transaction-types";
    if (!(await confirm({ title: isTransactions ? "Import jenis transaksi" : "Import chart of accounts", description: `Import file "${file.name}"? Baris duplikat akan dilewati.`, confirmLabel: "Import" }))) {
      e.target.value = ""; return;
    }
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.post(isTransactions ? "/transaction-types/import" : "/accounts/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { inserted, skipped, errors } = r.data;
      let msg = `Berhasil ditambahkan: ${inserted} akun\nDilewati: ${skipped}`;
      if (errors && errors.length) {
        msg += `\n\nCatatan (${errors.length}):\n` + errors.slice(0, 10).join("\n");
      }
      notify(msg);
      load();
    } catch (er) {
      notify(er.response?.data?.detail || "Gagal import");
    } finally {
      e.target.value = "";
    }
  };

  const exportMasterData = async (section) => {
    try {
      const res = await fetch(`${API}/master-data/export?group=${encodeURIComponent(group)}&section=${section}`, { credentials: "include" });
      if (!res.ok) { notify("Gagal export master data"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Master-Data-${group}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (er) { notify(er.message || "Gagal export"); }
  };

  const resetAll = async () => {
    if (!(await confirm({ title: "Reset semua kode akun", description: "Semua kode akun di seluruh kelompok akan dihapus. Transaksi tidak dihapus, tetapi laporan tidak dapat dibuat sampai akun diimpor ulang.", confirmLabel: "Lanjutkan", destructive: true }))) return;
    if (!(await confirm({ title: "Konfirmasi kedua", description: "Apakah Anda benar-benar yakin ingin menghapus semua kode akun?", confirmLabel: "Hapus semua", destructive: true }))) return;
    try {
      const r = await api.delete("/accounts/reset-all", { params: { confirm: "YES" } });
      notify(`${r.data.deleted} akun dihapus. Silakan download template & import ulang.`);
      load();
    } catch (er) {
      notify(er.response?.data?.detail || "Gagal reset");
    }
  };

  const load = useCallback(async () => {
    const [a, t, u] = await Promise.all([
      api.get("/accounts"), api.get("/transaction-types"), api.get("/unit-usaha"),
    ]);
    setList(a.data); setTypes(t.data); setUnits(u.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const onCatChange = (cat) => setAccForm(f => ({
    ...f, category: cat,
    subcategory: SUBCATEGORIES[cat]?.[0] || "",
    normal_balance: DEFAULT_NB[cat] || "debit",
  }));

  const openCreateAcc = () => { setEditAccCode(null); setAccForm(emptyAcc); setAccErr(""); setShowAcc(true); };
  const openEditAcc = (a) => {
    setEditAccCode(a.code);
    setAccForm({
      code: a.code, name: a.name, category: a.category,
      subcategory: a.subcategory || (SUBCATEGORIES[a.category]?.[0] || ""),
      normal_balance: a.normal_balance,
    });
    setAccErr(""); setShowAcc(true);
  };

  const submitAcc = async (e) => {
    e.preventDefault(); setAccErr("");
    try {
      const body = {
        code: accForm.code.trim(), name: accForm.name.trim(),
        category: accForm.category, subcategory: accForm.subcategory,
        normal_balance: accForm.normal_balance,
        group,
      };
      if (editAccCode) {
        await api.put(`/accounts/${encodeURIComponent(editAccCode)}`, body, { params: { group } });
      } else {
        await api.post("/accounts", body);
      }
      setShowAcc(false); setEditAccCode(null); load();
    } catch (ex) { setAccErr(ex.response?.data?.detail || "Gagal menyimpan"); }
  };

  const delAcc = async (code) => {
    if (!(await confirm({ title: "Hapus kode akun", description: `Hapus kode akun ${code} di kelompok ${group}?`, confirmLabel: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/accounts/${encodeURIComponent(code)}`, { params: { group } });
      load();
    } catch (ex) { notify(ex.response?.data?.detail || "Gagal hapus"); }
  };

  const openCreateTT = () => { setEditTTCode(null); setTtForm(emptyTT); setTtErr(""); setShowTT(true); };
  const openEditTT = (t) => {
    setEditTTCode(t.code);
    setTtForm({ code: t.code, name: t.name, debit: t.debit || "", credit: t.credit || "" });
    setTtErr(""); setShowTT(true);
  };

  const submitTT = async (e) => {
    e.preventDefault(); setTtErr("");
    try {
      const body = {
        code: ttForm.code.trim(), name: ttForm.name.trim(),
        debit: ttForm.debit, credit: ttForm.credit,
        unit_codes: group === "BUMDES" ? [] : [group],
        group,  // auto-set from active tab
      };
      if (editTTCode) await api.put(`/transaction-types/${encodeURIComponent(editTTCode)}`, body);
      else await api.post("/transaction-types", body);
      setShowTT(false); setEditTTCode(null); load();
    } catch (ex) { setTtErr(ex.response?.data?.detail || "Gagal menyimpan"); }
  };

  const delTT = async (code) => {
    if (!(await confirm({ title: "Hapus jenis transaksi", description: `Hapus jenis transaksi ${code}?`, confirmLabel: "Hapus", destructive: true }))) return;
    try {
      await api.delete(`/transaction-types/${encodeURIComponent(code)}`);
      load();
    } catch (ex) { notify(ex.response?.data?.detail || "Gagal hapus"); }
  };

  // Filter by active group tab + category
  const groupAccounts = useMemo(
    () => list.filter(a => (a.group || "BUMDES") === group),
    [list, group]
  );
  const filteredAccounts = useMemo(
    () => (filter ? groupAccounts.filter(a => a.category === filter) : groupAccounts),
    [groupAccounts, filter]
  );
  const groupTypes = useMemo(
    () => types.filter(t => (t.group || "BUMDES") === group),
    [types, group]
  );

  const accSort = useSort(filteredAccounts, "code", "asc");
  const ttSort = useSort(groupTypes, "code", "asc");

  // Bulk selection state
  const [selAcc, setSelAcc] = useState(new Set());
  const [selTT, setSelTT] = useState(new Set());
  useEffect(() => { setSelAcc(new Set()); setSelTT(new Set()); }, [group]);

  const bulkDelAcc = async () => {
    if (selAcc.size === 0) return;
    if (!(await confirm({ title: "Hapus kode akun terpilih", description: `Hapus ${selAcc.size} kode akun terpilih di grup ${group}?`, confirmLabel: "Hapus semua", destructive: true }))) return;
    for (const code of selAcc) {
      try { await api.delete(`/accounts/${encodeURIComponent(code)}`, { params: { group } }); } catch (_e) { /* ignore */ }
    }
    setSelAcc(new Set()); load();
  };
  const bulkDelTT = async () => {
    if (selTT.size === 0) return;
    if (!(await confirm({ title: "Hapus tipe transaksi terpilih", description: `Hapus ${selTT.size} jenis transaksi terpilih di grup ${group}?`, confirmLabel: "Hapus semua", destructive: true }))) return;
    for (const code of selTT) {
      try { await api.delete(`/transaction-types/${encodeURIComponent(code)}`); } catch (_e) { /* ignore */ }
    }
    setSelTT(new Set()); load();
  };

  const groupTabs = useMemo(() => {
    const tabs = [{ key: "BUMDES", label: "BUMDES", sub: "Pusat" }];
    units.forEach(u => tabs.push({ key: u.code, label: u.code, sub: u.name }));
    return tabs;
  }, [units]);

  const groupLabel = groupTabs.find(g => g.key === group)?.sub || group;

  return (
    <div className="space-y-6" data-testid="coa-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Chart of Accounts</p>
          <h1 className="font-heading text-3xl font-bold page-h1">Kode Akun & Jenis Transaksi</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Setiap kelompok (BUMDES & 6 Unit) memiliki kode akun serta jenis transaksi <b>terpisah</b> — tidak saling terhubung.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-3" data-testid="master-data-controls">
          <div className="card card-sm">
            <label className="label mb-2" htmlFor="master-group-select">Kelompok</label>
            <select id="master-group-select" data-testid="master-group-select" className="select" value={group} onChange={(e) => { setGroup(e.target.value); setFilter(""); }}>
              {groupTabs.map(g => <option key={g.key} value={g.key}>{g.key === "BUMDES" ? "BUMDES - Pusat" : `${g.label} - ${g.sub}`}</option>)}
            </select>
          </div>
          <div className="card card-sm flex flex-wrap gap-2" data-testid="master-type-tabs">
            <button data-testid="tab-accounts" onClick={() => setActiveSection("accounts")} className={`btn ${activeSection === "accounts" ? "btn-primary" : "btn-outline"}`}>Kode Akun</button>
            <button data-testid="tab-transaction-types" onClick={() => setActiveSection("transaction-types")} className={`btn ${activeSection === "transaction-types" ? "btn-primary" : "btn-outline"}`}>Jenis Transaksi</button>
          </div>
        </div>
      )}

      {activeSection === "accounts" && <>
      {/* ============ KODE AKUN ============ */}
      <div className="card card-sm flex flex-wrap items-center gap-2" data-testid="account-toolbar">
        <button data-testid="btn-download-account-template" onClick={() => downloadTemplate("accounts")} className="btn btn-outline"><DownloadSimple size={16} /> Download Template</button>
        <button data-testid="btn-import-account" onClick={() => accountFileRef.current?.click()} className="btn btn-outline"><UploadSimple size={16} /> Import Excel</button>
        <button data-testid="btn-export-account" onClick={() => exportMasterData("accounts")} className="btn btn-outline"><DownloadSimple size={16} /> Export Excel</button>
        <input ref={accountFileRef} type="file" accept=".xlsx" onChange={(e) => importFile(e, "accounts")} hidden />
      </div>
      <div className="flex justify-between items-center gap-4 flex-wrap pt-2">
        <div>
          <h2 className="font-heading text-2xl font-bold">Kode Akun — {groupLabel}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {accSort.sorted.length} akun aktif pada kelompok <b>{group}</b>.
          </p>
        </div>
        {canAdd && (
          <button data-testid="btn-new-account" onClick={openCreateAcc} className="btn btn-primary">
            <Plus size={16} /> Tambah Kode Akun
          </button>
        )}
      </div>

      {showAcc && canAdd && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editAccCode
              ? `Edit Kode Akun (${editAccCode}) — ${groupLabel}`
              : `Kode Akun Baru — ${groupLabel}`}
          </h3>
          <form onSubmit={submitAcc} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Kode Akun</label>
              <input data-testid="acc-code" required className="input"
                     value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} /></div>
            <div><label className="label">Nama Akun</label>
              <input data-testid="acc-name" required className="input"
                     value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} /></div>
            <div><label className="label">Kategori</label>
              <select data-testid="acc-category" className="select" value={
                Object.keys(CAT_LABELS).includes(accForm.category) ? accForm.category : "__custom__"
              }
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setAccForm(f => ({ ...f, category: "", subcategory: "" }));
                        } else {
                          onCatChange(e.target.value);
                        }
                      }}>
                {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                <option value="__custom__">+ Kategori Baru (custom)</option>
              </select>
              {!Object.keys(CAT_LABELS).includes(accForm.category) && (
                <input data-testid="acc-category-custom" className="input mt-2"
                       placeholder="Ketik nama kategori baru..."
                       value={accForm.category}
                       onChange={(e) => setAccForm(f => ({ ...f, category: e.target.value.toLowerCase() }))} />
              )}
            </div>
            <div><label className="label">Sub-Kategori</label>
              <select data-testid="acc-subcategory" className="select" value={
                (SUBCATEGORIES[accForm.category] || []).includes(accForm.subcategory)
                  ? accForm.subcategory
                  : accForm.subcategory ? "__custom__" : ""
              }
                      onChange={(e) => {
                        if (e.target.value === "__custom__") setAccForm(f => ({ ...f, subcategory: "" }));
                        else setAccForm(f => ({ ...f, subcategory: e.target.value }));
                      }}>
                {(SUBCATEGORIES[accForm.category] || []).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                <option value="__custom__">+ Sub-Kategori Baru (custom)</option>
              </select>
              {(!SUBCATEGORIES[accForm.category] || !SUBCATEGORIES[accForm.category].includes(accForm.subcategory)) && (
                <input data-testid="acc-subcategory-custom" className="input mt-2"
                       placeholder="Ketik nama sub-kategori baru..."
                       value={accForm.subcategory}
                       onChange={(e) => setAccForm(f => ({ ...f, subcategory: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} />
              )}
            </div>
            <div><label className="label">Saldo Normal</label>
              <select data-testid="acc-normal-balance" className="select" value={accForm.normal_balance}
                      onChange={(e) => setAccForm({ ...accForm, normal_balance: e.target.value })}>
                <option value="debit">Debit</option><option value="kredit">Kredit</option>
              </select></div>
            <p className="sm:col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Akun ini akan disimpan pada kelompok <b>{group}</b>.
            </p>
            {accErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                            style={{ background: "#FDECEA", color: "#8A4141", border: "1px solid #f5c6c1" }}>{accErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAcc(false)} className="btn btn-outline">Batal</button>
              <button data-testid="acc-save" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {[["", "Semua"], ...Object.entries(CAT_LABELS)].map(([k, v]) => (
          <button key={k} data-testid={`cat-filter-${k || "all"}`}
                  onClick={() => setFilter(k)}
                  className={`btn ${filter === k ? "btn-secondary" : "btn-outline"} text-sm`}>{v}</button>
        ))}
      </div>

      <div className="card p-0 h-scroll">
        {isAdmin && selAcc.size > 0 && (
          <div className="p-3 flex justify-between items-center" style={{ background: "#FDECEA", borderBottom: "1px solid #f5c6c1" }}>
            <span className="text-sm" style={{ color: "#8A4141" }}>{selAcc.size} akun terpilih</span>
            <button data-testid="bulk-del-acc" onClick={bulkDelAcc} className="btn text-xs"
                    style={{ background: "#D97878", color: "white" }}>
              <Trash size={14} /> Hapus Terpilih
            </button>
          </div>
        )}
        <table className="tbl" data-testid="coa-table">
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: 32 }}>
                  <input type="checkbox" data-testid="coa-select-all"
                         checked={accSort.sorted.length > 0 && accSort.sorted.every(a => selAcc.has(a.code))}
                         onChange={(e) => setSelAcc(e.target.checked ? new Set(accSort.sorted.map(a => a.code)) : new Set())} />
                </th>
              )}
              <th {...accSort.headerProps("code")}>Kode{accSort.sortIndicator("code")}</th>
              <th {...accSort.headerProps("name")}>Nama Akun{accSort.sortIndicator("name")}</th>
              <th {...accSort.headerProps("category")}>Kategori{accSort.sortIndicator("category")}</th>
              <th {...accSort.headerProps("subcategory")}>Sub{accSort.sortIndicator("subcategory")}</th>
              <th {...accSort.headerProps("normal_balance")}>Saldo Normal{accSort.sortIndicator("normal_balance")}</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {accSort.sorted.length === 0 ? (
              <tr><td colSpan={isAdmin ? 7 : 5} className="text-center py-8"
                      style={{ color: "var(--text-muted)" }}>
                Belum ada kode akun pada kelompok <b>{group}</b>.
              </td></tr>
            ) : accSort.sorted.map(a => (
              <tr key={a.code}>
                {isAdmin && (
                  <td>
                    <input type="checkbox" data-testid={`sel-acc-${a.code}`}
                           checked={selAcc.has(a.code)}
                           onChange={() => setSelAcc(prev => {
                             const n = new Set(prev);
                             n.has(a.code) ? n.delete(a.code) : n.add(a.code);
                             return n;
                           })} />
                  </td>
                )}
                <td className="font-mono font-semibold">{a.code}</td>
                <td>{a.name}</td>
                <td>{CAT_LABELS[a.category] ? <span className="badge">{CAT_LABELS[a.category]}</span> : <span className="badge badge-purple">{a.category}</span>}</td>
                <td className="text-xs">{a.subcategory}</td>
                <td>{a.normal_balance === "debit"
                  ? <span className="badge badge-blue">Debit</span>
                  : <span className="badge badge-purple">Kredit</span>}</td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`edit-acc-${a.code}`} onClick={() => openEditAcc(a)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil size={16} color="#4C86C4" />
                      </button>
                      <button data-testid={`del-acc-${a.code}`} onClick={() => delAcc(a.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash size={16} color="#D97878" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </>}

      {activeSection === "transaction-types" && <>
      {/* ============ JENIS TRANSAKSI ============ */}
      <div className="card card-sm flex flex-wrap items-center gap-2" data-testid="transaction-toolbar">
        <button data-testid="btn-download-transaction-template" onClick={() => downloadTemplate("transaction-types")} className="btn btn-outline"><DownloadSimple size={16} /> Download Template</button>
        <button data-testid="btn-import-transaction" onClick={() => transactionFileRef.current?.click()} className="btn btn-outline"><UploadSimple size={16} /> Import Excel</button>
        <button data-testid="btn-export-transaction" onClick={() => exportMasterData("transaction-types")} className="btn btn-outline"><DownloadSimple size={16} /> Export Excel</button>
        <input ref={transactionFileRef} type="file" accept=".xlsx" onChange={(e) => importFile(e, "transaction-types")} hidden />
      </div>
      <div className="flex justify-between items-center gap-4 flex-wrap pt-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Jenis Transaksi — {groupLabel}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {ttSort.sorted.length} jenis transaksi pada kelompok <b>{group}</b>. Debit & Kredit hanya bisa memilih akun dari kelompok yang sama.
          </p>
        </div>
        {isAdmin && (
          <button data-testid="btn-new-tt" onClick={openCreateTT} className="btn btn-primary">
            <Plus size={16} /> Tambah Jenis Transaksi
          </button>
        )}
      </div>

      {showTT && isAdmin && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">
            {editTTCode
              ? `Edit Jenis Transaksi (${editTTCode}) — ${groupLabel}`
              : `Jenis Transaksi Baru — ${groupLabel}`}
          </h3>
          <form onSubmit={submitTT} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Kode</label>
              <input data-testid="tt-code" required className="input"
                     placeholder="mis. penjualan_kios"
                     value={ttForm.code} onChange={(e) => setTtForm({ ...ttForm, code: e.target.value })} /></div>
            <div><label className="label">Nama Transaksi</label>
              <input data-testid="tt-name" required className="input"
                     value={ttForm.name} onChange={(e) => setTtForm({ ...ttForm, name: e.target.value })} /></div>
            <div><label className="label">Akun Debit (default)</label>
              <select data-testid="tt-debit" required className="select" value={ttForm.debit}
                      onChange={(e) => setTtForm({ ...ttForm, debit: e.target.value })}>
                <option value="">— pilih akun {group} —</option>
                {groupAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select></div>
            <div><label className="label">Akun Kredit (default)</label>
              <select data-testid="tt-credit" required className="select" value={ttForm.credit}
                      onChange={(e) => setTtForm({ ...ttForm, credit: e.target.value })}>
                <option value="">— pilih akun {group} —</option>
                {groupAccounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
              </select></div>
            <p className="sm:col-span-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Jenis transaksi ini akan disimpan pada kelompok <b>{group}</b>.
            </p>
            {ttErr && <div className="sm:col-span-2 text-sm p-3 rounded-lg"
                           style={{ background: "#FDECEA", color: "#8A4141" }}>{ttErr}</div>}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowTT(false)} className="btn btn-outline">Batal</button>
              <button data-testid="tt-save" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 h-scroll">
        {isAdmin && selTT.size > 0 && (
          <div className="p-3 flex justify-between items-center" style={{ background: "#FDECEA", borderBottom: "1px solid #f5c6c1" }}>
            <span className="text-sm" style={{ color: "#8A4141" }}>{selTT.size} jenis transaksi terpilih</span>
            <button data-testid="bulk-del-tt" onClick={bulkDelTT} className="btn text-xs"
                    style={{ background: "#D97878", color: "white" }}>
              <Trash size={14} /> Hapus Terpilih
            </button>
          </div>
        )}
        <table className="tbl" data-testid="tt-table">
          <thead>
            <tr>
              {isAdmin && (
                <th style={{ width: 32 }}>
                  <input type="checkbox" data-testid="tt-select-all"
                         checked={ttSort.sorted.length > 0 && ttSort.sorted.every(t => selTT.has(t.code))}
                         onChange={(e) => setSelTT(e.target.checked ? new Set(ttSort.sorted.map(t => t.code)) : new Set())} />
                </th>
              )}
              <th {...ttSort.headerProps("name")}>Nama Transaksi{ttSort.sortIndicator("name")}</th>
              <th {...ttSort.headerProps("debit")}>Debit / Kredit{ttSort.sortIndicator("debit")}</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ttSort.sorted.length === 0 ? (
              <tr><td colSpan={isAdmin ? 4 : 2} className="text-center py-6" style={{ color: "var(--text-muted)" }}>
                Belum ada jenis transaksi pada kelompok <b>{group}</b>.
              </td></tr>
            ) : ttSort.sorted.map(t => (
              <tr key={t.code}>
                {isAdmin && (
                  <td>
                    <input type="checkbox" data-testid={`sel-tt-${t.code}`}
                           checked={selTT.has(t.code)}
                           onChange={() => setSelTT(prev => {
                             const n = new Set(prev);
                             n.has(t.code) ? n.delete(t.code) : n.add(t.code);
                             return n;
                           })} />
                  </td>
                )}
                <td>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{t.code}</div>
                </td>
                <td className="text-xs">
                  <div>D: {t.debit}</div>
                  <div>K: {t.credit}</div>
                </td>
                {isAdmin && (
                  <td>
                    <div className="flex gap-1">
                      <button data-testid={`edit-tt-${t.code}`} onClick={() => openEditTT(t)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Edit">
                        <Pencil size={16} color="#4C86C4" />
                      </button>
                      <button data-testid={`del-tt-${t.code}`} onClick={() => delTT(t.code)}
                              className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                        <Trash size={16} color="#D97878" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}
