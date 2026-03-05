import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Service {
    id: string;
    name: string;
    url: string;
    description: string;
}

interface Ping {
    timestamp: string;
    status: string;
    latency: number;
}

const SERVICES = [
    {
        id: 'gateway',
        name: 'Worker Gateway API',
        url: 'https://proxy.smoothsend.xyz/health',
        description: 'Cloudflare Worker routing and rate limiting API layer.',
    },
    {
        id: 'evm-relayer',
        name: 'EVM Relayer (Testnet)',
        url: 'https://smoothsendrelayerevm.onrender.com/api/v1/relayer/health',
        description: 'Relays transactions to EVM compatible chains (Ethereum, Polygon, Arbitrum).',
    },
    {
        id: 'stellar-relayer',
        name: 'Stellar Relayer (Testnet)',
        url: 'https://stellar-relayer.onrender.com/health',
        description: 'Soroban smart contract execution relayer for the Stellar network.',
    },
    {
        id: 'aptos-relayer',
        name: 'Aptos Relayer (Mainnet)',
        url: 'http://api.smoothsend.xyz:3000/ping',
        description: 'Relays transactions to the Aptos network utilizing gasless capabilities.',
    }
];

export async function GET() {
    // Generate dates for the past 90 days to query KV
    const today = new Date();
    const past90Days = Array.from({ length: 90 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (89 - i));
        return d.toISOString().split('T')[0];
    });

    const results = await Promise.allSettled(
        SERVICES.map(async (service) => {
            const startTime = Date.now();
            let liveStatus = 'operational';
            let latency = 0;
            let statusCode = 200;

            try {
                const response = await fetch(service.url, {
                    timeout: 10000,
                    cache: 'no-store',
                    headers: { 'User-Agent': 'SmoothSend-Gateway-KeepAlive' }
                } as any);
                latency = Date.now() - startTime;
                statusCode = response.status;

                if (!response.ok) {
                    liveStatus = response.status >= 500 ? 'major_outage' : 'degraded_performance';
                }
            } catch (err) {
                liveStatus = 'major_outage';
                latency = Date.now() - startTime;
                statusCode = 500;
            }

            // Fetch daily history and recent pings from Vercel KV
            let history: string[] = [];
            let pings: Ping[] = [];
            try {
                // If KV isn't configured yet, this will fail gracefully
                const multi = kv.pipeline();
                past90Days.forEach(date => {
                    multi.get(`daily:${service.id}:${date}`);
                });

                // Fetch the last 60 pings (approx 5 hours of data if 5m interval)
                multi.lrange(`pings:${service.id}`, 0, 59);

                const kvResults = await multi.exec();

                // Extract pings (last item in results array)
                const rawPings = kvResults.pop() as string[] | null;
                if (rawPings) {
                    pings = rawPings.map(p => JSON.parse(p)).reverse();
                }

                // Map the DB history. If a day has no data, default to operational
                history = kvResults.map((h: unknown, i: number) => {
                    // For the very last item (Today), always use the freshest live status
                    if (i === 89) return liveStatus;
                    // Otherwise use KV data or default if missing
                    return (h as string) || 'operational';
                });
            } catch (kvError) {
                // Fallback if KV doesn't exist: fill with live status
                history = Array(90).fill(liveStatus);
            }

            return {
                ...service,
                status: liveStatus,
                latency,
                statusCode,
                history,
                pings
            };
        })
    );

    const statuses = results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        }
        // Fallback if Promise.allSettled fails for some odd reason on a single item
        return {
            ...SERVICES[index],
            status: 'major_outage',
            latency: 0,
            error: 'Failed to execute health check'
        };
    });

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        services: statuses,
        overall: statuses.some(s => s.status === 'major_outage') ? 'major_outage' :
            statuses.some(s => s.status === 'degraded_performance') ? 'degraded_performance' :
                'operational'
    });
}
