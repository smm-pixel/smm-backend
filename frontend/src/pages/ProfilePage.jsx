import { useState } from "react";
import { useAuth } from "@/lib/auth";
import api from "@/lib/api";

export default function ProfilePage() {
  const { user, changePassword } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || "", username: user?.username || "", email: user?.email || "" });
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage(""); setError("");
    try {
      await api.put("/auth/profile", profile);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.detail || "Profil gagal diperbarui");
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setMessage(""); setError("");
    if (passwords.next !== passwords.confirm) return setError("Konfirmasi password tidak sama");
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setMessage("Password berhasil diperbarui");
    } catch (err) {
      setError(err.response?.data?.detail || "Password gagal diperbarui");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Profil Saya</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Kelola identitas akun dan password Anda sendiri.
        </p>
      </div>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        <h2 className="font-heading text-lg font-semibold mb-4">Informasi Profil</h2>
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <label className="label">Nama<input className="input mt-1" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required /></label>
          <label className="label">Username<input className="input mt-1" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} required minLength={3} /></label>
          <label className="label sm:col-span-2">Email<input className="input mt-1" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label>
          <div><button className="btn btn-primary" type="submit">Simpan Profil</button></div>
        </form>
      </section>
      <section className="card">
        <h2 className="font-heading text-lg font-semibold mb-4">Ganti Password</h2>
        <form onSubmit={savePassword} className="grid gap-4">
          <label className="label">Password Saat Ini<input className="input mt-1" type="password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} required /></label>
          <label className="label">Password Baru<input className="input mt-1" type="password" minLength={8} value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} required /></label>
          <label className="label">Konfirmasi Password Baru<input className="input mt-1" type="password" minLength={8} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required /></label>
          <div><button className="btn btn-primary" type="submit">Ganti Password</button></div>
        </form>
      </section>
    </div>
  );
}
