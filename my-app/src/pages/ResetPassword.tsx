import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { resetPassword } from "../services/api";
import { validatePassword } from "../utils/validation";
import "../style/Login.css";
import logo from "../assets/logo.png";

interface ResetForm {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

// Page: ResetPassword — verifies reset code and lets the user set a new password.
// Flow: read email (URL/localStorage) → validate inputs → call API → redirect.
const ResetPassword: React.FC = () => {
  // Search params for email handoff (from link) and local storage fallback
  const [searchParams] = useSearchParams();
  // Local form state for email, token, and new passwords
  const [form, setForm] = useState<ResetForm>({
    email: "",
    token: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // On mount: populate email from URL `?email=` or previously stored `resetEmail`
    const emailFromUrl = searchParams.get('email');
    const emailFromStorage = localStorage.getItem('resetEmail');
    const email = emailFromUrl || emailFromStorage || '';
    
    if (email) {
      setForm(prev => ({ ...prev, email }));
    }
  }, [searchParams]);

  // UI flags and router navigate helper
  const [show, setShow] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  // Controlled inputs update handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Validate: email present, token present, password strength, and match
  const validateForm = (): string => {
    if (!form.email.trim()) return "Email is required. Please go back to the forgot password page.";
    if (!form.token.trim()) return "Please enter your reset code.";
    
    const passErr = validatePassword(form.newPassword);
    if (passErr) return passErr;

    if (form.confirmPassword !== form.newPassword) return "Passwords do not match.";
    
    return "";
  };

  // Submit handler: validate, call API to reset, show success then redirect
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setError(err);
      setSuccess(false);
      return;
    }

    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const response = await resetPassword({
        email: form.email.trim(),
        token: form.token.trim(),
        newPassword: form.newPassword,
      });

      if (response.success) {
        setSuccess(true);
        // Brief pause to let users read success, then navigate to login
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(response.message || "Something went wrong. Please try again.");
        setSuccess(false);
      }
    } catch (err: any) {
      console.error("Error resetting password:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Render: form fields for email, token, password + helper links
  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-card login-mode">
        <div className="login-logo">
          <img src={logo} alt="App Logo" />
        </div>

        <h1 className="login-title">Reset Password</h1>
        <p style={{ textAlign: "center", marginBottom: "20px", color: "#666" }}>
          Enter your reset code and new password.
        </p>

        <label htmlFor="email" className="formRow">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@domain.com"
          required
        />

        <label htmlFor="token" className="formRow">Reset Code</label>
        <input
          id="token"
          name="token"
          type="text"
          value={form.token}
          onChange={handleChange}
          placeholder="Enter your 8-character reset code"
          maxLength={8}
          style={{ textTransform: "uppercase" }}
          required
        />

        <label htmlFor="newPassword" className="formRow">New Password</label>
        <input
          id="newPassword"
          name="newPassword"
          className="pw-input"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={form.newPassword}
          onChange={handleChange}
          placeholder="********"
          required
        />

        <label htmlFor="confirmPassword" className="formRow">Confirm New Password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={show ? "text" : "password"}
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Re-enter new password"
          required
        />

        <div className="show-password" style={{ marginBottom: "20px" }}>
          <label>
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              aria-controls="newPassword confirmPassword"
            />
            Show passwords
          </label>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        {error && <p className="error">{error}</p>}
        {success && (
          <p className="success">
            Password reset successful! Redirecting to login...
          </p>
        )}

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button 
            type="button" 
            className="link-button"
            onClick={() => navigate("/forgot-password")}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#007bff", 
              textDecoration: "underline", 
              cursor: "pointer",
              marginRight: "20px"
            }}
          >
            Request New Code
          </button>
          <button 
            type="button" 
            className="link-button"
            onClick={() => navigate("/login")}
            style={{ 
              background: "none", 
              border: "none", 
              color: "#007bff", 
              textDecoration: "underline", 
              cursor: "pointer" 
            }}
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;