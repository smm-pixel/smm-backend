import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { LayoutDashboard, Package, ArrowLeftRight, LogOut, ShieldAlert, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth.jsx";
import { ROLE_LABELS } from "@/lib/api.js";

const UNIT_TOKO = "UU05";
const GLOBAL_ROLES = ["admin", "direktur", "bendahara"];
const NAV = [
  { to: "/", label: "Dashboard & Sinkronisasi", icon: LayoutDashboard, end: true },
  { to: "/produk", label: "Master Produk & Harga", icon: Package },
  { to: "/mutasi", label: "Log Mutasi Barang", icon: ArrowLeftRight },
];

function hasUnitAccess(user) {
  if (!user) return false;
  if (GLOBAL_ROLES.includes(user.role)) return true;
  // The backend remains the authority. Pengelola users may receive either
  // the UU05 code or the database id for their assigned unit.
  return user.role === "pengelola" && Boolean(user.unit_usaha_id ?? user.unit);
}

function AccessDenied({ user, onLogout }) {
  return <div className="flex min-h-full items-center justify-center p-6"><div className="card w-full max-w-md text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600"><ShieldAlert size={28} /></div>
    <h1 className="text-lg font-semibold">Akses Ditolak</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Akun Anda tidak memiliki hak akses ke Konsol Operasional Unit Toko Offline (UU05).</p>
    <div className="mt-4 rounded-lg bg-[var(--bg)] px-4 py-3 text-left text-xs text-[var(--text-secondary)]"><p><b>Pengguna:</b> {user?.name || user?.username || "-"}</p><p><b>Peran:</b> {ROLE_LABELS[user?.role] || user?.role || "-"}</p><p><b>Unit:</b> {user?.unit_usaha_id || "Tidak ditetapkan"}</p></div>
    <button type="button" onClick={onLogout} className="btn btn-primary mt-6 w-full"><LogOut size={16} /> Keluar</button>
  </div></div>;
}

export default function Layout() {
  const { user, loading, logout } = useAuth(); const location = useLocation(); const [open, setOpen] = useState(false);
  if (loading) return <div className="flex h-full items-center justify-center text-[var(--text-muted)]">Memeriksa sesi...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!hasUnitAccess(user)) return <AccessDenied user={user} onLogout={logout} />;
  return <div className="min-h-screen flex" style={{ background: "var(--bg)" }}>
    <div className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-white border-b" style={{ borderColor: "var(--border)" }}><div className="flex min-w-0 items-center gap-2"><img src="/logo-bumdes.webp" alt="Logo BUMDes Karya Raharja" className="h-8 w-8 shrink-0 rounded-full object-cover"/><span className="truncate font-heading font-bold text-sm">BUMDES Karya Raharja</span></div><button type="button" onClick={() => setOpen(!open)} className="p-2" aria-label="Buka menu">{open ? <X size={22}/> : <Menu size={22}/>}</button></div>
    <aside className={`fixed lg:sticky top-0 left-0 h-[100dvh] w-72 z-50 flex flex-col bg-white border-r transform transition-transform lg:transform-none ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`} style={{ borderColor: "var(--border)" }}>
      <div className="p-6 flex items-center gap-3 border-b" style={{ borderColor: "var(--border)" }}><img src="/logo-bumdes.webp" alt="Logo BUMDes Karya Raharja" className="h-11 w-11 shrink-0 rounded-full object-cover"/><div><div className="font-heading font-bold text-base">BUMDES</div><div className="text-xs text-[var(--text-muted)]">Karya Raharja</div></div></div>
      <nav className="flex-1 min-h-0 p-3 space-y-1 overflow-y-auto">{NAV.map(({to,label,icon:Icon,end}) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({isActive}) => `side-link ${isActive ? "active" : ""}`}><Icon size={20}/><span>{label}</span></NavLink>)}</nav>
      <div className="shrink-0 p-4 border-t" style={{ borderColor: "var(--border)" }}><div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm" style={{background:"var(--secondary-blue)",color:"var(--primary-dark)"}}>{user.name?.[0]?.toUpperCase()}</div><div className="min-w-0"><div className="text-sm font-semibold truncate">{user.name || user.username}</div><div className="text-xs text-[var(--text-muted)]">{ROLE_LABELS[user.role] || user.role}</div></div></div><button type="button" onClick={logout} className="btn btn-outline w-full text-sm"><LogOut size={16}/> Keluar</button></div>
    </aside>
    {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} />}
    <main className="flex-1 min-w-0 pt-14 lg:pt-0"><div className="content-shell fade-in"><Outlet /></div></main>
  </div>;
}

export { hasUnitAccess };
