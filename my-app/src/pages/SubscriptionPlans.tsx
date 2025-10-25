import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../style/Plans.css";
import { createCheckoutSession } from "../services/api";
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
  const PRO_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_PRO || "No REACT_APP_STRIPE_PRICE_PRO found in env";
  const PREMIUM_PRICE_ID = process.env.REACT_APP_STRIPE_PRICE_PREMIUM || "NO REACT_APP_STRIPE_PRICE_PREMIUM foung in env";
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

  // Read userId snapshot from localStorage
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

  // Handle selecting Free plan without Stripe checkout
  function selectFree() {
    const userId = getUserId();
    if (!userId) {
      setToast({ message: "You must be logged in to select Free.", type: "error" });
      setError("You must be logged in to select Free.");
      return;
    }
    if (currentPlanId === "free") {
      setToast({ message: "Already on this plan.", type: "info" });
      setError("Already on this plan.");
      return;
    }

    setActivePlan("free");
    setError("");

    // Redirect to success page where subscription syncing and localStorage update occurs
    const successUrl = `${FRONTEND_ORIGIN}/subscription-success?status=success&plan=free&price=${encodeURIComponent("Free")}`;
    // Navigate within SPA by stripping origin
    navigate(successUrl.replace(FRONTEND_ORIGIN, ""));
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
    
    // Optional Payment Links fallback (behind explicit flag)
    const USE_PAYMENT_LINKS = (process.env.REACT_APP_USE_PAYMENT_LINKS || "false").toLowerCase() === "true";
    const PRO_LINK_URL = process.env.REACT_APP_STRIPE_LINK_PRO || "";
    const PREMIUM_LINK_URL = process.env.REACT_APP_STRIPE_LINK_PREMIUM || "";

    // Prefer Payment Links only when explicitly enabled and URLs provided
    if (USE_PAYMENT_LINKS) {
      const baseLinkUrl = plan.id === 'pro' ? PRO_LINK_URL : plan.id === 'premium' ? PREMIUM_LINK_URL : null;
      if (baseLinkUrl) {
        // Build Payment Link with prefilled email and client reference id so Stripe shows/editable email
        const params = new URLSearchParams();
        if (userEmail) params.set('prefilled_email', userEmail);
        params.set('client_reference_id', String(userId));
        const linkUrl = `${baseLinkUrl}${baseLinkUrl.includes('?') ? '&' : '?'}${params.toString()}`;
        console.info('Redirecting to Stripe Payment Link', { plan: plan.id, linkUrl });
        window.location.href = linkUrl;
        return;
      }
    }

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

      const { url } = await createCheckoutSession({
        price_id: plan.stripe_price_id,
        user_id: userId || 'guest',
        email: userEmail || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

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

        {/* Plans grid listing */}
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

        {/* Back to workspace link */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/project" style={{ color: "#007bff", textDecoration: "underline" }}>Back to Workspace</a>
        </div>
      </div>
    </div>
  );
}