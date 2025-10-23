import React, { useState, useEffect } from "react";
import { Save, FileText, AlertCircle, CheckCircle, Type, Eye } from "lucide-react";
import { fetchTerms, updateTerms, validateTermsContent } from "./api/termsApi";
import RichTextEditor from "../../components/RichTextEditor";

const S = {
  section: { padding: 24 },
  card: { 
    background: "rgba(255,255,255,0.9)", 
    border: "1px solid #e5e7eb", 
    borderRadius: 16, 
    padding: 24,
    marginBottom: 24
  },
  header: { 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between", 
    marginBottom: 24 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 600, 
    color: "#111827", 
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 12
  },
  textarea: {
    width: "100%",
    minHeight: "400px",
    padding: 16,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "inherit",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.2s ease"
  },
  textareaFocus: {
    borderColor: "#7c3aed",
    boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.1)"
  },
  button: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 24px",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.2s ease"
  },
  saveButton: {
    background: "#10b981",
    color: "white"
  },
  saveButtonHover: {
    background: "#059669"
  },
  saveButtonDisabled: {
    background: "#9ca3af",
    cursor: "not-allowed"
  },
  alert: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14
  },
  alertSuccess: {
    background: "#d1fae5",
    color: "#065f46",
    border: "1px solid #a7f3d0"
  },
  alertError: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5"
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 500,
    color: "#374151",
    marginBottom: 8
  },
  meta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    color: "#6b7280"
  },
  spinner: {
    width: 20,
    height: 20,
    border: "2px solid #e5e7eb",
    borderTop: "2px solid #7c3aed",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: 8
  }
};

// Add CSS animation for spinner
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinnerStyle);

export default function TermsManagement() {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [validation, setValidation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [editorMode, setEditorMode] = useState("rich"); // "rich" or "plain"
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    // Validate content on change
    if (content !== originalContent) {
      const validationResult = validateTermsContent(content);
      setValidation(validationResult);
    } else {
      setValidation(null);
    }
  }, [content, originalContent]);

  const loadTerms = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const termsData = await fetchTerms();
      setContent(termsData.content);
      setOriginalContent(termsData.content);
      setLastUpdated(termsData.updatedAt);
      setHasChanges(false);
    } catch (error) {
      console.error("Error fetching terms:", error);
      setMessage({
        type: "error",
        text: "Error loading terms and conditions"
      });
    } finally {
      setLoading(false);
    }
  };

