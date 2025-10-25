import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// Logout page: clears auth and redirects to login
export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Clear auth state and redirect to login
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      Signing out...
    </div>
  );
}