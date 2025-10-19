import { Outlet, Link, useLocation } from "react-router-dom";

const styles = {
  page: { minHeight: "100vh", padding: 24, background: "var(--bg-grad)" },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(6px)",
    borderRadius: 24,
    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
    border: "1px solid rgba(0,0,0,0.05)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    background: "rgba(255,255,255,0.75)",
    borderBottom: "1px solid #e5e7eb",
  },
  logo: {
    height: 40,
    width: 40,
    borderRadius: 9999,
    display: "grid",
    placeItems: "center",
    background: "#7c3aed",
    color: "#fff",
    fontWeight: 700,
  },
  brandSm: { margin: 0, fontSize: 12, color: "#6b7280" },
  brandTitle: { margin: 0, fontSize: 18, fontWeight: 600 },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#6b7280",
    padding: "12px 24px",
    background: "rgba(255,255,255,0.75)",
    borderTop: "1px solid #e5e7eb",
  },
  nav: {
    display: "flex",
    gap: 24,
    alignItems: "center",
  },
  navLink: {
    textDecoration: "none",
    color: "#6b7280",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 16px",
    borderRadius: 8,
    transition: "all 0.2s ease",
  },
  navLinkActive: {
    color: "#7c3aed",
    background: "rgba(124, 58, 237, 0.1)",
  },
};

export default function AdminLayout() {
  const location = useLocation();
  
  const logout = () => {
    localStorage.removeItem("qfo_token");
    const appLogin = import.meta.env.VITE_MYAPP_LOGIN_URL;
    if (!appLogin) {
    throw new Error('VITE_MYAPP_LOGIN_URL is not set in .env');
  }
    // Full redirect to unified login page in my-app
    window.location.assign(appLogin);
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <Link
            to="/admin"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={styles.logo}>Q</div>
            <div>
              <p style={styles.brandSm}>Quality for Outcomes</p>
              <h1 style={styles.brandTitle}>Admin Dashboard</h1>
            </div>
          </Link>
          
          <nav style={styles.nav}>
            <Link
              to="/admin"
              style={{
                ...styles.navLink,
                ...(isActive("/admin") ? styles.navLinkActive : {})
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/admin/terms"
              style={{
                ...styles.navLink,
                ...(isActive("/admin/terms") ? styles.navLinkActive : {})
              }}
            >
              Terms & Conditions
            </Link>
            <Link
              to="/admin/newsletter"
              style={{
                ...styles.navLink,
                ...(isActive("/admin/newsletter") ? styles.navLinkActive : {})
              }}
            >
              Newsletter
            </Link>
          </nav>
          
          <button
            onClick={logout}
            style={{
              border: "none",
              background: "#f3f4f6",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 14,
            }}
          >
            Logout
          </button>
        </header>
        <main>
          <Outlet />
        </main>
        <footer style={styles.footer}>
          © {new Date().getFullYear()} Quality for Outcomes — Admin
        </footer>
      </div>
    </div>
  );
}
