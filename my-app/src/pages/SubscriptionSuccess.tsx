/*
  SubscriptionSuccess: handles post-checkout success flow.
  - Reads URL params (status, plan, price, session_id, subscription_id)
  - Persists subscription to localStorage in both legacy and unified formats
  - Attempts backend sync for authoritative subscription data
  - Counts down and redirects to profile or login
*/
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { updateSubscription, syncStripeSubscription } from "../services/api";
// Local plan helpers (removed shared planMapping)
const detectTierFromPlanId = (planId?: string | null): 'free' | 'pro' | 'premium' => {
  const id = String(planId || '').toLowerCase();
  if (!id || id.includes('free') || id === 'price_free') return 'free';
  const PRO_ID = (process.env.REACT_APP_STRIPE_PRICE_PRO || 'price_1SJOoqQTtrbKnENdq6xX75de').toLowerCase();
  const PREMIUM_ID = (process.env.REACT_APP_STRIPE_PRICE_PREMIUM || 'price_1SJP2sQTtrbKnENdbIpAzwMv').toLowerCase();
  if (id === PRO_ID || id.includes('pro')) return 'pro';
  if (id === PREMIUM_ID || id.includes('premium')) return 'premium';
  return 'free';
};

const tierToDisplayName = (tier: 'free' | 'pro' | 'premium'): string => {
  if (tier === 'premium') return 'Premium Plan';
  if (tier === 'pro') return 'Pro Plan';
  return 'Free Plan';
};

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const hasSyncedRef = useRef(false);
  
  // Parse subscription-related parameters from the URL for post-checkout handling
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const status = params.get("status") || "success";
  const plan = params.get("plan"); // Extract plan from URL parameters
  const price = params.get("price"); // Extract price from URL parameters
  const rawSubscriptionParam = params.get("subscription_id");
  // Sanitize: only accept real Stripe IDs (sub_..., cs_...); ignore placeholders
  const subscriptionId = (rawSubscriptionParam && (rawSubscriptionParam.startsWith("sub_") || rawSubscriptionParam.startsWith("cs_")))
    ? rawSubscriptionParam
    : null;

  // Plan display helpers now centralized

  // On mount: persist local subscription snapshot and start redirect countdown
  useEffect(() => {
    // Store subscription information in localStorage
    if (status === "success" && plan) {
      const now = new Date();
      const expiryISO = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const tier = detectTierFromPlanId(plan);
      const displayPlan = tierToDisplayName(tier);

      // Legacy shape used by Profile page (keep for compatibility)
      const legacySubscription = {
        plan: displayPlan,
        price: price || "",
        status: "active",
        subscriptionId: subscriptionId,
        expiry: expiryISO, // store ISO for reliable parsing everywhere
        sessionId: sessionId,
        activatedAt: now.toISOString()
      };
      try { localStorage.setItem("userSubscription", JSON.stringify(legacySubscription)); } catch {}

      // Unified subscription data used by Dashboard/Nav gating
      const unified = {
        subscriptionId: subscriptionId || sessionId || `${(user as any)?.userId ?? "unknown"}-${now.getTime()}`,
        email: ((): string => {
          try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw)?.email || "" : user?.email || "";
          } catch { return user?.email || ""; }
        })(),
        planId: plan,
        status: "active",
        startDate: now.toISOString(),
        renewalDate: expiryISO,
        expiresAt: expiryISO,
        autoRenew: true,
        updatedAt: now.toISOString(),
      };
      try {
        localStorage.setItem('subscriptionData', JSON.stringify(unified));
        localStorage.setItem('userPlan', tier);
        localStorage.setItem('planId', plan);
      } catch {}

      // Update user object snapshot
      const existingUser = localStorage.getItem("user");
      if (existingUser) {
        try {
          const userData = JSON.parse(existingUser);
          userData.subscription = legacySubscription;
          localStorage.setItem("user", JSON.stringify(userData));
        } catch (error) {
          console.error("Error updating user data:", error);
        }
      }
    }

    // Log parsed success params for debugging
    console.debug('SubscriptionSuccess params', { status, plan, price, sessionId, user: !!user });

    // Countdown timer for redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Redirect to dashboard/workspace
          if (user) {
            console.info('Success redirect: user authenticated, sending to profile');
            navigate("/profile");
          } else {
            // If not authenticated, redirect to login with a return URL
            console.info('Success redirect: user unauthenticated, sending to login -> profile');
            navigate("/login?redirect=profile&message=Please log in to view your subscription");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Render success message with countdown and manual redirect option
    return () => clearInterval(timer);
  }, [status, plan, price, sessionId, navigate, user]);

  // Sync subscription to backend service
  useEffect(() => {
    // Sync with backend: fetch Stripe details and reconcile local state
    const doSync = async () => {
      if (hasSyncedRef.current) return;
      if (status !== "success" || !plan) return;
      hasSyncedRef.current = true;

      try {
        setSyncLoading(true);
        setSyncError(null);

        const email = user?.email || (() => {
          try {
            const raw = localStorage.getItem("user");
            return raw ? JSON.parse(raw)?.email || "" : "";
          } catch {
            return "";
          }
        })();

        // First sync with Stripe to get authoritative subscription details
        let synced: any = null;
        try {
          const resp = await syncStripeSubscription({
            session_id: sessionId || undefined,
            subscription_id: subscriptionId || undefined,
            user_id: user?.userId || undefined,
            email,
          });
          if (resp?.success) {
            synced = resp.data;
          }
        } catch (stripeErr: any) {
          console.warn("Stripe sync failed, will proceed with local payload:", stripeErr?.message || stripeErr);
        }

        const start = new Date();
        const renewal = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
        const resolvedSubscriptionId: string | undefined = synced?.subscriptionId || subscriptionId || sessionId || undefined;
        const resolvedPriceId: string | undefined = synced?.planId || plan || undefined;
        const resolvedEmail: string = synced?.email || email;
        const payload = {
          subscriptionId: resolvedSubscriptionId || `${user?.userId ?? "unknown"}-${start.getTime()}`,
          email: resolvedEmail,
          planId: resolvedPriceId || 'unknown',
          status: synced?.status || "active",
          startDate: synced?.startDate || start.toISOString(),
          renewalDate: synced?.renewalDate || renewal.toISOString(),
          expiresAt: synced?.expiresAt || renewal.toISOString(),
          autoRenew: typeof synced?.autoRenew === 'boolean' ? synced.autoRenew : true,
        };

        await updateSubscription(payload);
        setSyncSuccess(true);

        // After successful sync, update localStorage with resolved plan details
        try {
          const tier = detectTierFromPlanId(resolvedPriceId || plan);
          const displayPlan = tierToDisplayName(tier);

          const formattedPrice = price || "";

          const subscriptionDataRaw = localStorage.getItem("userSubscription");
          const existing = subscriptionDataRaw ? JSON.parse(subscriptionDataRaw) : {};
          const updated = {
            ...existing,
            plan: displayPlan,
            price: formattedPrice,
            status: "active",
            subscriptionId: resolvedSubscriptionId || existing?.subscriptionId,
            sessionId: sessionId || synced?.checkoutSessionId || existing?.sessionId,
          };
          localStorage.setItem("userSubscription", JSON.stringify(updated));

          // Also store unified subscriptionData and quick-access keys used by gating
          const subscriptionData = {
            subscriptionId: payload.subscriptionId,
            email: payload.email,
            planId: payload.planId,
            status: payload.status,
            startDate: payload.startDate,
            renewalDate: payload.renewalDate,
            expiresAt: payload.expiresAt,
            autoRenew: payload.autoRenew,
            updatedAt: new Date().toISOString(),
          };
          try {
            localStorage.setItem('subscriptionData', JSON.stringify(subscriptionData));
            localStorage.setItem('userPlan', tier);
            localStorage.setItem('planId', payload.planId);
          } catch {}

          const userRaw = localStorage.getItem("user");
          if (userRaw) {
            const u = JSON.parse(userRaw);
            u.subscription = updated;
            localStorage.setItem("user", JSON.stringify(u));
          }
        } catch (e) {
          console.warn("Failed to update local subscription state with Stripe data", e);
        }
      } catch (err: any) {
        setSyncError(err?.message || "Failed to update subscription");
      } finally {
        setSyncLoading(false);
      }
    };

    doSync();
  }, [status, plan, sessionId, user]);

  // Allow user to skip countdown and go to the next page immediately
  const handleRedirectNow = () => {
    if (user) {
      console.info('Manual redirect: opening profile');
      navigate("/profile");
    } else {
      console.info('Manual redirect: unauthenticated, opening login -> profile');
      navigate("/login?redirect=profile&message=Please log in to view your subscription");
    }
  };

  // Render success message with countdown and manual redirect option
  return (
    <div className="login-container">
      <div className="login-card login-mode">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, color: "#10B981", marginBottom: 16 }}>✅</div>
          <h1 className="login-title">
            {status === "success" ? "Payment Successful!" : "Payment Status"}
          </h1>
        </div>
        
        <p style={{ textAlign: "center", marginBottom: 16, color: "#666" }}>
          {status === "success"
            ? `Thank you! Your ${plan || "subscription"} plan has been activated successfully.`
            : "We are processing your subscription. You can manage it from your profile."}
        </p>

        {plan && price && status === "success" && (
          <div style={{ 
            textAlign: "center", 
            marginBottom: 20, 
            padding: 16, 
            backgroundColor: "#F0FDF4", 
            borderRadius: 8,
            border: "1px solid #BBF7D0"
          }}>
            <p style={{ margin: 0, fontWeight: 600, color: "#059669" }}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - {price}
            </p>
          </div>
        )}

        {/* Subscription sync status */}
        {status === "success" && (
          <div style={{ 
            textAlign: "center", 
            marginBottom: 20, 
            padding: 12, 
            backgroundColor: syncError ? "#FEF2F2" : syncSuccess ? "#F0FDF4" : "#FFF7ED",
            borderRadius: 8,
            border: syncError ? "1px solid #FCA5A5" : syncSuccess ? "1px solid #BBF7D0" : "1px solid #FED7AA"
          }}>
            <p style={{ margin: 0, fontSize: 14, color: syncError ? "#B91C1C" : syncSuccess ? "#065F46" : "#9A3412" }}>
              {syncLoading && "Syncing your subscription with your account..."}
              {!syncLoading && syncSuccess && "Subscription saved to your account."}
              {!syncLoading && !syncSuccess && syncError && `Sync failed: ${syncError}`}
              {!syncLoading && !syncSuccess && !syncError && "Preparing your account..."}
            </p>
          </div>
        )}

        {sessionId && (
          <p style={{ textAlign: "center", color: "#777", fontSize: 12, marginBottom: 16 }}>
            Session: {sessionId}
          </p>
        )}

        <div style={{ 
          textAlign: "center", 
          marginBottom: 20,
          padding: 16,
          backgroundColor: "#EFF6FF",
          borderRadius: 8,
          border: "1px solid #BFDBFE"
        }}>
          <p style={{ margin: 0, color: "#1D4ED8", fontWeight: 500 }}>
            {user 
              ? `Redirecting to your profile in ${countdown} seconds...`
              : `Redirecting to login in ${countdown} seconds...`
            }
          </p>
          {!user && (
            <p style={{ margin: "8px 0 0 0", color: "#6B7280", fontSize: 14 }}>
              Please log in to view your subscription details
            </p>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button 
            onClick={handleRedirectNow}
            style={{
              backgroundColor: "#8750fd",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              marginRight: 12
            }}
          >
            {user ? "Go to Profile Now" : "Login to View Subscription"}
          </button>
          <a href="/profile" style={{ color: "#007bff", textDecoration: "underline" }}>
            Go to Profile
          </a>
        </div>
      </div>
    </div>
  );
}