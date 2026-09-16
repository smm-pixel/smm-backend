import { useCallback, useEffect, useState } from "react";
import api, { ROLE_LABELS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/feedback";
import { useConfirm } from "@/components/ConfirmProvider";
import { Plus, Trash, Key, Lock } from "@phosphor-icons/react";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin Utama" },
  { value: "direktur", label: "Direktur" },
  { value: "bendahara", label: "Bendahara" },
  { value: "pengelola", label: "Pengelola Unit" },
  { value: "pengawas", label: "Pengawas (read-only)" },
  { value: "penasihat", label: "Penasihat (read-only)" },
];

const ROLE_BADGE = {
  admin: "", direktur: "badge-purple", bendahara: "badge-blue",
  pengelola: "badge-warn", pengawas: "badge-blue", penasihat: "badge-purple",
};

export default function UsersPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);
  const [show, setShow] = useState(false);
  const [showResetFor, setShowResetFor] = useState(null); // user id
  const [showLockFor, setShowLockFor] = useState(null); // user id
  const [lockPeriods, setLockPeriods] = useState(new Set()); // Set of "YYYY-MM"
  const [newPw, setNewPw] = useState("");
  const [form, setForm] = useState({
    username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "",
  });

  const load = useCallback(async () => {
    const [u, un] = await Promise.all([api.get("/users"), api.get("/unit-usaha")]);
    setUsers(u.data); setUnits(un.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", {
        ...form, unit_usaha_id: form.role === "pengelola" ? form.unit_usaha_id : null,
      });
      setShow(false);
      setForm({ username: "", email: "", name: "", password: "", role: "pengelola", unit_usaha_id: "" });
      load();
    } catch (er) { notify(er.response?.data?.detail || "Gagal"); }
  };

  const del = async (id) => {
    if (!(await confirm({ title: "Hapus pengguna", description: "Pengguna akan dihapus dan tidak dapat dipulihkan.", confirmLabel: "Hapus", destructive: true }))) return;
    await api.delete(`/users/${id}`);
    load();
  };

  const resetPw = async (e) => {
    e.preventDefault();
    if (newPw.length < 6) { notify("Password minimal 6 karakter"); return; }
    try {
      await api.post(`/users/${showResetFor}/reset-password`, { new_password: newPw });
      setShowResetFor(null); setNewPw("");
      load();
      notify("Password berhasil direset.");
    } catch (er) { notify(er.response?.data?.detail || "Gagal reset"); }
  };

  // ---- Period Access Control ----
  const openLock = (u) => {
    setShowLockFor(u.id);
    setLockPeriods(new Set(u.blocked_periods || []));
  };
  const togglePeriod = (ym) => {
    setLockPeriods(prev => {
      const n = new Set(prev);
      if (n.has(ym)) n.delete(ym); else n.add(ym);
      return n;
    });
  };
  const saveLock = async () => {
    try {
      await api.put(`/users/${showLockFor}/blocked-periods`, {
        blocked_periods: Array.from(lockPeriods),
      });
      setShowLockFor(null); setLockPeriods(new Set());
      load();
    } catch (er) { notify(er.response?.data?.detail || "Gagal menyimpan"); }
  };

  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    return (
      <div data-testid="users-page-forbidden" className="card">
        <h2 className="font-heading text-xl font-bold">Akses Ditolak</h2>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          Hanya Admin Utama yang berwenang melihat dan mengelola pengguna.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <p className="label mb-1">Manajemen Akses (Admin Utama)</p>
          <h1 className="font-heading text-3xl font-bold page-h1">Kelola Pengguna</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Password tidak dapat dilihat. Gunakan Reset Password jika pengguna kehilangan akses.
          </p>
        </div>
        <div className="flex gap-2">
          <button data-testid="btn-new-user" onClick={() => setShow(true)} className="btn btn-primary">
            <Plus size={16} /> Tambah Pengguna
          </button>
        </div>
      </div>

      {show && (
        <div className="card fade-in">
          <h3 className="font-heading text-lg font-semibold mb-4">Tambah Pengguna Baru</h3>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Nama Lengkap</label>
              <input required className="input" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Username</label>
              <input required className="input" value={form.username}
                     onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="label">Email</label>
              <input type="email" required className="input" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Password</label>
              <input type="text" required minLength={6} className="input" value={form.password}
                     onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min. 6 karakter" /></div>
            <div><label className="label">Role</label>
              <select required className="select" value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></div>
            {form.role === "pengelola" && (
              <div><label className="label">Unit Usaha</label>
                <select required className="select" value={form.unit_usaha_id}
                        onChange={(e) => setForm({ ...form, unit_usaha_id: e.target.value })}>
                  <option value="">— pilih unit —</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select></div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShow(false)} className="btn btn-outline">Batal</button>
              <button data-testid="btn-save-user" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}

      {showResetFor && (
        <div className="card fade-in" data-testid="reset-pw-form">
          <h3 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
            <Key size={20} weight="duotone" color="#2E4F7C" /> Reset Password
          </h3>
          <form onSubmit={resetPw} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Password Sementara</label>
              <input data-testid="reset-pw-input" type="password" required minLength={8} className="input"
                     value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min. 8 karakter" />
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                Pengguna wajib mengganti password ini setelah login berikutnya.
              </p>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowResetFor(null); setNewPw(""); }} className="btn btn-outline">Batal</button>
              <button data-testid="btn-confirm-reset" className="btn btn-primary">Reset & Simpan</button>
            </div>
          </form>
        </div>
      )}

      {showLockFor && (() => {
        const targetUser = users.find(u => u.id === showLockFor);
        const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
        const YEARS = [];
        for (let y = 2022; y <= 2030; y++) YEARS.push(y);
        return (
          <div className="card fade-in" data-testid="lock-periods-form">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="font-heading text-lg font-semibold flex items-center gap-2">
                  <Lock size={20} weight="duotone" color="#8A4141" /> Kunci Periode Transaksi
                </h3>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Untuk <b>{targetUser?.name}</b>. Bulan yang dicentang akan diblokir dari input/edit/hapus transaksi.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowLockFor(null); setLockPeriods(new Set()); }} className="btn btn-outline">Batal</button>
                <button data-testid="btn-save-lock" onClick={saveLock} className="btn btn-primary">Simpan</button>
              </div>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {YEARS.map(y => {
                const yearMonths = MONTHS.map((_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
                const allBlocked = yearMonths.every(m => lockPeriods.has(m));
                return (
                  <div key={y} className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">Tahun {y}</span>
                      <button
                        data-testid={`lock-year-${y}`}
                        onClick={() => {
                          setLockPeriods(prev => {
                            const n = new Set(prev);
                            if (allBlocked) yearMonths.forEach(m => n.delete(m));
                            else yearMonths.forEach(m => n.add(m));
                            return n;
                          });
                        }}
                        className="btn text-xs btn-outline">
                        {allBlocked ? "Buka Semua" : "Kunci Semua"}
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {MONTHS.map((mn, i) => {
                        const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
                        const blocked = lockPeriods.has(ym);
                        return (
                          <button key={ym}
                                  data-testid={`lock-${ym}`}
                                  onClick={() => togglePeriod(ym)}
                                  className="text-xs py-1.5 rounded-md transition-colors"
                                  style={{
                                    background: blocked ? "#8A4141" : "white",
                                    color: blocked ? "white" : "var(--text-primary)",
                                    border: `1px solid ${blocked ? "#8A4141" : "var(--border)"}`,
                                    fontWeight: blocked ? 600 : 400,
                                  }}>
                            {mn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="card p-0 h-scroll">
        <table className="tbl" data-testid="users-table">
          <thead>
            <tr>
              <th>Nama</th><th>Username</th><th>Email</th>
              <th>Role</th><th>Unit</th>
              <th>Periode Terkunci</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const blockedCnt = (u.blocked_periods || []).length;
              return (
                <tr key={u.id}>
                  <td className="font-medium">{u.name}</td>
                  <td>{u.username}</td>
                  <td className="text-xs">{u.email}</td>
                  <td>
                    <span className={`badge ${ROLE_BADGE[u.role] || ""}`}>{ROLE_LABELS[u.role] || u.role}</span>
                  </td>
                  <td className="text-xs">{units.find(x => x.id === u.unit_usaha_id)?.code || "-"}</td>
                  <td className="text-xs" data-testid={`blocked-count-${u.id}`}>
                    {blockedCnt > 0
                      ? <span className="badge badge-warn">{blockedCnt} bulan</span>
                      : <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      {u.role !== "admin" && (
                        <button data-testid={`btn-lock-${u.id}`} onClick={() => openLock(u)}
                                className="p-1.5 rounded-md hover:bg-red-50" title="Kunci Periode">
                          <Lock size={16} color="#8A4141" />
                        </button>
                      )}
                      <button data-testid={`btn-reset-${u.id}`} onClick={() => setShowResetFor(u.id)}
                              className="p-1.5 rounded-md hover:bg-yellow-50" title="Reset Password">
                        <Key size={16} color="#4C86C4" />
                      </button>
                      {u.id !== user.id && (
                        <button data-testid={`btn-del-${u.id}`} onClick={() => del(u.id)}
                                className="p-1.5 rounded-md hover:bg-red-50" title="Hapus">
                          <Trash size={16} color="#D97878" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
