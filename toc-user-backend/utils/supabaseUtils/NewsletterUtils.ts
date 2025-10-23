/**
 * Newsletter Subscription Utilities
 * 
 * Manages newsletter subscription records and mailing list operations.
 * Tracks user opt-in for marketing communications and newsletters.
 * 
 * Table: UserNewsLetterSubs
 * - email: Subscriber's email (unique, primary key)
 * - accepted_at: Timestamp when subscription was created
 * 
 * Use Cases:
 * - Subscribe/unsubscribe users from newsletter
 * - Check subscription status
 * - Export mailing list for email campaigns
 * - Admin reporting on subscriber growth
 * - GDPR compliance tracking
 */

import { UserNewsLetterSubs } from '../../dto/UserNewsLetterSubs';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Supabase Client
// ============================================================================

/**
 * Supabase client with service role key
 * Provides full database access for backend operations
 */
const supabase = createClient(
    process.env.TOC_SUPABASE_URL!,
    process.env.TOC_SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// Constants
// ============================================================================

/**
 * PostgreSQL error code for unique constraint violation
 * Used when email already exists in subscriptions
 */
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * PostgreSQL error code for "no rows found"
 * Used to distinguish between "not found" vs actual errors
 */
const NOT_FOUND_CODE = 'PGRST116';

// ============================================================================
// Core Subscription Functions
// ============================================================================

/**
 * Subscribes a user to the newsletter
 * 
 * Creates subscription record with current timestamp.
 * Email is normalized to lowercase for consistency.
 * Throws specific error if already subscribed (idempotency check).
 * 
 * @param email - User's email address
 * @returns Created subscription record
 * @throws Error with code 'NEWSLETTER_ALREADY_SUBSCRIBED' if duplicate
 * @throws Error if database operation fails
 */
export async function createNewsletterSubscription(email: string): Promise<UserNewsLetterSubs> {
    try {
        const subscriptionData = {
            email: email.toLowerCase(),
            accepted_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .insert(subscriptionData)
            .select('*')
            .single();

        // Handle duplicate subscription
        if (error) {
            if (error.code === UNIQUE_VIOLATION_CODE) {
                throw new Error('NEWSLETTER_ALREADY_SUBSCRIBED');
            }
            throw error;
        }

        return {
            email: data.email,
            accepted_at: new Date(data.accepted_at)
        };
    } catch (error: unknown) {
        console.error('Error creating newsletter subscription:', error);
        throw error;
    }
}

/**
 * Finds newsletter subscription by email
 * 
 * Looks up subscription record for an email address.
 * Returns null if email is not subscribed.
 * 
 * @param email - User's email address
 * @returns Subscription record if found, null if not subscribed
 * @throws Error if database operation fails
 */
export async function findNewsletterSubscriptionByEmail(email: string): Promise<UserNewsLetterSubs | null> {
    try {
        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        // Handle "not found" gracefully
        if (error) {
            if (error.code === NOT_FOUND_CODE) {
                return null; // Email not subscribed
            }
            throw error;
        }

        return {
            email: data.email,
            accepted_at: new Date(data.accepted_at)
        };
    } catch (error: unknown) {
        console.error('Error finding newsletter subscription:', error);
        throw new Error('Failed to find newsletter subscription');
    }
}

/**
 * Checks if email is subscribed to newsletter
 * 
 * Simple boolean check for subscription status.
 * Returns false on errors to fail-safe (doesn't block user flow).
 * 
 * @param email - User's email address
 * @returns true if subscribed, false if not or on error
 */
export async function isSubscribedToNewsletter(email: string): Promise<boolean> {
    try {
        const subscription = await findNewsletterSubscriptionByEmail(email);
        return subscription !== null;
    } catch (error: unknown) {
        console.error('Error checking newsletter subscription:', error);
        return false; // Fail-safe: don't block user on error
    }
}

/**
 * Updates subscription timestamp (resubscribe)
 * 
 * Used when user resubscribes or updates preferences.
 * Updates accepted_at to current time.
 * 
 * @param email - User's email address
 * @returns Updated subscription record
 * @throws Error if database operation fails or email not found
 */
export async function updateNewsletterSubscription(email: string): Promise<UserNewsLetterSubs> {
    try {
        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .update({ accepted_at: new Date().toISOString() })
            .eq('email', email.toLowerCase())
            .select('*')
            .single();

        if (error) throw error;

        return {
            email: data.email,
            accepted_at: new Date(data.accepted_at)
        };
    } catch (error: unknown) {
        console.error('Error updating newsletter subscription:', error);
        throw new Error('Failed to update newsletter subscription');
    }
}

/**
 * Unsubscribes user from newsletter
 * 
 * Permanently removes subscription record from database.
 * Required for GDPR compliance and user preferences.
 * Silently succeeds if email not found (idempotent).
 * 
 * @param email - User's email address
 * @throws Error if database operation fails
 */
export async function unsubscribeFromNewsletter(email: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('UserNewsLetterSubs')
            .delete()
            .eq('email', email.toLowerCase());

        if (error) throw error;
    } catch (error: unknown) {
        console.error('Error unsubscribing from newsletter:', error);
        throw new Error('Failed to unsubscribe from newsletter');
    }
}

// ============================================================================
// Admin / Reporting Functions
// ============================================================================

/**
 * Gets all newsletter subscriptions (admin function)
 * 
 * Retrieves complete subscriber list sorted by date (newest first).
 * Use for admin dashboards or analytics.
 * 
 * Warning: Can be slow with large lists. Consider pagination for production.
 * 
 * @returns Array of all subscriptions
 * @throws Error if database operation fails
 */
export async function getAllNewsletterSubscriptions(): Promise<UserNewsLetterSubs[]> {
    try {
        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .select('*')
            .order('accepted_at', { ascending: false });

        if (error) throw error;

        // Convert ISO strings to Date objects
        return data.map(item => ({
            email: item.email,
            accepted_at: new Date(item.accepted_at)
        }));
    } catch (error: unknown) {
        console.error('Error getting all newsletter subscriptions:', error);
        throw new Error('Failed to get newsletter subscriptions');
    }
}

/**
 * Gets newsletter subscriptions after a specific date
 * 
 * Useful for tracking new subscribers or growth metrics.
 * Example: Get all subscriptions from last month.
 * 
 * @param date - Cutoff date (returns subscriptions after this date)
 * @returns Array of subscriptions after the date
 * @throws Error if database operation fails
 */
export async function getNewsletterSubscriptionsAfter(date: Date): Promise<UserNewsLetterSubs[]> {
    try {
        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .select('*')
            .gt('accepted_at', date.toISOString()) // Greater than date
            .order('accepted_at', { ascending: false });

        if (error) throw error;

        // Convert ISO strings to Date objects
        return data.map(item => ({
            email: item.email,
            accepted_at: new Date(item.accepted_at)
        }));
    } catch (error: unknown) {
        console.error('Error getting newsletter subscriptions after date:', error);
        throw new Error('Failed to get newsletter subscriptions');
    }
}

/**
 * Gets total count of newsletter subscribers
 * 
 * Returns total number of subscribed emails.
 * Efficient count query without fetching all data.
 * Useful for metrics and dashboards.
 * 
 * @returns Total number of subscribers
 * @throws Error if database operation fails
 */
export async function getNewsletterSubscriptionCount(): Promise<number> {
    try {
        // Use count query (more efficient than fetching all rows)
        const { count, error } = await supabase
            .from('UserNewsLetterSubs')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        return count || 0;
    } catch (error: unknown) {
        console.error('Error getting newsletter subscription count:', error);
        throw new Error('Failed to get newsletter subscription count');
    }
}

/**
 * Bulk subscribes multiple emails to newsletter (admin function)
 * 
 * Subscribes multiple emails in a single database operation.
 * Useful for importing existing mailing lists.
 * 
 * Note: Will fail if any email already exists (use individual subscribe with
 * error handling for better control).
 * 
 * @param emails - Array of email addresses to subscribe
 * @returns Array of created subscription records
 * @throws Error if database operation fails or any email already exists
 */
export async function bulkSubscribeToNewsletter(emails: string[]): Promise<UserNewsLetterSubs[]> {
    try {
        // Normalize all emails to lowercase
        const subscriptionData = emails.map(email => ({
            email: email.toLowerCase(),
            accepted_at: new Date().toISOString()
        }));

        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .insert(subscriptionData)
            .select('*');

        if (error) throw error;

        // Convert ISO strings to Date objects
        return data.map(item => ({
            email: item.email,
            accepted_at: new Date(item.accepted_at)
        }));
    } catch (error: unknown) {
        console.error('Error bulk subscribing to newsletter:', error);
        throw new Error('Failed to bulk subscribe to newsletter');
    }
}

/**
 * Exports list of all subscriber emails (admin function)
 * 
 * Returns just email addresses sorted alphabetically.
 * Used for exporting to email marketing platforms (Mailchimp, SendGrid, etc.).
 * 
 * @returns Array of subscriber email addresses
 * @throws Error if database operation fails
 */
export async function exportNewsletterSubscribers(): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('UserNewsLetterSubs')
            .select('email')
            .order('email', { ascending: true }); // Alphabetical order

        if (error) throw error;

        return data.map(item => item.email);
    } catch (error: unknown) {
        console.error('Error exporting newsletter subscribers:', error);
        throw new Error('Failed to export newsletter subscribers');
    }
}

