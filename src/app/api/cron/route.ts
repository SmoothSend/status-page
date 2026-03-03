import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Re-use the same SERVICES array logic from the status route
const SERVICES = [
    {
        id: 'gateway',
        url: 'https://proxy.smoothsend.xyz/health',
    },
    {
        id: 'evm-relayer',
        url: 'https://smoothsendrelayerevm.onrender.com/api/v1/relayer/health',
    },
    {
        id: 'stellar-relayer',
        url: 'https://stellar-relayer.onrender.com/health',
    },
    {
        id: 'aptos-relayer',
        url: 'http://api.smoothsend.xyz:3000/ping',
    }
];

export async function GET(request: Request) {
    // Basic security to ensure only Vercel Cron can trigger it easily
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timestamp = new Date().toISOString();
    // Get the current day string (YYYY-MM-DD) for aggregation
    const dayKey = timestamp.split('T')[0];

    try {
        const results = await Promise.allSettled(
            SERVICES.map(async (service) => {
                const startTime = Date.now();
                try {
                    const response = await fetch(service.url, {
                        timeout: 10000,
                        cache: 'no-store',
                        headers: { 'User-Agent': 'SmoothSend-Gateway-KeepAlive' }
                    } as any);
                    const latency = Date.now() - startTime;

                    let status = 'operational';
                    if (!response.ok) {
                        status = response.status >= 500 ? 'major_outage' : 'degraded_performance';
                    }

                    return { id: service.id, status, latency };
                } catch (err) {
                    return { id: service.id, status: 'major_outage', latency: Date.now() - startTime };
                }
            })
        );

        // Save results to KV
        for (const result of results) {
            if (result.status === 'fulfilled') {
                const { id, status, latency } = result.value;

                // Store the raw ping event in a list (useful for recent detailed history)
                // Keep only the last 200 events per service to avoid bloat
                const listKey = `pings:${id}`;
                await kv.lpush(listKey, JSON.stringify({ timestamp, status, latency }));
                await kv.ltrim(listKey, 0, 199);

                // Aggregate daily status:
                // We store the 'worst' status for the day. Operational < Degraded < Outage
                const dailyKey = `daily:${id}:${dayKey}`;
                const currentDailyStatus = await kv.get<string>(dailyKey);

                let newDailyStatus = status;
                if (currentDailyStatus === 'major_outage' || status === 'major_outage') {
                    newDailyStatus = 'major_outage';
                } else if (currentDailyStatus === 'degraded_performance' || status === 'degraded_performance') {
                    newDailyStatus = 'degraded_performance';
                }

                await kv.set(dailyKey, newDailyStatus);
                // Expire daily keys after 95 days so the DB stays clean automatically
                await kv.expire(dailyKey, 60 * 60 * 24 * 95);
            }
        }

        return NextResponse.json({ success: true, timestamp });
    } catch (error) {
        console.error('Cron job error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process' }, { status: 500 });
    }
}
