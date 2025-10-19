import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCORS } from '../utils/cors';

  export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCORS(req, res)) return;


 
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || !String(stripeSecretKey).trim()) {
    return res.status(500).json({ 
      success: false, 
      message: 'Payment server is not configured. Missing STRIPE_SECRET_KEY.' 
    });
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const { session_id, subscription_id, user_id, email } = req.body || {};
    
    if (!subscription_id && !session_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Provide either subscription_id or session_id' 
      });
    }

    // Resolve subscription id from session if needed
    let subId = subscription_id as string;
    let checkoutSession: Stripe.Checkout.Session | null = null;
    
    if (!subId && session_id) {
      checkoutSession = await stripe.checkout.sessions.retrieve(session_id as string);
      if (!checkoutSession.subscription) {
        return res.status(404).json({ 
          success: false, 
          message: 'No subscription found for provided session_id' 
        });
      }
      subId = checkoutSession.subscription as string;
    }

    // Retrieve subscription details
    const subscription = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription;

    // Retrieve customer details; prefer email from Stripe customer to lock identity
    const customerId = (checkoutSession && checkoutSession.customer) || subscription.customer;
    const customer = customerId ? await stripe.customers.retrieve(customerId as string) : null;
    const customerEmail = (customer && (customer as any).email) || email || '';

    // Attach user metadata for future duplicate protection
    const desiredUserId = user_id ? String(user_id) : undefined;
    try {
      const currentMetaUserId = subscription.metadata && (subscription.metadata as any).user_id;
      if (desiredUserId && currentMetaUserId !== desiredUserId) {
        await stripe.subscriptions.update(subscription.id, {
          metadata: { ...(subscription.metadata || {} as any), user_id: desiredUserId }
        });
      }
    } catch (metaErr: any) {
      console.warn('Failed to update subscription metadata:', metaErr.message);
    }

    // Normalize item/price info
    const item = Array.isArray(subscription.items?.data) ? subscription.items.data[0] : null;
    const price = item && item.price ? item.price : null;
    const planId = price ? price.id : '';
    const status = subscription.status || 'active';
    const startDate = subscription.start_date 
      ? new Date(subscription.start_date * 1000).toISOString() 
      : new Date().toISOString();
    const currentPeriodEnd = (subscription as any).current_period_end 
      ? new Date((subscription as any).current_period_end * 1000).toISOString() 
      : startDate;

    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        email: customerEmail,
        planId,
        status,
        startDate,
        renewalDate: currentPeriodEnd,
        expiresAt: currentPeriodEnd,
        autoRenew: subscription.cancel_at_period_end ? false : true,
        customerId,
        checkoutSessionId: session_id || (checkoutSession ? checkoutSession.id : null),
      },
      message: 'Subscription synced from Stripe'
    });
  } catch (error: any) {
    console.error('Update subscription error:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to sync subscription from Stripe' 
    });
  }
}