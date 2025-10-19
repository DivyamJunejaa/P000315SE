import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCORS } from '../utils/cors';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { user_id, subscription_id, email } = req.body;

    if (!stripeSecret || !stripe) {
      return res.status(500).json({ success: false, message: 'Payment server is not configured. Missing STRIPE_SECRET_KEY.' });
    }
    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const updateCustomerMeta = async (customerId: string, canceledAt: number | null) => {
      try {
        const cust = await stripe.customers.retrieve(customerId);
        const prev = (cust as any)?.metadata ?? {};
        await stripe.customers.update(customerId, {
          metadata: {
            ...prev,
            canceled_by_user: 'true',
            canceled_at: String(canceledAt ?? Math.floor(Date.now() / 1000))
          }
        });
      } catch (e: any) {
        console.warn('Failed to tag customer as canceled:', e.message);
      }
    };

    // If a specific identifier was provided, try to cancel by it first, but gracefully fallback
    if (subscription_id) {
      let subId = String(subscription_id);

      // Map Checkout Session -> Subscription, with fallback for invalid preview IDs
      if (subId.startsWith('cs_')) {
        try {
          const sess = await stripe.checkout.sessions.retrieve(subId);
          if (sess.subscription) {
            subId = sess.subscription as string;
          } else {
            console.warn('Checkout session has no subscription; falling back to lookup', { session_id: subId });
            subId = '';
          }
        } catch (e: any) {
          console.warn('Checkout session lookup failed; falling back to lookup', e.message);
          subId = '';
        }
      }

      if (subId && subId.startsWith('sub_')) {
        try {
          const current = await stripe.subscriptions.retrieve(subId);
          if (current.status === 'canceled') {
            return res.status(200).json({
              success: true,
              message: 'Subscription was already canceled',
              data: {
                subscription_id: current.id,
                status: current.status,
                canceled_at: current.canceled_at,
                checkout_session_id: subscription_id.startsWith('cs_') ? String(subscription_id) : null,
                already_canceled: true
              }
            });
          }

          const canceled = await stripe.subscriptions.cancel(subId);
          await updateCustomerMeta(canceled.customer as string, canceled.canceled_at);
          return res.status(200).json({
            success: true,
            message: 'Subscription canceled successfully',
            data: {
              subscription_id: canceled.id,
              status: canceled.status,
              canceled_at: canceled.canceled_at,
              cancel_at_period_end: false,
              checkout_session_id: subscription_id.startsWith('cs_') ? String(subscription_id) : null,
              already_canceled: false
            }
          });
        } catch (e: any) {
          console.warn('Cancel by subscription_id failed; will fallback to metadata/email search', e.message);
          // Continue to generic lookup below
        }
      }
    }

    // Cancel all user's active or trialing subscriptions via lookup
    const statusesToCheck: Stripe.SubscriptionListParams.Status[] = ['active', 'trialing', 'past_due', 'unpaid'];
    let subs: Stripe.Subscription[] = [];
    try {
      for (const st of statusesToCheck) {
        const bucket = await stripe.subscriptions.list({ limit: 100, status: st });
        const byMeta = bucket.data.filter(s => s.metadata && s.metadata.user_id === String(user_id));
        subs = subs.concat(byMeta);
      }
    } catch (e: any) {
      console.warn('Global subscription metadata scan failed:', e.message);
    }

    if (subs.length === 0) {
      try {
        const search = await stripe.customers.search({ query: `metadata['user_id']:'${String(user_id)}'` });
        const custId = search.data?.[0]?.id;
        if (custId) {
          for (const st of statusesToCheck) {
            const bucket = await stripe.subscriptions.list({ customer: custId, status: st, limit: 100 });
            subs = subs.concat(bucket.data);
          }
        }
      } catch (e: any) {
        console.warn('Customer search/list failed:', e.message);
      }
    }

    // Fallback: search by email for Payment Links or customers without metadata
    if (subs.length === 0 && email) {
      try {
        const byEmail = await stripe.customers.search({ query: `email:'${String(email)}'` });
        const custId = byEmail.data?.[0]?.id;
        if (custId) {
          for (const st of statusesToCheck) {
            const bucket = await stripe.subscriptions.list({ customer: custId, status: st, limit: 100 });
            subs = subs.concat(bucket.data);
          }
        }
      } catch (e: any) {
        console.warn('Customer search by email failed:', e.message);
      }
    }

    if (subs.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscriptions found for this user' });
    }

    const canceledSubs: Array<{ subscription_id: string; status: string; canceled_at: number | null; cancel_at_period_end: boolean; }> = [];
    for (const sub of subs) {
      try {
        const canceled = await stripe.subscriptions.cancel(sub.id);
        await updateCustomerMeta(canceled.customer as string, canceled.canceled_at);
        canceledSubs.push({ subscription_id: canceled.id, status: canceled.status, canceled_at: canceled.canceled_at ?? null, cancel_at_period_end: false });
      } catch (e: any) {
        console.error(`Failed to cancel subscription ${sub.id}:`, e);
      }
    }

    return res.status(200).json({ success: true, message: `Successfully canceled ${canceledSubs.length} subscription(s)`, data: { canceled_subscriptions: canceledSubs } });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}