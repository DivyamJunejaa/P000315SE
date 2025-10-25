import React, { useState, useEffect } from "react";
import { fetchTerms } from "../services/api";
import "../style/Terms.css";

export default function Terms() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch and initialize terms content
  useEffect(() => {
    const loadTerms = async () => {
      try {
        setLoading(true);
        const termsData = await fetchTerms();
        setContent(termsData.content || "");
      } catch (err: any) {
        setError(err.message || "Failed to load terms and conditions");
      } finally {
        setLoading(false);
      }
    };

    loadTerms();
  }, []);

  // Convert markdown-style content to HTML for basic formatting
  const formatContent = (text: string) => {
    return text
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>");
  };

  if (loading) {
    return (
      <div className="terms-container">
        <div className="terms-loading">
          <div className="spinner"></div>
          <p>Loading Terms and Conditions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="terms-container">
        <div className="terms-error">
          <h1>Error Loading Terms</h1>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="retry-btn"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    // Prefer closing if the page was opened via script
    if (window.opener) {
      window.close();
      return;
    }
    // If we have navigation history, go back
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    // Final fallback: navigate to login/home
    const fallback = "/login";
    try {
      window.location.assign(fallback);
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="terms-container">
      <div className="terms-content">
        {/* Render formatted terms text */}
        <div
          className="terms-text"
          dangerouslySetInnerHTML={{
            __html: `<p>${formatContent(content)}</p>`,
          }}
        />

        {/* Footer with last updated and close button */}
        <div className="terms-footer">
          <p className="last-updated">
            Last updated: {new Date().toLocaleDateString()}
          </p>
          <button
            onClick={handleClose}
            className="close-btn"
            aria-label="Close terms page"
          >
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}
