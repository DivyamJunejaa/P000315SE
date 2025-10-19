import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchSubscription, syncStripeSubscription, updateSubscription } from "../services/api";
import SupportPanel from "../components/SupportPanel";
import "../style/Nav.css";
import logo from "../assets/logo.png";

// Local plan helper (removed shared planMapping)
const detectTierFromPlanId = (planId?: string | null): 'free' | 'pro' | 'premium' => {
  const id = String(planId || '').toLowerCase();
  if (!id || id.includes('free') || id === 'price_free') return 'free';
  const PRO_ID = (process.env.REACT_APP_STRIPE_PRICE_PRO || 'price_1S8tsnQTtrbKnENdYfv6azfr').toLowerCase();
  const PREMIUM_ID = (process.env.REACT_APP_STRIPE_PRICE_PREMIUM || 'price_1SB17tQTtrbKnENdT7aClaEe').toLowerCase();
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
        // Post-checkout recovery: if we have a pending session, sync it
        const pendingSessionId = (() => {
          try { return localStorage.getItem('pendingCheckoutSessionId') || null; } catch { return null; }
        })();
        const pendingPriceId = (() => {
          try { return localStorage.getItem('pendingPlanId') || null; } catch { return null; }
        })();

        if (pendingSessionId) {
          try {
            console.info('🔄 Recovering subscription from pending Checkout session', { session_id: pendingSessionId });
            const resp = await syncStripeSubscription({
              session_id: pendingSessionId,
              user_id: (user as any)?.userId,
              email: user?.email,
            });
            if (resp?.success && resp?.data) {
              const payload = {
                subscriptionId: resp.data.subscriptionId,
                email: resp.data.email,
                planId: resp.data.planId,
                status: resp.data.status,
                startDate: resp.data.startDate,
                renewalDate: resp.data.renewalDate,
                expiresAt: resp.data.expiresAt,
                autoRenew: resp.data.autoRenew,
              };
              try { await updateSubscription(payload); } catch (e) { console.warn('UpdateSubscription failed during recovery:', e); }

              // Persist local state for gating/UI
              try {
                localStorage.setItem('subscriptionData', JSON.stringify(payload));
                localStorage.setItem('planId', payload.planId);
                const tier = detectTierFromPlanId(payload.planId || pendingPriceId);
                localStorage.setItem('userPlan', tier);
                // Legacy snapshot for Profile page
                const legacy = {
                  plan: tier === 'premium' ? 'Premium Plan' : tier === 'pro' ? 'Pro Plan' : 'Free Plan',
                  price: '',
                  status: payload.status,
                  subscriptionId: payload.subscriptionId,
                  sessionId: pendingSessionId,
                  activatedAt: payload.startDate,
                  expiry: payload.expiresAt,
                };
                localStorage.setItem('userSubscription', JSON.stringify(legacy));
              } catch {}

              // Clear pending markers
              try {
                localStorage.removeItem('pendingCheckoutSessionId');
                localStorage.removeItem('pendingPlanId');
                localStorage.removeItem('pendingPlanTier');
              } catch {}
            }
          } catch (syncErr) {
            console.warn('Checkout recovery sync failed:', syncErr);
          }
        }

        const result = await fetchSubscription();

        if (result.success && result.data) {
          const planId = result.data.planId || '';
          const plan = detectTierFromPlanId(planId);

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
          {/* Subscription status pill */}
          <span
            style={{
              marginLeft: 8,
              padding: '4px 10px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 600,
              background:
                userPlan === 'premium'
                  ? 'rgba(234, 179, 8, 0.15)'
                  : userPlan === 'pro'
                  ? 'rgba(124, 58, 237, 0.15)'
                  : 'rgba(107, 114, 128, 0.15)',
              color:
                userPlan === 'premium'
                  ? '#92400e'
                  : userPlan === 'pro'
                  ? '#7c3aed'
                  : '#6b7280',
              border:
                userPlan === 'premium'
                  ? '1px solid #fbbf24'
                  : userPlan === 'pro'
                  ? '1px solid #a78bfa'
                  : '1px solid #d1d5db',
            }}
          >
            {isLoadingPlan ? 'Checking…' : userPlan === 'premium' ? 'Premium' : userPlan === 'pro' ? 'Pro' : 'Free'}
          </span>
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