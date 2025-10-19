import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Plans.css";
import { createCheckoutSession, cancelSubscription, updateSubscription, syncStripeSubscription } from "../services/api";
 import Toast from "../components/Toast";

type Plan = {
  id: "free" | "pro" | "premium";
  name: string;
  price?: string;
  features?: string[];
  stripe_price_id?: string; // Stripe price ID for API checkout
};

export default function SubscriptionPlans() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string>("");
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<"free" | "pro" | "premium">("free");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" | "info" } | null>(null);

  // Read Stripe price IDs from environment with sensible defaults
  const PRO_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_PRO || "price_1S8tsnQTtrbKnENdYfv6azfr";
  const PREMIUM_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_PREMIUM || "price_1SB17tQTtrbKnENdT7aClaEe";
  // Force frontend origin for Stripe redirects – prefer actual runtime origin
  const FRONTEND_ORIGIN = (typeof window !== 'undefined' && window.location.origin) || process.env.REACT_APP_FRONTEND_ORIGIN || "http://localhost:3000";

  useEffect(() => {
    // Build plans with Stripe price IDs for proper checkout session creation
    const list: Plan[] = [
      { id: "free", name: "Free", price: "Free", features: ["Basic access"] },
      { id: "pro", name: "Pro", price: "$20", features: ["Form & Visual editor", "Export diagram"], stripe_price_id: PRO_PRICE_ID },
      { id: "premium", name: "Premium", price: "$40", features: ["Everything in Pro", "Advanced customization"], stripe_price_id: PREMIUM_PRICE_ID },
    ];
    setPlans(list);
  }, []);

  useEffect(() => {
    // Determine current plan from localStorage (saved in Profile/Success flows)
    try {
      const raw = localStorage.getItem("userSubscription");
      if (raw) {
        const sub = JSON.parse(raw);
        const planName = String(sub?.plan || "").toLowerCase();
        if (planName.includes("premium")) setCurrentPlanId("premium");
        else if (planName.includes("pro")) setCurrentPlanId("pro");
        else setCurrentPlanId("free");
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  const getUserId = () => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      return Number(u?.userId || u?.id || null);
    } catch {
      return null;
    }
  };

  async function selectFree() {
    const userId = getUserId();
    if (!userId) {
      setToast({ message: "You must be logged in to select Free.", type: "error" });
      setError("You must be logged in to select Free.");
      return;
    }

    // If already free, do nothing
    if (currentPlanId === "free") {
      setToast({ message: "Already on this plan.", type: "info" });
      setError("Already on this plan.");
      return;
    }

    // When switching from Pro/Premium to Free, cancel the existing Stripe subscription
    setActivePlan("free");
    setError("");

    const userEmail = (() => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return undefined;
        const u = JSON.parse(raw);
        return (u?.email || undefined) as string | undefined;
      } catch { return undefined; }
    })();

    const localSub = (() => {
      try {
        const raw = localStorage.getItem("userSubscription");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();

    let subscriptionId = (() => {
      try {
        const subId = localSub?.subscriptionId;
        if (subId && (String(subId).startsWith('sub_') || String(subId).startsWith('cs_'))) return String(subId);
        const csId = localSub?.sessionId;
        if (csId && typeof csId === 'string' && csId.startsWith('cs_') && csId !== 'cs_test_preview') return csId;
        return undefined;
      } catch { return undefined; }
    })();

    // Resolve canonical subscriptionId from Stripe before canceling
    let synced: any = null;
    if (!subscriptionId) {
      try {
        const sync = await syncStripeSubscription({ user_id: userId, email: userEmail });
        if (sync?.success && sync?.data?.subscriptionId) {
          subscriptionId = sync.data.subscriptionId;
          synced = sync.data;
        }
      } catch (e: any) {
        console.warn('Failed to resolve subscription from Stripe before cancel:', e?.message || e);
      }
    }

    try {
      const result = await cancelSubscription({
        user_id: userId,
        subscription_id: subscriptionId,
        email: userEmail,
      });

      if (result.success) {
        // Update database to reflect cancellation immediately
        try {
          const now = new Date();
          const payload = {
            subscriptionId: subscriptionId || `${userId}-${now.getTime()}`,
            email: userEmail || (synced?.email ?? ''),
            planId: (synced?.planId) || (localSub?.planId || 'unknown'),
            status: 'cancelled',
            startDate: synced?.startDate || localSub?.activatedAt || now.toISOString(),
            renewalDate: synced?.renewalDate || now.toISOString(),
            expiresAt: synced?.expiresAt || now.toISOString(),
            autoRenew: false,
          };
          await updateSubscription(payload);
        } catch (e) {
          console.warn('Failed to sync cancellation to DB:', e);
        }

        setToast({ message: "Subscription canceled. Switched to Free.", type: "success" });
        // Navigate to success page where local state sync can occur
        const successUrl = `${FRONTEND_ORIGIN}/subscription-success?status=success&plan=free&price=${encodeURIComponent("Free")}`;
        navigate(successUrl.replace(FRONTEND_ORIGIN, ""));
      } else {
        setToast({ message: "Failed to cancel subscription.", type: "error" });
        setError("Failed to cancel subscription.");
        setActivePlan(null);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to cancel subscription";
      console.error("Free plan selection → cancel failed:", err);
      setToast({ message: msg, type: "error" });
      setError(msg);
      setActivePlan(null);
    }
  }

  async function subscribe(plan: Plan) {
    const userId = getUserId();
    const userEmail = (() => {
      try {
        const raw = localStorage.getItem("user");
        if (!raw) return null;
        const u = JSON.parse(raw);
        return (u?.email || null) as string | null;
      } catch {
        return null;
      }
    })();
    if (!userId) {
      setToast({ message: "You must be logged in to subscribe.", type: "error" });
      return setError("You must be logged in to subscribe.");
    }

    // Block duplicate payments for users already on Pro/Premium
    if (currentPlanId !== "free") {
      setToast({ message: "You are already on pro/premium plan", type: "warning" });
      setError("You are already on pro/premium plan");
      return;
    }

    // Prefer Payment Links when enabled
    const USE_PAYMENT_LINKS = (process.env.REACT_APP_USE_PAYMENT_LINKS || "false").toLowerCase() === "true";
    const PRO_LINK_URL = process.env.REACT_APP_STRIPE_LINK_PRO || "";
    const PREMIUM_LINK_URL = process.env.REACT_APP_STRIPE_LINK_PREMIUM || "";
    const baseLinkUrl = plan.id === 'pro' ? PRO_LINK_URL : plan.id === 'premium' ? PREMIUM_LINK_URL : null;

    if (USE_PAYMENT_LINKS) {
      if (baseLinkUrl) {
        const params = new URLSearchParams();
        if (userEmail) params.set('prefilled_email', userEmail);
        params.set('client_reference_id', String(userId));
        const linkUrl = `${baseLinkUrl}${baseLinkUrl.includes('?') ? '&' : '?'}${params.toString()}`;
        console.info('Redirecting to Stripe Payment Link', { plan: plan.id, linkUrl });
        window.location.href = linkUrl;
        return;
      }
      setToast({ message: `Payment Link not configured for ${plan.id}.`, type: 'error' });
      setError(`Payment Link not configured for ${plan.id}.`);
      return;
    }

    if (!plan.stripe_price_id) {
      setToast({ message: "Plan is not available.", type: "warning" });
      return setError("Plan is not available.");
    }
    if (currentPlanId === plan.id) {
      setToast({ message: "Already on this plan.", type: "info" });
      return setError("Already on this plan.");
    }
    
    setError("");
    setActivePlan(plan.id);

    try {
      // Use API checkout when Payment Links are not configured
      // Always target the known frontend origin to avoid accidental port mismatches (e.g., 3001)
      const baseSuccessUrl = `${FRONTEND_ORIGIN}/subscription-success?status=success`;
      const cancelUrl = `${FRONTEND_ORIGIN}/project?subscription=cancelled`;
      const successUrl = `${baseSuccessUrl}&plan=${plan.id}&price=${encodeURIComponent(plan.price || '')}&session_id={CHECKOUT_SESSION_ID}`;

      console.debug('Starting checkout', {
        plan: plan.id,
        price_id: plan.stripe_price_id,
        user_id: userId || 'guest',
        email: userEmail || undefined,
        FRONTEND_ORIGIN,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      const { url, session_id } = await createCheckoutSession({
        price_id: plan.stripe_price_id!,
        user_id: userId || 'guest',
        email: userEmail || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      // Persist pending session so we can recover if Stripe doesn't auto-redirect
      try {
        if (session_id) localStorage.setItem('pendingCheckoutSessionId', session_id);
        if (plan.stripe_price_id) localStorage.setItem('pendingPlanId', plan.stripe_price_id);
        localStorage.setItem('pendingPlanTier', plan.id);
      } catch {}

      console.info('Redirecting to Stripe Checkout', { url });
      window.location.href = url;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message || err?.message || 'Unknown error';
      console.error('Checkout flow failed:', {
        message: serverMessage,
        error: err,
      });
      setToast({ message: 'Unable to start checkout. Please try again.', type: 'error' });
      setError('Unable to start checkout. Please try again.');
      setActivePlan(null);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card plans-card">
        <h1 className="login-title">Choose a Plan</h1>
        <p className="plans-subtitle">Select a subscription to unlock premium features. We’ll redirect you to Stripe with your email prefilled (editable).</p>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            duration={4000}
            onClose={() => setToast(null)}
          />
        )}

        <div className="plans-grid">
          {plans.map((p) => (
            <div key={p.id} className={`plan-card ${p.id}`}>
              <div className="plan-header">
                <h3 className="plan-title">{p.name}</h3>
                {p.id === "pro" && <span className="plan-badge">Popular</span>}
              </div>

              {p.features && (
                <ul className="plan-features">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}

              {p.price && p.id !== "free" && (
                <div className="plan-price">{p.price}</div>
              )}

              <div className="plan-actions">
                {currentPlanId === p.id && (
                  <div className="plan-current">Your current plan</div>
                )}
                {p.id === "free" ? (
                  <button
                    className="submit-btn"
                    onClick={selectFree}
                    disabled={activePlan === p.id || currentPlanId === p.id}
                  >
                    {activePlan === p.id ? "Redirecting..." : currentPlanId === p.id ? "Selected" : "Select"}
                  </button>
                ) : (
                  <button
                    className="submit-btn"
                    onClick={() => subscribe(p)}
                    disabled={activePlan === p.id}
                  >
                    {activePlan === p.id ? "Redirecting..." : "Subscribe"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/project" style={{ color: "#007bff", textDecoration: "underline" }}>Back to Workspace</a>
        </div>
      </div>
    </div>
  );
}