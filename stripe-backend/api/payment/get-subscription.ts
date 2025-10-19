import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCORS } from '../utils/cors';

  export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCORS(req, res)) return;
  



  // Ensure Stripe is configured before proceeding
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey || !String(stripeSecretKey).trim()) {
    return res.status(500).json({
      success: false,
      message: 'Payment server is not configured. Missing STRIPE_SECRET_KEY.'
    });
  }

  // Initialize Stripe client only after validating the secret key
  const stripe = new Stripe(stripeSecretKey);

  try {
    const { subscription_id, session_id } = req.method === 'GET' ? req.query : req.body;
    
    if (!subscription_id && !session_id) {
      return res.status(400).json({
        success: false,
        message: 'Provide either subscription_id or session_id'
      });
    }

    let subId = subscription_id as string;
    
    if (!subId && session_id) {
      // If a checkout session id is provided, resolve to subscription id
      const session = await stripe.checkout.sessions.retrieve(session_id as string);
      if (!session.subscription) {
        return res.status(404).json({
          success: false,
          message: 'No subscription found for the provided session_id'
        });
      }
      subId = session.subscription as string;
    }

    const subscription = (await stripe.subscriptions.retrieve(subId)) as Stripe.Subscription;

    // Extract minimal fields useful to the frontend
    const item = subscription.items?.data?.[0];
    const planId = item?.price?.id || item?.plan?.id || null;
    const interval = item?.price?.recurring?.interval || item?.plan?.interval || null;
    const amount = item?.price?.unit_amount || item?.plan?.amount || null;

    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        status: subscription.status,
        current_period_end: (subscription as any).current_period_end,
        current_period_start: (subscription as any).current_period_start,
        planId,
        interval,
        amount,
      }
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    const code = error.statusCode || 500;
    return res.status(code).json({
      success: false,
      message: error.message || 'Failed to retrieve subscription'
    });
  }
}