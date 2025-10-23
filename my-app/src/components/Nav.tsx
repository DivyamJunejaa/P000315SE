import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchSubscription } from "../services/api";
import SupportPanel from "../components/SupportPanel";
import "../style/Nav.css";
import logo from "../assets/logo.png";

/**
 * Determines user tier from Stripe price ID
 * Falls back to 'free' if planId is missing or invalid
 * Checks against environment variables for Pro/Premium price IDs
 */
const detectTierFromPlanId = (planId?: string | null): 'free' | 'pro' | 'premium' => {
  const id = String(planId || '').toLowerCase();
  if (!id || id.includes('free') || id === 'price_free') return 'free';
  
  // Compare against environment-configured Stripe price IDs
  const PRO_ID = (process.env.REACT_APP_STRIPE_PRICE_PRO || 'price_1SJOoqQTtrbKnENdq6xX75de').toLowerCase();
  const PREMIUM_ID = (process.env.REACT_APP_STRIPE_PRICE_PREMIUM || 'price_1SJP2sQTtrbKnENdbIpAzwMv').toLowerCase();
  if (id === PRO_ID || id.includes('pro')) return 'pro';
  if (id === PREMIUM_ID || id.includes('premium')) return 'premium';
  return 'free';
};

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'premium'>('free');
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch and set user subscription plan on mount or when user changes
   * Defaults to 'free' if user is logged out or subscription fetch fails
   * Re-runs whenever user authentication state changes
   */
  useEffect(() => {
    const loadUserSubscription = async () => {
      // Non-authenticated users default to free tier
      if (!user) {
        setUserPlan('free');
        return;
      }

      setIsLoadingPlan(true);
      try {
        const result = await fetchSubscription();

        if (result.success && result.data) {
          const planId = result.data.planId || '';
          const plan = detectTierFromPlanId(planId);

          console.log('Navbar - Loaded subscription:', {
            planId,
            detectedPlan: plan,
            subscriptionData: result.data
          });

          setUserPlan(plan);
        } else {
          // No active subscription means free tier
          setUserPlan('free');
        }
      } catch (err) {
         // Fail gracefully to free tier on error
        setUserPlan('free');
      } finally {
        setIsLoadingPlan(false);
      }
    };

    loadUserSubscription();
  }, [user]); // Dependency: refetch when user login state changes

  // Check if user has access to support Pro or Premium features
  const hasSupportAccess = userPlan === 'pro' || userPlan === 'premium';

  console.log(' Navbar render:', {
    user: user?.email,
    userPlan,
    hasSupportAccess,
    isLoadingPlan
  });

  /**
   * Opens support panel and closes mobile menu
   * Only callable when user has Pro/Premium access
   */
  const handleSupportClick = () => {
    setMenuOpen(false); 
    console.log('Opening support panel for plan:', userPlan);
    setSupportOpen(true);
  };

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="navbar">
        {/* Left: Logo + Company Name */}
        <div className="navbar-left">
          <img src={logo} alt="Logo" className="navbar-logo" />
          <h1 className="navbar-title">Quality for Outcomes</h1>
        </div>

        {/* Right: Hamburger menu only visible if user is logged in */}
        {user && (
          <div className="navbar-right" ref={menuRef}>
            <div
              className={`hamburger ${menuOpen ? "open" : ""}`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </div>

            {/* Dropdown menu with navigation links */}
            <div className={`menu-content ${menuOpen ? "visible" : ""}`}>
              <Link to="/project" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>

              {/* Support Button - Feature-gated for Pro & Premium users only */}
              {hasSupportAccess && (
                <button 
                  className="menu-link-button"
                  onClick={handleSupportClick}
                >
                  Support
                </button>
              )}

              <Link to="/profile" onClick={() => setMenuOpen(false)}>
                Profile
              </Link>

              <Link to="/logout" onClick={() => setMenuOpen(false)}>
                Logout
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Support Panel - Conditionally rendered for Pro & Premium tiers only */}
      {supportOpen && hasSupportAccess && (
        <SupportPanel 
          onClose={() => setSupportOpen(false)}
          supportEmail="info@qualityoutcomes.au"
          defaultSubject="Support Request"
        />
      )}
    </>
  );
};

export default Navbar;