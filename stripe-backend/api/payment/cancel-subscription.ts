// POST /api/payment/cancel-subscription — cancels one or more subscriptions.
// Accepts a specific `subscription_id` or cancels all active ones for a user.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { handleCORS } from '../utils/cors';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
// Main handler: verifies method, checks configuration, and performs cancellation.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCORS(req, res)) return;



  // Only allow POST; cancellations are state-changing operations.
if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { user_id, subscription_id } = req.body;

    if (!stripeSecret || !stripe) {
      return res.status(500).json({
        success: false,
        message: 'Payment server is not configured. Missing STRIPE_SECRET_KEY.',
      });
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // If subscription_id is provided, cancel that specific subscription
    if (subscription_id) {
      try {
        let actualSubscriptionId = subscription_id;
        
        // Check if the provided ID is a Checkout Session ID (starts with 'cs_')
        if (subscription_id.startsWith('cs_')) {
          console.log('Checkout Session ID detected, retrieving subscription...');
          
          // Retrieve the checkout session to get the subscription ID
          const checkoutSession = await stripe.checkout.sessions.retrieve(subscription_id);
          
          if (!checkoutSession.subscription) {
            return res.status(400).json({
              success: false,
              message: 'No subscription found for this checkout session'
            });
          }
          
          actualSubscriptionId = checkoutSession.subscription as string;
          console.log('Found subscription ID:', actualSubscriptionId);
        }
        
        // First, check the current status of the subscription
        const currentSubscription = await stripe.subscriptions.retrieve(actualSubscriptionId);
        
        // If already canceled, return appropriate message
        if (currentSubscription.status === 'canceled') {
          return res.status(200).json({
            success: true,
            message: 'Subscription was already canceled',
            data: {
              subscription_id: currentSubscription.id,
              status: currentSubscription.status,
              canceled_at: currentSubscription.canceled_at,
              checkout_session_id: subscription_id.startsWith('cs_') ? subscription_id : null,
              already_canceled: true
            }
          });
        }
        
        // Cancel behavior: immediate only � remove scheduling
        const subscription = await stripe.subscriptions.cancel(actualSubscriptionId);

        // Tag customer metadata to indicate canceled by user
        try {
          const custId = subscription.customer as string;
          if (custId) {
            const custResponse = await stripe.customers.retrieve(custId);
            const meta = ('deleted' in custResponse) ? {} : (custResponse.metadata ?? {});
            await stripe.customers.update(custId, {
              metadata: {
                ...meta,
                canceled_by_user: 'true',
                canceled_at: String(subscription.canceled_at || Math.floor(Date.now()/1000))
              }
            });
          }
        } catch (metaErr: any) {
          console.warn('Failed to tag customer as canceled:', metaErr.message);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Subscription canceled successfully',
          data: {
            subscription_id: subscription.id,
            status: subscription.status,
            canceled_at: subscription.canceled_at,
            cancel_at_period_end: false,
            checkout_session_id: subscription_id.startsWith('cs_') ? subscription_id : null,
            already_canceled: false
          }
        });
      } catch (stripeError: any) {
        console.error('Stripe cancellation error:', stripeError);
        return res.status(400).json({
          success: false,
          message: `Failed to cancel subscription: ${stripeError.message}`
        });
      }
    }

    // If no subscription_id provided, find and cancel all active subscriptions for the user
    try {
      // Search for subscriptions by customer metadata or email
      // Note: You'll need to store customer ID mapping in your database
      // For now, we'll search by metadata
      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        status: 'active'
      });

      // Filter subscriptions that belong to this user
      // This assumes you store user_id in subscription metadata
      const userSubscriptions = subscriptions.data.filter(sub => 
        sub.metadata && sub.metadata.user_id === user_id.toString()
      );

      if (userSubscriptions.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active subscriptions found for this user'
        });
      }

      // Cancel all user subscriptions immediately
      const canceledSubscriptions: Array<{
        subscription_id: string;
        status: string;
        canceled_at: number | null;
        cancel_at_period_end: boolean;
      }> = [];

      for (const subscription of userSubscriptions) {
        try {
          const canceled = await stripe.subscriptions.cancel(subscription.id);

          // Tag customer metadata
          try {
            const custId = canceled.customer as string;
            if (custId) {
              const cust = await stripe.customers.retrieve(custId);
              const meta = ('deleted' in cust) ? {} : (cust.metadata ?? {});
              await stripe.customers.update(custId, { 
                metadata: { 
                  ...meta, 
                  canceled_by_user: 'true', 
                  canceled_at: String(canceled.canceled_at || Math.floor(Date.now()/1000)) 
                } 
              });
            }
          } catch (metaErr: any) {
            console.warn('Failed to tag customer as canceled:', metaErr.message);
          }

          canceledSubscriptions.push({
            subscription_id: canceled.id,
            status: canceled.status,
            canceled_at: canceled.canceled_at ?? null,
            cancel_at_period_end: false
          });
        } catch (cancelError) {
          console.error(`Failed to cancel subscription ${subscription.id}:`, cancelError);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Successfully canceled ${canceledSubscriptions.length} subscription(s)`,
        data: {
          canceled_subscriptions: canceledSubscriptions
        }
      });

    } catch (stripeError: any) {
      console.error('Stripe search error:', stripeError);
      return res.status(500).json({
        success: false,
        message: `Failed to search for subscriptions: ${stripeError.message}`
      });
    }

  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}