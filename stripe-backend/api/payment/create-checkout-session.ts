import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import crypto from 'crypto';
import { handleCORS } from '../utils/cors';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCORS(req, res)) return;


 

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { price_id, user_id, email, success_url, cancel_url } = req.body;

    // Basic request logging to trace redirect issues and duplicates
    console.log('➡️  create-checkout-session request', {
      origin: req.headers && req.headers.origin,
      price_id,
      user_id,
      email,
      success_url,
      cancel_url,
    });

    if (!stripeSecret || !stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment server is not configured. Missing STRIPE_SECRET_KEY.',
      });
    }

    if (!price_id || !user_id) {
      return res.status(400).json({
        success: false,
        message: 'Price ID and User ID are required'
      });
    }

    // Derive frontend origin (prefer request Origin header, then FRONTEND_ORIGIN, then success_url host, finally localhost:3000)
    let frontendOrigin = 'http://localhost:3000';
    try {
      if (req.headers && req.headers.origin) {
        frontendOrigin = req.headers.origin;
      } else if (process.env.FRONTEND_ORIGIN) {
        frontendOrigin = process.env.FRONTEND_ORIGIN;
      } else if (success_url) {
        const su = new URL(success_url);
        frontendOrigin = `${su.protocol}//${su.host}`; // e.g., http://localhost:3000
      }
    } catch (e) {
      // If parsing fails, fall back to env or origin header
      frontendOrigin = (req.headers && req.headers.origin) || process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    }
    // Avoid accidentally targeting backend port when origin is the backend (e.g., localhost:3001)
    if (/^http:\/\/localhost:3001$/.test(frontendOrigin)) {
      frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    }
    console.log('🔗 Resolved frontendOrigin for redirects:', frontendOrigin);

    // Helper to ensure provided URLs always point to the frontend origin (never the backend)
    const normalizeUrlToFrontend = (url: string | undefined, fallbackPath = '/subscription-success') => {
      try {
        const base = new URL(frontendOrigin);
        // If url is relative or missing, start from fallbackPath
        const candidate = url ? new URL(url, base) : new URL(fallbackPath, base);
        // Force origin to frontend
        candidate.protocol = base.protocol;
        candidate.host = base.host; // includes hostname:port
        return candidate.toString();
      } catch (e) {
        // Fallback to a minimal valid URL on the frontend
        return `${frontendOrigin}${fallbackPath}`;
      }
    };

    // Resolve or create a Stripe Customer for this user to lock email editing on Checkout
    // Priority: search by metadata user_id, then by email, with robust fallbacks; finally create if missing
    let customer: Stripe.Customer | null = null;
    let emailMatchedCustomers: Stripe.Customer[] = [];
    try {
      // Try search by metadata user_id
      const byMeta = await stripe.customers.search({
        query: `metadata['user_id']:'${user_id.toString()}'`
      });
      if (byMeta && byMeta.data && byMeta.data.length > 0) {
        customer = byMeta.data[0];
      }
    } catch (e: any) {
      // Ignore search errors and continue
      console.warn('Customer search by metadata failed, will try by email:', e.message);
    }

    if (!customer && email) {
      try {
        const byEmail = await stripe.customers.search({
          query: `email:'${email}'`
        });
        if (byEmail && Array.isArray(byEmail.data) && byEmail.data.length > 0) {
          emailMatchedCustomers = byEmail.data as Stripe.Customer[];
          customer = emailMatchedCustomers[0];
        }
        // Fallback: list and filter by email if search returns no results or not supported
        if (!customer) {
          try {
            const list = await stripe.customers.list({ limit: 100 });
            emailMatchedCustomers = list.data.filter(c => (c.email || '').toLowerCase() === (email || '').toLowerCase()) as Stripe.Customer[];
            if (emailMatchedCustomers.length > 0) customer = emailMatchedCustomers[0];
          } catch (listErr: any) {
            console.warn('Customer list fallback failed:', listErr.message);
          }
        }
      } catch (e: any) {
        console.warn('Customer search by email failed:', e.message);
      }
    }

    // Before creating Checkout, prevent duplicate subscriptions for same email across all matching customers
    try {
      const candidates: Stripe.Customer[] = [];
      if (customer) candidates.push(customer);
      for (const c of emailMatchedCustomers) {
        if (!c || !c.id) continue;
        if (!candidates.find(x => x.id === c.id)) candidates.push(c);
      }

      let foundPaidSub = false;
      let foundSubCustomerId: string | null = null;
      for (const c of candidates) {
        try {
          const active = await stripe.subscriptions.list({ customer: c.id, status: 'active', limit: 100 });
          const trialing = await stripe.subscriptions.list({ customer: c.id, status: 'trialing', limit: 100 });
          const subs = [...active.data, ...trialing.data];
          // If any non-free subscription exists, block duplicate checkout
          if (subs.length > 0) {
            foundPaidSub = true;
            foundSubCustomerId = c.id;
            break;
          }
        } catch (subErr: any) {
          console.warn('Subscription list failed for customer', c.id, subErr.message);
        }
      }

      if (foundPaidSub && foundSubCustomerId) {
        const returnUrl = success_url || `${frontendOrigin}/project`;
        const portal = await stripe.billingPortal.sessions.create({
          customer: foundSubCustomerId,
          return_url: returnUrl,
        });
        return res.status(200).json({
          success: true,
          url: portal.url,
          message: 'Existing subscription detected; redirecting to Billing Portal',
        });
      }
    } catch (dupErr: any) {
      console.warn('Duplicate subscription guard failed, proceeding with Checkout:', dupErr.message);
    }
    // Also check trialing subscriptions
    try {
      const trialingSubs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'trialing',
        limit: 1,
      });
      if (trialingSubs && trialingSubs.data && trialingSubs.data.length > 0) {
        // Only redirect to portal for trialing subscriptions if they are paid tiers.
        const sub = trialingSubs.data[0];
        const FREE_PRICE_ID = process.env.STRIPE_FREE_PRICE_ID || null;
        const isFreeTier = Array.isArray(sub.items?.data) && sub.items.data.some((item) => {
          const price = item?.price;
          if (!price) return false;
          const isZeroAmount = typeof price.unit_amount === 'number' && price.unit_amount === 0;
          const matchesFreeId = FREE_PRICE_ID ? price.id === FREE_PRICE_ID : false;
          return isZeroAmount || matchesFreeId;
        });
        if (!isFreeTier) {
          const returnUrl = success_url || `${frontendOrigin}/project`;
          const portal = await stripe.billingPortal.sessions.create({
            customer: customer.id,
            return_url: returnUrl,
          });
          return res.status(200).json({
            success: true,
            url: portal.url,
            message: 'Trialing paid subscription detected; redirecting to Billing Portal',
          });
        }
        // Free-tier trial — continue with Checkout creation.
      }
    } catch (trialErr: any) {
      console.warn('Trialing subscription check failed, proceeding with Checkout:', trialErr.message);
    }
    // Compute effective redirect URLs, ensuring they target the frontend
    const effectiveSuccessUrl = normalizeUrlToFrontend(
      success_url || `${frontendOrigin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      '/subscription-success'
    );
    const effectiveCancelUrl = normalizeUrlToFrontend(
      cancel_url || `${frontendOrigin}/plans?status=cancelled`,
      '/plans?status=cancelled'
    );

    // Create checkout session
    // Build a stable idempotency key that varies with meaningful parameters to avoid Stripe
    // complaints when the same user/price is used with different URLs or customer contexts.
    const idemKeyBase = JSON.stringify({
      user_id: user_id.toString(),
      price_id: String(price_id),
      success_url: effectiveSuccessUrl,
      cancel_url: effectiveCancelUrl,
      customer_id: customer.id,
    });
    const idemKey = 'checkout_' + crypto.createHash('sha256').update(idemKeyBase).digest('hex').slice(0, 24);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Only include supported placeholder for Checkout Session ID.
      // The subscription ID must be resolved server-side using the session_id.
      success_url: effectiveSuccessUrl,
      cancel_url: effectiveCancelUrl,
      // Attach the resolved customer to lock email field on Checkout
      customer: customer.id,
      // Do not set customer_email to avoid editable email; rely on attached customer
      client_reference_id: user_id.toString(),
      metadata: {
        user_id: user_id.toString()
      },
      subscription_data: {
        metadata: {
          user_id: user_id.toString()
        }
      },
    }, { idempotencyKey: idemKey });

    console.log('✅ checkout session created', {
      session_id: session.id,
      url: session.url,
      success_url: session.success_url,
      cancel_url: session.cancel_url,
      customer: session.customer,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      session_id: session.id,
      effective_success_url: session.success_url,
      effective_cancel_url: session.cancel_url,
      message: 'Checkout session created'
    });

  } catch (error: any) {
    console.error('Create checkout session error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create checkout session'
    });
  }
}