// ============================================================================
// Usage Examples
// ============================================================================

/*
 * EXAMPLE 1: Subscribe during registration
 * 
 * if (userData.acceptNewsletter) {
 *   try {
 *     await createNewsletterSubscription(userData.email);
 *   } catch (error) {
 *     if (error.message === 'NEWSLETTER_ALREADY_SUBSCRIBED') {
 *       // Already subscribed, continue
 *     } else {
 *       throw error;
 *     }
 *   }
 * }
 * 
 * EXAMPLE 2: Unsubscribe link in email
 * 
 * // In API route: /api/newsletter/unsubscribe?email=user@example.com
 * const email = req.query.email;
 * await unsubscribeFromNewsletter(email);
 * res.send('You have been unsubscribed from our newsletter.');
 * 
 * EXAMPLE 3: Export for email campaign
 * 
 * const subscribers = await exportNewsletterSubscribers();
 * // Upload to Mailchimp, SendGrid, etc.
 * await sendCampaignToEmails(subscribers);
 * 
 * EXAMPLE 4: Growth analytics
 * 
 * const lastMonth = new Date();
 * lastMonth.setMonth(lastMonth.getMonth() - 1);
 * 
 * const newSubscribers = await getNewsletterSubscriptionsAfter(lastMonth);
 * console.log(`${newSubscribers.length} new subscribers last month`);
 * 
 * EXAMPLE 5: Admin dashboard metrics
 * 
 * const totalSubscribers = await getNewsletterSubscriptionCount();
 * const recentSubs = await getNewsletterSubscriptionsAfter(
 *   new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
 * );
 * 
 * return {
 *   total: totalSubscribers,
 *   lastWeek: recentSubs.length,
 *   growthRate: (recentSubs.length / totalSubscribers) * 100
 * };
 * 
 */