import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
const Landing = lazy(() => import("@/pages/Landing"));
const Login = lazy(() => import("@/pages/Login"));
const ChangePassword = lazy(() => import("@/pages/ChangePassword"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const UnitUsahaPage = lazy(() => import("@/pages/UnitUsahaPage"));
const MitraPage = lazy(() => import("@/pages/MitraPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const Reports = lazy(() => import("@/pages/Reports"));
const ReportsPerUnit = lazy(() => import("@/pages/ReportsPerUnit"));
const Transactions = lazy(() => import("@/pages/Transactions"));
const BukuBesar = lazy(() => import("@/pages/BukuBesar"));
const COAPage = lazy(() => import("@/pages/COAPage"));

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground" role="status" aria-live="polite">
      Memuat halaman...
    </div>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

const ROLES_REPORTS = ["admin", "direktur", "bendahara", "pengelola", "pengawas", "penasihat"];
const ROLES_LEDGER = ["admin", "direktur", "bendahara", "pengelola", "pengawas", "penasihat"];
const ROLES_COA = ["admin", "direktur", "bendahara", "pengawas", "penasihat"];
const ROLES_USERS = ["admin"];

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LazyPage><Landing /></LazyPage>} />
            <Route path="/login" element={<LazyPage><Login /></LazyPage>} />
            <Route path="/change-password" element={<Protected><LazyPage><ChangePassword /></LazyPage></Protected>} />
            <Route path="/profile" element={<Protected><LazyPage><ProfilePage /></LazyPage></Protected>} />
            <Route path="/dashboard" element={<Protected><LazyPage><Dashboard /></LazyPage></Protected>} />
            <Route path="/transactions" element={<Protected><LazyPage><Transactions /></LazyPage></Protected>} />
            <Route path="/reports" element={<Protected roles={ROLES_REPORTS}><LazyPage><Reports /></LazyPage></Protected>} />
            <Route path="/reports/per-unit" element={<Protected><LazyPage><ReportsPerUnit /></LazyPage></Protected>} />
            <Route path="/ledger" element={<Protected roles={ROLES_LEDGER}><LazyPage><BukuBesar /></LazyPage></Protected>} />
            <Route path="/unit-usaha" element={<Protected><LazyPage><UnitUsahaPage /></LazyPage></Protected>} />
            <Route path="/mitra" element={<Protected><LazyPage><MitraPage /></LazyPage></Protected>} />
            <Route path="/accounts" element={<Protected roles={ROLES_COA}><LazyPage><COAPage /></LazyPage></Protected>} />
            <Route path="/users" element={<Protected roles={ROLES_USERS}><LazyPage><UsersPage /></LazyPage></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
