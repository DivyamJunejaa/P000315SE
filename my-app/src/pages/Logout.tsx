/*
  Logout: clears auth state and redirects to login.
  - Calls logout on mount
  - Navigates to /login with replace to prevent back-navigation
*/
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // On mount: clear auth and redirect to login
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