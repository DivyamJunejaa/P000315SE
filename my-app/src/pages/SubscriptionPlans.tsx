import React, { useEffect, useState } from "react";
import "../style/Plans.css";
import { createCheckoutSession } from "../services/api";

type Plan = {
  id: "free" | "pro" | "premium";
  name: string;
  price?: string;
  features?: string[];
  stripe_price_id?: string; // Stripe price ID for API checkout
};

export default function SubscriptionPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string>("");
  const [activePlan, setActivePlan] = useState<string | null>(null);

  useEffect(() => {
    // Build plans with Stripe price IDs for proper checkout session creation
    const list: Plan[] = [
      { id: "free", name: "Free", price: "Free", features: ["Basic access"] },
      { id: "pro", name: "Pro", price: "$20", features: ["Form & Visual editor", "Export diagram"], stripe_price_id: "price_1S8tsnQTtrbKnENdYfv6azfr" },
      { id: "premium", name: "Premium", price: "$40", features: ["Everything in Pro", "Advanced customization"], stripe_price_id: "price_1SB17tQTtrbKnENdT7aClaEe" },
    ];
    setPlans(list);
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

  async function subscribe(plan: Plan) {
    const userId = getUserId();
    if (!userId) return setError("You must be logged in to subscribe.");
    if (!plan.stripe_price_id) return setError("Plan is not available.");
    
    setError("");
    setActivePlan(plan.id);
    
    try {
      // Construct success and cancel URLs using dynamic origin
      // Include Checkout Session ID placeholder so Stripe injects actual session_id
       const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
      const baseSuccessUrl = `${frontendOrigin}/subscription-success?status=success`;
      const cancelUrl = `${frontendOrigin}/profile?subscription=cancelled`;
      const successUrl = `${baseSuccessUrl}&plan=${plan.id}&price=${encodeURIComponent(plan.price || '')}&session_id={CHECKOUT_SESSION_ID}`;
      
      console.log("Attempting to create checkout session for:", {
        plan: plan.id,
        price_id: plan.stripe_price_id,
        user_id: userId,
        success_url: successUrl,
        cancel_url: cancelUrl
      });
      
      // Try to create checkout session with API first
      const { url } = await createCheckoutSession({
        price_id: plan.stripe_price_id,
        user_id: userId,
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      
      console.log("Checkout session created successfully, redirecting to:", url);
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      console.error("API checkout failed, falling back to direct Stripe links:", err);
      
      // Construct success and cancel URLs for fallback
      // Redirect to profile page with subscription status (same as main flow)
      const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
      const baseSuccessUrl = `${frontendOrigin}/subscription-success?status=success`;
      const cancelUrl = `${frontendOrigin}/profile?subscription=cancelled`;
      const successUrl = `${baseSuccessUrl}&plan=${plan.id}&price=${encodeURIComponent(plan.price || '')}`;
      
      // Fallback to direct Stripe hosted checkout links with proper redirect URLs
      const fallbackUrls = {
        'pro': 'https://buy.stripe.com/test_5kQ7sN7107iZ38n8YV9MY00',
        'premium': 'https://buy.stripe.com/test_14A3cx0CC8n3bETb739MY01'
      };
      
      const baseUrl = fallbackUrls[plan.id as keyof typeof fallbackUrls];
      if (baseUrl) {
        // Add success_url and cancel_url parameters to the Stripe link
        const urlParams = new URLSearchParams({
          'success_url': successUrl,
          'cancel_url': cancelUrl
        });
        
        const fallbackUrl = `${baseUrl}?${urlParams.toString()}`;
        console.log("Using fallback Stripe link with redirect URLs:", fallbackUrl);
        window.location.href = fallbackUrl;
      } else {
        console.error("No fallback URL available for plan:", plan.id);
        setError("Checkout is temporarily unavailable. Please try again later.");
        setActivePlan(null);
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-card plans-card">
        <h1 className="login-title">Choose a Plan</h1>
        <p className="plans-subtitle">Select a subscription to unlock premium features.</p>

        {error && <p className="error">{error}</p>}

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
                {p.id === "free" ? (
                  <div className="plan-current">Your current plan</div>
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