const handleContentChange = (newContent) => {
  setContent(newContent);
  setHasChanges(newContent !== originalContent);
  
  // Clear any existing messages when user starts typing
  if (message) {
    setMessage(null);
  }
};

  const handleSave = async () => {
    if (!hasChanges) {
      setMessage({
        type: "error",
        text: "No changes to save."
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      // Validate before saving
      const validationResult = validateTermsContent(content);
      if (!validationResult.isValid) {
        setMessage({
          type: "error",
          text: `Cannot save: ${validationResult.errors.join(", ")}`
        });
        return;
      }

      const updatedTerms = await updateTerms(content);
      setOriginalContent(updatedTerms.content);
      setLastUpdated(updatedTerms.updatedAt);
      setHasChanges(false);
      setMessage({
        type: "success",
        text: "Terms and conditions updated successfully!"
      });
      setValidation(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving terms:", error);
      setMessage({
        type: "error",
        text: "Error saving terms and conditions"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setContent(originalContent);
    setMessage(null);
    setValidation(null);
    setHasChanges(false);
  };

  const saveTerms = async () => {
    if (!hasChanges) {
      setMessage({
        type: "error",
        text: "No changes to save."
      });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);
      
      // Validate before saving
      const validationResult = validateTermsContent(content);
      if (!validationResult.isValid) {
        setMessage({
          type: "error",
          text: `Cannot save: ${validationResult.errors.join(", ")}`
        });
        return;
      }

      const updatedTerms = await updateTerms(content);
      setOriginalContent(updatedTerms.content);
      setLastUpdated(updatedTerms.updatedAt);
      setHasChanges(false);
      setMessage({
        type: "success",
        text: "Terms and conditions updated successfully!"
      });
      setValidation(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error saving terms:", error);
      setMessage({
        type: "error",
        text: "Error saving terms and conditions"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    // Save with Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (hasChanges && !saving) {
        saveTerms();
      }
    }
  };

  if (loading) {
    return (
      <div style={S.section}>
        <div style={S.card}>
          <div style={S.loading}>
            <div style={S.spinner}></div>
            Loading terms and conditions...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.section}>
      <div style={S.card}>
        <div style={S.header}>
          <h1 style={S.title}>
            <FileText size={28} />
            Terms & Conditions Management
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
              <button
                style={{
                  ...S.button,
                  padding: "8px 12px",
                  background: editorMode === "rich" ? "#7c3aed" : "#f3f4f6",
                  color: editorMode === "rich" ? "white" : "#6b7280",
                  fontSize: 12
                }}
                onClick={() => setEditorMode("rich")}
                title="Rich Text Editor"
              >
                <Type size={14} />
              </button>
              <button
                style={{
                  ...S.button,
                  padding: "8px 12px",
                  background: editorMode === "plain" ? "#7c3aed" : "#f3f4f6",
                  color: editorMode === "plain" ? "white" : "#6b7280",
                  fontSize: 12
                }}
                onClick={() => setEditorMode("plain")}
                title="Plain Text Editor"
              >
                <Eye size={14} />
              </button>
            </div>
            {hasChanges && (
              <button
                style={{
                  ...S.button,
                  background: "#6b7280",
                  color: "white"
                }}
                onClick={resetChanges}
                onMouseOver={(e) => {
                  e.target.style.background = "#4b5563";
                }}
                onMouseOut={(e) => {
                  e.target.style.background = "#6b7280";
                }}
              >
                Reset Changes
              </button>
            )}
            <button
            style={{
              ...S.button,
              ...(saving ? S.saveButtonDisabled : S.saveButton),
              ...(saving ? {} : hasChanges ? {} : S.saveButtonDisabled)
            }}
            onClick={saveTerms}
            disabled={saving || !hasChanges}
            onMouseOver={(e) => {
              if (!saving && hasChanges) {
                e.target.style.background = S.saveButtonHover.background;
              }
            }}
            onMouseOut={(e) => {
              if (!saving && hasChanges) {
                e.target.style.background = S.saveButton.background;
              }
            }}
          >
            {saving ? (
              <>
                <div style={S.spinner}></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Changes
              </>
            )}
          </button>
          </div>
        </div>

        {message && (
          <div style={{
            ...S.alert,
            ...(message.type === "success" ? S.alertSuccess : S.alertError)
          }}>
            {message.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {message.text}
          </div>
        )}

        {validation && validation.warnings.length > 0 && (
          <div style={{
            ...S.alert,
            background: "#fef3c7",
            color: "#92400e",
            border: "1px solid #fbbf24"
          }}>
            <AlertCircle size={16} />
            <div>
              <strong>Warnings:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: 16 }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div>
          <label style={S.label} htmlFor="terms-content">
            Terms and Conditions Content ({editorMode === "rich" ? "Rich Text" : "Plain Text"})
            {validation && (
              <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 8 }}>
                ({validation.wordCount} words, {validation.characterCount} characters)
              </span>
            )}
          </label>
          
          {editorMode === "rich" ? (
            <RichTextEditor
              value={content}
              onChange={handleContentChange}  // Change this line
              placeholder="Enter the terms and conditions content here..."
              height={400}
            />
          ) : (
            <textarea
              id="terms-content"
              style={{
                ...S.textarea,
                borderColor: hasChanges ? "#f59e0b" : "#d1d5db"
              }}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}  // Change this line
              onKeyDown={handleKeyDown}
              placeholder="Enter the terms and conditions content here..."
              onFocus={(e) => {
                e.target.style.borderColor = "#7c3aed";
                e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.1)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = hasChanges ? "#f59e0b" : "#d1d5db";
                e.target.style.boxShadow = "none";
              }}
            />
          )}
          <div style={S.meta}>
            {hasChanges && (
              <span style={{ color: "#f59e0b", fontWeight: 500 }}>
                • Unsaved changes
              </span>
            )}
            {lastUpdated && (
              <span>
                {hasChanges ? " • " : ""}Last updated: {new Date(lastUpdated).toLocaleString()}
              </span>
            )}
            <br />
            <span style={{ fontStyle: "italic" }}>
              Tip: Use Ctrl+S (Cmd+S on Mac) to save quickly
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}