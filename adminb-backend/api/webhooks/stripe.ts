import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

// Stripe requires the raw request body to verify signatures
export const config = {
    api: {
        bodyParser: false,
    },
}

function readRawBody(req: VercelRequest): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = []
        req.on('data', (chunk) => chunks.push(chunk as Uint8Array))
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

    // Initialize Stripe; rely on library default API version to avoid type mismatches
    const stripe = new Stripe(stripeSecretKey)

    let event: Stripe.Event

    try {
        const rawBody = await readRawBody(req)
        const sig = req.headers['stripe-signature'] as string
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
    } catch (err: any) {
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` })
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                // TODO: persist subscription changes to database (Supabase)
                break
            }
            case 'invoice.payment_succeeded': {
                // TODO: record successful payment
                break
            }
            case 'invoice.payment_failed': {
                // TODO: handle failed payment
                break
            }
            case 'customer.created':
            case 'customer.updated': {
                // TODO: sync customer data
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