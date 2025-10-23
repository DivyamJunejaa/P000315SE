// Endpoint to collect and return dashboard metrics for the admin UI.
// Uses Stripe for real data when keys are present; otherwise returns demo data.
import 'dotenv/config'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyAdminAuto } from '../lib/auth'
import { withCors } from '../lib/cors'
import Stripe from 'stripe'

const VERBOSE = ['1', 'true', 'yes'].includes(String(process.env.VERBOSE || '').toLowerCase())
const log = (...args: any[]) => { if (VERBOSE) console.log('[dashboard]', ...args) }

// Main handler: validates method and auth, then builds metrics payload.
async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        res.status(405).json({ success: false, message: 'Method Not Allowed', statusCode: 405 })
        return
    }

    const auth = await verifyAdminAuto(req)
    if (!auth.success || !auth.user) {
        res.status(401).json({ success: false, message: auth.error || 'Unauthorized', statusCode: 401 })
        return
    }

    // Quick stub for fast responses (matches Express server)
    if (req.query.quick === '1') {
        return res.status(200).json({
            success: true,
            statusCode: 200,
            message: 'quick stub',
            data: {
                overview: {
                    revenue: {
                        amountCents: 0,
                        count: 0,
                        period: 'month',
                        growth: { currentMonth: 0, lastMonth: 0, growthPercent: 0 }
                    }
                }
            }
        })
    }

    // --- Stripe Fast-Path Aggregation ---
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY
    log('env', {
        hasStripeKey: Boolean(stripeSecretKey),
        proPriceId: process.env.STRIPE_PRO_PRICE_ID,
        premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    })

    if (!stripeSecretKey) {
        // Demo fallback payload to enable local UI testing without Stripe keys
        const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
        // Final response: combine overview stats, charts, and a recent list.
        const payload = {
            success: true,
            message: 'Demo dashboard (no STRIPE_SECRET_KEY configured)',
            statusCode: 200,
            data: {
                overview: {
                    users: { total: 42, newThisMonth: 5 },
                    subscriptions: {
                        total: 10,
                        active: 7,
                        trialing: 2,
                        pastDue: 1,
                        canceled: 0,
                        incomplete: 0,
                    },
                    revenue: {
                        amountCents: 8240000,
                        count: 12,
                        period: 'month',
                        growth: { currentMonth: 8240000, lastMonth: 7000000, growthPercent: 12.4 },
                    },
                    premiumCustomers: { total: 3, new: 1, churn: 0 },
                    proCustomers: { total: 5, new: 2, churn: 1 },
                    traffic: { today: 1280, monthly: 32140, quarterly: 91520 },
                },
                charts: {
                    revenueTrend: months.map((m, i) => ({ month: m, revenue: 7000 + i * 2000 })),
                    trafficTrend: months.map((m, i) => ({ month: m, traffic: 5000 + i * 5000 })),
                },
                recentSubscriptions: [
                    { id: 'SUB-0012', userName: 'Olivia Rhye', tier: 'Premium', period: 'Monthly', amountCents: 2900, status: 'active' },
                    { id: 'SUB-0013', userName: 'James Doe', tier: 'Pro', period: 'Quarterly', amountCents: 5900, status: 'past_due' },
                ],
            },
        }
        res.status(200).json(payload)
        return
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2025-09-30.clover' })
    log('stripe init OK')

    // Price/Product IDs provided by environment for Pro and Premium tiers
    const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || 'price_1SJOoqQTtrbKnENdq6xX75de'
    const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || 'price_1SJP2sQTtrbKnENdbIpAzwMv'
    const PRO_PRODUCT_ID = process.env.STRIPE_PRO_PRODUCT_ID || undefined
    const PREMIUM_PRODUCT_ID = process.env.STRIPE_PREMIUM_PRODUCT_ID || undefined
    log('tier ids', { PRO_PRICE_ID, PREMIUM_PRICE_ID, PRO_PRODUCT_ID, PREMIUM_PRODUCT_ID })

    // Helper: get month start/end timestamps
    // Helper: compute UNIX second range for the current month.
    function monthBounds(date: Date) {
        const start = new Date(date.getFullYear(), date.getMonth(), 1)
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)
        return { start: Math.floor(start.getTime() / 1000), end: Math.floor(end.getTime() / 1000) }
    }

    // Helper: get day start/end timestamps
    // Helper: compute UNIX second range for the current day.
    function dayBounds(date: Date) {
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
        const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
        return { start: Math.floor(start.getTime() / 1000), end: Math.floor(end.getTime() / 1000) }
    }

    function lastNMonthsLabels(n: number): { label: string; start: number; end: number }[] {
        const out: { label: string; start: number; end: number }[] = []
        const now = new Date()
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const { start, end } = monthBounds(d)
            const label = d.toLocaleString('en-US', { month: 'short' })
            out.push({ label, start, end })
        }
        return out
    }

    try {
        // List subscriptions and compute status tallies and tier counts
        // Helper: page through Stripe subscriptions and tally statuses and tiers.
        async function countByPrice() {
            let starting_after: string | undefined = undefined
            let pro = 0, premium = 0, total = 0, active = 0, trialing = 0, past_due = 0, canceled = 0, incomplete = 0

            do {
                const page: Stripe.ApiList<Stripe.Subscription> = await stripe.subscriptions.list({
                    limit: 100,
                    status: 'all',
                    starting_after
                })
                for (const s of page.data) {
                    total += 1
                    switch (s.status) {
                        case 'active': active += 1; break
                        case 'trialing': trialing += 1; break
                        case 'past_due': past_due += 1; break
                        case 'canceled': canceled += 1; break
                        case 'incomplete': incomplete += 1; break
                        default: break
                    }

                    // tier tallies: count ONLY active subs
                    if (s.status === 'active') {
                        const priceObj = s.items?.data?.[0]?.price
                        const itemPriceId = priceObj?.id || null
                        const itemProductId = (() => {
                            const prod = priceObj?.product
                            if (!prod) return null
                            return typeof prod === 'string' ? prod : (prod as any).id
                        })()
                        const isPro = (itemPriceId === PRO_PRICE_ID) || (!!PRO_PRODUCT_ID && itemProductId === PRO_PRODUCT_ID)
                        const isPremium = (itemPriceId === PREMIUM_PRICE_ID) || (!!PREMIUM_PRODUCT_ID && itemProductId === PREMIUM_PRODUCT_ID)
                        if (isPro) pro += 1
                        if (isPremium) premium += 1
                    }
                }
                starting_after = page.has_more ? page.data[page.data.length - 1].id : undefined
            } while (starting_after)

            return { pro, premium, total, active, trialing, past_due, canceled, incomplete }
        }

        const subCounts = await countByPrice()

        // Helper: sum invoice totals for a given time range
        async function sumInvoices(from: number, to: number) {
            let starting_after: string | undefined = undefined
            let totalCents = 0
            let count = 0
            do {
                const page: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({
                    limit: 100,
                    status: 'paid',
                    starting_after,
                    created: { gte: from, lte: to }
                })
                for (const inv of page.data) {
                    totalCents += (inv.total ?? 0)
                    count += 1
                }
                starting_after = page.has_more ? page.data[page.data.length - 1].id : undefined
            } while (starting_after)
            return { totalCents, count }
        }

        // Current month revenue
        const now = new Date()
        const { start, end } = monthBounds(now)
        const cur = await sumInvoices(start, end)

        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const { start: lmStart, end: lmEnd } = monthBounds(lastMonthDate)
        const prev = await sumInvoices(lmStart, lmEnd)

        const growthPercent = prev.totalCents > 0
            ? ((cur.totalCents - prev.totalCents) / prev.totalCents) * 100
            : 0

        // Revenue trend for last 6 months
        const months = lastNMonthsLabels(6)
        const revenueTrend: { month: string; revenue: number }[] = []
        const trafficTrend: { month: string; traffic: number }[] = []
        for (const m of months) {
            const s = await sumInvoices(m.start, m.end)
            revenueTrend.push({ month: m.label, revenue: Math.round(s.totalCents / 100) })
            trafficTrend.push({ month: m.label, traffic: s.count })
        }

        // Recent subscriptions (last 10)
        const recent = await stripe.subscriptions.list({ limit: 10, expand: ['data.customer'] })
        const recentSubscriptions = recent.data.map(s => {
            const cust = typeof s.customer === 'string' ? undefined : (s.customer as Stripe.Customer)
            return ({
                id: s.id,
                userName: cust?.name || undefined,
                userEmail: cust?.email || undefined,
                tier: (() => {
                    const priceObj = s.items?.data?.[0]?.price
                    const pid = priceObj?.id
                    const prodId = (() => {
                        const p = priceObj?.product
                        if (!p) return undefined
                        return typeof p === 'string' ? p : (p as any).id
                    })()
                    if (pid === PRO_PRICE_ID || (!!PRO_PRODUCT_ID && prodId === PRO_PRODUCT_ID)) return 'Pro'
                    if (pid === PREMIUM_PRICE_ID || (!!PREMIUM_PRODUCT_ID && prodId === PREMIUM_PRODUCT_ID)) return 'Premium'
                    return 'Other'
                })(),
                period: s.items?.data?.[0]?.price?.recurring?.interval || '—',
                amountCents: s.items?.data?.[0]?.price?.unit_amount ?? 0,
                status: s.status,
            })
        })

        // Traffic metrics
        const { start: tStart, end: tEnd } = dayBounds(now)
        const t = await sumInvoices(tStart, tEnd)
        const last3 = lastNMonthsLabels(3)
        let quarterlyCount = 0
        for (const m of last3) {
            const s = await sumInvoices(m.start, m.end)
            quarterlyCount += s.count
        }

        log('aggregates', {
            monthRevenueCents: cur.totalCents,
            monthInvoiceCount: cur.count,
            lastMonthRevenueCents: prev.totalCents,
            recentSubscriptionsCount: recentSubscriptions.length,
            trafficTodayCount: t.count,
            quarterlyCount,
        })

        // Final response: combine overview stats, charts, and a recent list.
        const payload = {
            success: true,
            message: 'Dashboard data retrieved successfully',
            statusCode: 200,
            data: {
                overview: {
                    users: { total: 0, newThisMonth: 0 },
                    subscriptions: {
                        total: subCounts.total,
                        active: subCounts.active,
                        trialing: subCounts.trialing,
                        pastDue: subCounts.past_due,
                        canceled: subCounts.canceled,
                        incomplete: subCounts.incomplete,
                    },
                    revenue: {
                        amountCents: cur.totalCents,
                        count: cur.count,
                        period: 'month',
                        growth: {
                            currentMonth: cur.totalCents,
                            lastMonth: prev.totalCents,
                            growthPercent: Number(growthPercent.toFixed(1)),
                        },
                    },
                    premiumCustomers: { total: subCounts.premium, new: 0, churn: 0 },
                    proCustomers: { total: subCounts.pro, new: 0, churn: 0 },
                    traffic: { today: t.count, monthly: cur.count, quarterly: quarterlyCount },
                },
                charts: {
                    revenueTrend,
                    trafficTrend,
                },
                recentSubscriptions,
            },
        }

        res.status(200).json(payload)
        return
    } catch (err: any) {
        console.error('Stripe aggregation error:', err)
        res.status(500).json({ success: false, message: err.message || 'Stripe aggregation failed', statusCode: 500 })
        return
    }
}

export default withCors(async (req: VercelRequest, res: VercelResponse) => {
    await handler(req, res);
});