import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchSubscription } from "../services/api";
import SupportPanel from "../components/SupportPanel";
import "../style/Nav.css";
import logo from "../assets/logo.png";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'pro' | 'premium'>('free');
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user subscription when logged in
  useEffect(() => {
    const loadUserSubscription = async () => {
      // Only fetch if user is logged in
      if (!user) {
        setUserPlan('free');
        return;
      }

      setIsLoadingPlan(true);
      try {
        const result = await fetchSubscription();

        if (result.success && result.data) {
          const planId = result.data.planId || '';
          
          // Determine plan type from planId
          let plan: 'free' | 'pro' | 'premium' = 'free';
          if (planId.toLowerCase().includes('premium')) {
            plan = 'premium';
          } else if (planId.toLowerCase().includes('pro')) {
            plan = 'pro';
          }

          console.log('📍 Navbar - Loaded subscription:', {
            planId,
            detectedPlan: plan,
            subscriptionData: result.data
          });

          setUserPlan(plan);
        } else {
          // No subscription = free user
          console.log('📍 Navbar - No subscription found, defaulting to free');
          setUserPlan('free');
        }
      } catch (err) {
        console.error('Failed to load subscription in Navbar:', err);
        // On error, default to free
        setUserPlan('free');
      } finally {
        setIsLoadingPlan(false);
      }
    };

    loadUserSubscription();
  }, [user]); // Re-fetch when user changes (login/logout)

  // Check if user has access to support (Pro or Premium)
  const hasSupportAccess = userPlan === 'pro' || userPlan === 'premium';

  console.log('🔍 Navbar render:', {
    user: user?.email,
    userPlan,
    hasSupportAccess,
    isLoadingPlan
  });

  // Handle support click
  const handleSupportClick = () => {
    setMenuOpen(false); // Close menu
    console.log('✅ Opening support panel for plan:', userPlan);
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

            <div className={`menu-content ${menuOpen ? "visible" : ""}`}>
              <Link to="/project" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>

              {/* Support Button - Only show for Pro & Premium */}
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

      {/* Support Panel - Only render for Pro & Premium */}
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