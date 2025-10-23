// AppRoutes: central routing setup for the admin UI.
// Wraps AdminLayout in ProtectedRoute so only authenticated access to /admin pages.
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout.jsx";
import ProtectedRoute from "../routes/ProtectedRoutes.jsx";
import NotFound from "../pages/NotFound.jsx";
import Dashboard from "../features/admin/AdminDashboard.jsx";
import TermsManagement from "../features/admin/TermsManagement.jsx";
import Newsletter from "../features/admin/Newsletter.jsx";

export default function AppRoutes() {
  // Central place to register new admin pages
  return (
    <Routes>
      {/* Protected admin shell; all nested routes require auth */}
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        {/* Redirect bare root to main admin dashboard */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Dashboard />}/>
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="/admin/terms" element={<TermsManagement />} />
        <Route path="/admin/newsletter" element={<Newsletter />} />
      </Route>

      {/* Catch-all for unknown paths */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
