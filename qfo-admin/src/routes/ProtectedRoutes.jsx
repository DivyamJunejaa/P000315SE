// ProtectedRoute: guards admin pages by checking for a token in localStorage.
// Supports one-time token handoff via ?token=... and redirects to my-app login when missing.
import { useEffect, useState} from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  useEffect(() => {
      const checkAuth = () => {
    // On initial load, support token handoff: set qfo_token from ?token=...
    const params = new URLSearchParams(location.search);
    const incomingToken = params.get("token");
    if (incomingToken) {
      localStorage.setItem("qfo_token", incomingToken);
      // Clean the URL to avoid leaking the token in the address bar
      const cleanUrl = location.pathname + location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
    setIsChecking(false);
    };
    checkAuth(); 
  }, [location.search, location.pathname, location.hash]);

  if (isChecking) {
    // Lightweight loader while we process token handoff
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    );
  }

  const hasToken = !!localStorage.getItem("qfo_token");
  if (!hasToken) {
    const appLogin = import.meta.env.VITE_MYAPP_LOGIN_URL;
    if (!appLogin) {
      // If env variable is missing, show error instead of using hardcoded URL
      console.error("VITE_MYAPP_LOGIN_URL is not configured");
      return <div>Configuration error: Login URL not set</div>;
    }
    // Use hard redirect for external URL to unified login page
    window.location.assign(appLogin);
    return null;
  }

  // Auth OK: render the protected children (AdminLayout + nested routes)
  return children;
}