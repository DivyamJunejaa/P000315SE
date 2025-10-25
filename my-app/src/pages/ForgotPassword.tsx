import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { forgotPassword } from "../services/api";
import { validateEmailDetailed } from "../utils/validation";
import "../style/Login.css";
import logo from "../assets/logo.png";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  // Validate email input
  const validateForm = (): string => {
    const emailErr = validateEmailDetailed(email.trim());
    if (emailErr) return emailErr;
    return "";
  };

  // Handle reset request submission
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
      const response = await forgotPassword({
        email: email.trim()
      });

      if (response.success) {
        // Store email for the reset password page
        localStorage.setItem('resetEmail', email.trim());
        setSuccess(true);
      } else {
        setError(response.message || "Something went wrong. Please try again.");
        setSuccess(false);
      }
    } catch (err: any) {
      console.error("Error sending reset email:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-card login-mode">
        <div className="login-logo">
          <img src={logo} alt="App Logo" />
        </div>

        <h1 className="login-title">Reset Password</h1>
        <p style={{ textAlign: "center", marginBottom: "20px", color: "#666" }}>
          Enter your email address and we'll send you a reset code.
        </p>

        {/* Email input */}
        <label htmlFor="email" className="formRow">Email Address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          required
        />

        {/* Submit reset request */}
        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? "Sending..." : "Send Reset Code"}
        </button>

        {/* Error or success feedback */}
        {error && <p className="error">{error}</p>}
        {success && (
          <div>
            <p className="success">
              If this email exists, you will receive a reset code
            </p>
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              {/* Link to reset page when code is available */}
              <button 
                type="button" 
                className="link-button"
                onClick={() => navigate("/reset-password")}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "#007bff", 
                  textDecoration: "underline", 
                  cursor: "pointer" 
                }}
              >
                I have a reset code
              </button>
            </div>
          </div>
        )}

        {/* Back to login link */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
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

export default ForgotPassword;