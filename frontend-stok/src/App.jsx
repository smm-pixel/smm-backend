import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth.jsx";
import Layout from "@/components/Layout.jsx";
import Login from "@/pages/Login.jsx";
import DashboardStok from "@/pages/DashboardStok.jsx";
import Products from "@/pages/Products.jsx";
import StockLogs from "@/pages/StockLogs.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Unprotected */}
          <Route path="/login" element={<Login />} />

          {/* Protected operational routes share one layout that guards the session. */}
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardStok />} />
            <Route path="/produk" element={<Products />} />
            <Route path="/mutasi" element={<StockLogs />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
