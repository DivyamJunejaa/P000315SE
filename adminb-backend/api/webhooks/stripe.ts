import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import axios from 'axios'
import { generateToken } from '../../lib/auth'

// Stripe requires the raw request body to verify signatures
export const config = {
    api: {
        bodyParser: false,
    },
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = []
        req.on('data', (chunk: Buffer | string) => {
            if (typeof chunk === 'string') {
                chunks.push(Buffer.from(chunk))
            } else {
                chunks.push(chunk)
            }
        })
        req.on('end', () => resolve(Buffer.concat(chunks as any)))
        req.on('error', (err) => reject(err))
    })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripeSecretKey || !webhookSecret) {
        return res.status(500).json({ error: 'Stripe env vars missing' })
    }

    // Initialize Stripe with valid API version or default
    const stripe = new Stripe(stripeSecretKey)

    let event: Stripe.Event

    try {
        const rawBody = await readRawBody(req)
        const sig = req.headers['stripe-signature'] as string
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
    }

    // Helper to map Stripe subscription status to domain status
    const mapStatus = (s: Stripe.Subscription.Status): 'active' | 'cancelled' | 'expired' | 'pending' => {
        switch (s) {
            case 'active':
            case 'trialing':
            case 'past_due':
                return 'active'
            case 'canceled':
                return 'cancelled'
            case 'incomplete_expired':
                return 'expired'
            case 'unpaid':
            case 'incomplete':
            default:
                return 'pending'
        }
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription

                // Resolve customer & email
                const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer as Stripe.Customer).id
                const customer = await stripe.customers.retrieve(customerId)
                const email = (customer as Stripe.Customer)?.email || ''

                // Resolve user_id from metadata (set during checkout session creation)
                const userIdFromMetadata = (
                    (sub?.metadata && (sub.metadata as any).user_id) ||
                    ((customer as any)?.metadata && (customer as any).metadata.user_id) ||
                    undefined
                )

                // Resolve current plan/price ID
                const priceId = sub.items?.data?.[0]?.price?.id || ''

                // Normalize timestamps
                const startDateIso = sub.start_date ? new Date(sub.start_date * 1000).toISOString() : new Date().toISOString()
                const renewalDateIso = (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null
                const expiresAtIso = renewalDateIso
                const autoRenew = sub.cancel_at_period_end ? false : true

                const status = mapStatus(sub.status)

                // Persist via user service (if configured)
                const baseUrl = process.env.USER_SERVICE_BASE_URL
                if (baseUrl) {
                    try {
                        const token = generateToken({
                            id: String(userIdFromMetadata || customerId),
                            email: email || '',
                            role: 'admin'
                        })

                        const payload = {
                            subscriptionId: sub.id,
                            email: String(email || ''),
                            planId: String(priceId || ''),
                            status,
                            startDate: startDateIso,
                            renewalDate: renewalDateIso || undefined,
                            expiresAt: expiresAtIso || undefined,
                            autoRenew
                        }

                        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
                        const urlCreate = `${baseUrl}/api/subscription/Create`
                        const urlCreateLower = `${baseUrl}/api/subscription/create`

                        try {
                            await axios.post(urlCreate, payload, { headers })
                        } catch (err: any) {
                            if (err?.response?.status === 404) {
                                await axios.post(urlCreateLower, payload, { headers })
                            } else {
                                throw err
                            }
                        }
                    } catch (persistErr: any) {
                        console.error('Subscription persist failed:', persistErr?.message || persistErr)
                        // Do not fail webhook on persistence errors
                    }
                }

                break
            }
            case 'invoice.payment_succeeded': {
                // Optional: record successful payment in analytics or DB
                // Intentionally left minimal to avoid unrelated changes
                break
            }
            case 'invoice.payment_failed': {
                // Optional: handle failed payment (e.g., notify, mark pending)
                break
            }
            case 'customer.created':
            case 'customer.updated': {
                // Optional: sync customer data to your system
                break
            }
            default: {
                // Unhandled event types are fine; log for visibility
                break
            }
        }
        return res.json({ received: true })
    } catch (err: any) {
        return res.status(500).json({ error: 'Webhook handler error', message: err.message })
    }
}