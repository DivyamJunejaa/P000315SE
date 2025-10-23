// Simple role-based routing helpers for My App.
// Determines if a user is admin vs regular and redirects accordingly.
import { NavigateFunction } from "react-router-dom";

export type UserRole = "admin" | "user";

export type User = {
  role?: UserRole | string;
  userRole?: UserRole | string;
  user_role?: UserRole | string;
  email?: string;
  [key: string]: any;
};

// Pick the role from various possible fields, defaulting to "user".
export function determineUserRole(user: User): UserRole {
  const r = (user?.role ?? user?.userRole ?? user?.user_role ?? "user").toString().toLowerCase();
  return r === "admin" ? "admin" : "user";
}

function getAdminUrl(): string {
  // CRA-style env for my-app
  const envUrl = process.env.REACT_APP_ADMIN_URL;
  if (!envUrl) {
    throw new Error('REACT_APP_ADMIN_URL is not defined');
  }
  // Default to Vite dev port used by qfo-admin
  return envUrl;
}

function getMyAppDashboardUrl(): string {
  // Default to projects dashboard root
  //const envUrl = process.env.REACT_APP_USER_DASHBOARD_URL;
  //if (!envUrl) {
   // throw new Error('REACT_APP_ADMIN_URL is not defined');
  //}
  const envUrl = "/";
  return envUrl;
}

// Redirect admins to the admin app (full page) and users within my-app.
export function handleRoleBasedRedirect(user: User, navigate: NavigateFunction) {
  const role = determineUserRole(user);
  if (role === "admin") {
    const adminBase = getAdminUrl();
    const token = localStorage.getItem("token") || "";
    const url = new URL(adminBase);
    if (token) {
      url.searchParams.set("token", token);
    }
    // Full page redirect to admin app
    window.location.assign(url.toString());
    return;
  }
  // Regular user: navigate within my-app
  navigate(getMyAppDashboardUrl(), { replace: true });
}