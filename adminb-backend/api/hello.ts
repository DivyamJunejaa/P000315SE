// Simple hello endpoint: returns greeting JSON
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withCors } from '../lib/cors';

export default withCors(async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ success: false, message: 'Method Not Allowed' });
        return; // Just return, don't return res
    }

    const name = (req.query.name as string) || 'World';
    res.status(200).json({ message: `Hello ${name}!` }); // Remove return
});