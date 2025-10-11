import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Support.css";

interface SupportPanelProps {
  onClose: () => void;
  supportEmail?: string;
  defaultSubject?: string;
}

const SupportPanel: React.FC<SupportPanelProps> = ({
  onClose,
  supportEmail = "info@qualityoutcomes.au",
  defaultSubject = "Support Request",
}) => {
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'premium'>('free');
  const navigate = useNavigate();

  // Check user plan on mount
  useEffect(() => {
    const plan = localStorage.getItem('userPlan') || 'free';
    setUserPlan(plan as 'free' | 'pro' | 'premium');
    
    console.log('🔍 SupportPanel - User plan:', plan);
    
    // If free user, close panel and redirect
    if (plan === 'free') {
      console.log('❌ Free user tried to access support panel - closing');
      onClose();
      navigate('/subscription');
    }
  }, [onClose, navigate]);

  // Don't render anything for free users
  if (userPlan === 'free') {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!message) return;

    const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(
      defaultSubject
    )}&body=${encodeURIComponent(message)}`;

    // Open user's default email client
    window.location.href = mailtoLink;

    // Optional: show success message in modal
    setSubmitted(true);
    setTimeout(() => onClose(), 2000);
  };

  return (
    <>
      <div className="support-overlay" onClick={onClose}></div>
      <div className="support-panel">
        <div className="support-header">
          <h2>Contact Support</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {submitted ? (
          <div className="success-message">
            <p>✓ Your message is ready! Please send it from your email.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="support-form">
            <div className="form-group">
              <label>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Describe your issue in detail..."
                rows={6}
              />
            </div>

            <button type="submit" className="submit-btn">
              Send Message
            </button>
          </form>
        )}
      </div>
    </>
  );
};

export default SupportPanel;