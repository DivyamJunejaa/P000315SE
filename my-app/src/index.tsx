import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";

import App from "./pages/App";
import ProfilePage from "./pages/profile";
import Navbar from "./components/Nav";
import ProjectCreate from "./pages/Project";
import ProjectsPage from "./pages/Project";

import AuthCard from "./components/AuthCard";
import PrivateRoute from "./auth/PrivateRoute";        
import { AuthProvider } from "./auth/AuthProvider";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";     
import SubscriptionPlans from "./pages/SubscriptionPlans";
import SubscriptionSuccess from "./pages/SubscriptionSuccess";
import Logout from "./pages/Logout";
import Terms from "./pages/Terms";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <AuthProvider>                                     
      <Router>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<AuthCard />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<Terms />} />
          <Route
            path="/plans"
            element={
              <PrivateRoute>
                <SubscriptionPlans />
              </PrivateRoute>
            }
          />
          <Route path="/logout" element={<Logout />} />
          <Route path="/subscription-success" element={<SubscriptionSuccess />} />

          {/* Protected*/}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <ProjectsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          
          <Route
            path="/project"
            element={
              <PrivateRoute>
                <ProjectCreate />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  </React.StrictMode>
);