// Protected route: renders child only when authenticated
import { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

type Props = {
  children: ReactElement;
};

export default function PrivateRoute({ children }: Props) {
  const { user, loading } = useAuth(); // Add loading state in your AuthProvider

  if (loading) return <div>Loading...</div>; // or a spinner

  return user ? children : <Navigate to="/login" replace />;
}
