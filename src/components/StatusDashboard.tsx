'use client';

import { useState, useEffect } from 'react';
import { PlusSquare, MinusSquare, RefreshCw, AlertCircle } from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded_performance' | 'major_outage';

interface Ping {
    timestamp: string;
    status: ServiceStatus;
    latency: number;
}

interface Service {
    id: string;
    name: string;
    description: string;
    status: ServiceStatus;
    latency: number;
    history: ServiceStatus[];
    pings?: Ping[];
}

interface StatusData {
    timestamp: string;
    services: Service[];
    overall: ServiceStatus;
}

// Math to get uptime percentage
const getUptimePercentage = (history: ServiceStatus[]) => {
    const operationalDays = history.filter(s => s === 'operational').length;
    const perc = (operationalDays / history.length) * 100;
    return perc === 100 ? '100.0' : perc.toFixed(2);
};

export function StatusDashboard() {
    const [data, setData] = useState<StatusData | null>(null);
    const [isMainnetOpen, setIsMainnetOpen] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshCountdown, setRefreshCountdown] = useState(300);

    // Announcement Configuration - Toggle 'active' to show a banner
    const announcement = {
        active: false,
        title: "Scheduled Maintenance",
        message: "We will be performing scheduled maintenance on our internal databases. Uptime metric reporting may be delayed, but relayer operations will not be affected.",
        type: "info" // 'info', 'warning', 'critical'
    };

    const fetchStatus = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('/api/status');
            const result = await res.json();
            setData(result);
        } catch (error) {
            console.error('Failed to fetch status:', error);
        } finally {
            setIsRefreshing(false);
        }
    };
    useEffect(() => {
        fetchStatus();
    }, []);

    // Countdown timer logic
    useEffect(() => {
        if (isRefreshing) return;

        const timer = setInterval(() => {
            setRefreshCountdown(prev => {
                if (prev <= 1) {
                    fetchStatus();
                    return 300; // Reset after fetch (5 minutes)
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [isRefreshing]);

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[#888]">
                Loading system metrics...
            </div>
        );
    }

    // Groups
    const coreServices = data.services.filter(s => s.id === 'gateway');
    const mainnetServices = data.services.filter(s => s.id === 'aptos-relayer');
    const testnetServices = data.services.filter(s => s.id === 'evm-relayer' || s.id === 'stellar-relayer');

    const renderServiceRow = (service: Service, index: number) => {
        // Use real history from API; fall back to repeating current status if missing
        const history: ServiceStatus[] = (service.history?.length === 90)
            ? service.history as ServiceStatus[]
            : [...Array(89).fill('operational' as ServiceStatus), service.status];
        const uptimeStr = getUptimePercentage(history);

        return (
            <div key={service.id} className="mb-8 last:mb-2">
                <div className="flex justify-between items-end mb-2">
                    <h3 className="text-[15px] font-medium text-white">{service.name}</h3>
                    <span className={`text-[15px] ${service.status === 'operational' ? 'text-[#0066FF]' :
                        service.status === 'degraded_performance' ? 'text-[#F5A623]' : 'text-[#D0021B]'
                        }`}>
                        {service.status === 'operational' ? 'Operational' :
                            service.status === 'degraded_performance' ? 'Degraded Performance' : 'Major Outage'}
                    </span>
                </div>

                {/* Timeline Bars */}
                <div className="flex h-8 w-full gap-[2px] items-stretch">
                    {history.map((dayStatus, i) => (
                        <div
                            key={i}
                            className={`flex-1 transition-colors hover:opacity-80 ${dayStatus === 'operational' ? 'bg-[#0066FF]' :
                                dayStatus === 'degraded_performance' ? 'bg-[#F5A623]' : 'bg-[#D0021B]'
                                }`}
                        />
                    ))}
                </div>

                {/* Under timeline legend */}
                <div className="flex justify-between items-center mt-2 text-[13px] text-[#A1A1AA] font-medium">
                    <span>90 days ago</span>
                    <div className="flex items-center gap-4 flex-1 px-4">
                        <div className="h-px bg-[#333] flex-1"></div>
                        <span className="text-white">{uptimeStr} % uptime</span>
                        <div className="h-px bg-[#333] flex-1"></div>
                    </div>
                    <span>Today</span>
                </div>

                {/* Latency Graph (if data exists) */}
                {service.pings && service.pings.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#333]/50">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[13px] text-[#A1A1AA] font-medium">System Latency (ms)</span>
                            <span className="text-[13px] text-white font-mono">{service.latency} ms</span>
                        </div>
                        <div className="h-16 w-full flex items-end gap-[2px]">
                            {service.pings.map((ping, i) => {
                                // Clamp bar height between 10% and 100% of container height (64px)
                                // Assume max expected expected latency is around 1000ms for visualization
                                const maxExpectedLatency = 1000;
                                const heightPercent = Math.max(10, Math.min(100, (ping.latency / maxExpectedLatency) * 100));

                                return (
                                    <div
                                        key={ping.timestamp + i}
                                        className={`flex-1 transition-all rounded-t-sm opacity-80 hover:opacity-100 relative group cursor-crosshair
                                            ${ping.status === 'operational' ? 'bg-[#0066FF]' :
                                                ping.status === 'degraded_performance' ? 'bg-[#F5A623]' : 'bg-[#D0021B]'}`}
                                        style={{ height: `${heightPercent}%` }}
                                    >
                                        {/* Simple Tooltip */}
                                        <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#000] border border-[#333] text-white text-[11px] px-2 py-1 rounded z-10 pointer-events-none">
                                            {ping.latency} ms<br />
                                            <span className="text-[#A1A1AA] text-[10px]">
                                                {new Date(ping.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Calculate Past Incidents
    const getPastIncidents = () => {
        const incidents: { date: Date, services: { name: string, status: string }[] }[] = [];

        // Use past 90 days
        const today = new Date();
        const past90Days = Array.from({ length: 90 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (89 - i));
            return d;
        });

        // Search each day
        past90Days.forEach((date, dayIndex) => {
            const affectedServices = data.services.filter(s => {
                const historyStatus = s.history?.[dayIndex];
                return historyStatus === 'degraded_performance' || historyStatus === 'major_outage';
            }).map(s => ({
                name: s.name,
                status: s.history[dayIndex]
            }));

            if (affectedServices.length > 0) {
                // Ignore today if there's no overall outage today, since we only want historical ones listed below
                if (dayIndex !== 89) {
                    incidents.push({ date, services: affectedServices });
                }
            }
        });

        return incidents.reverse(); // Most recent first
    };

    const pastIncidents = getPastIncidents();

    return (
        <div className="w-full">
            {/* Announcement Banner */}
            {announcement.active && (
                <div className="mb-6 p-4 border border-[#333] bg-[#0A0A0A] rounded-sm flex items-start gap-3">
                    <AlertCircle className={`w-5 h-5 mt-0.5 ${announcement.type === 'warning' ? 'text-[#F5A623]' : announcement.type === 'critical' ? 'text-[#D0021B]' : 'text-[#0066FF]'}`} />
                    <div>
                        <h3 className="text-white font-medium mb-1 text-[15px]">{announcement.title}</h3>
                        <p className="text-[#A1A1AA] text-[14px] leading-relaxed">
                            {announcement.message}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    {/* Live Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0066FF]/10 text-[#0066FF] rounded-full">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066FF] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066FF]"></span>
                        </span>
                        <span className="text-[13px] font-medium tracking-wide">Live Updates</span>
                    </div>
                    <button
                        onClick={fetchStatus}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 text-[13px] text-[#A1A1AA] hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#0066FF]' : ''}`} />
                        {isRefreshing ? 'Fetching...' : `Next update in ${refreshCountdown}s`}
                    </button>
                </div>
                <span className="text-[14px] text-[#A1A1AA] hidden sm:block">
                    Uptime over the past 90 days.
                </span>
            </div>

            <div className="border border-[#333]">

                {/* Mainnet Networks block (Highlighting Aptos) */}
                {mainnetServices.length > 0 && (
                    <div className="p-6 border-b border-[#333]">
                        <button
                            onClick={() => setIsMainnetOpen(!isMainnetOpen)}
                            className="flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity"
                        >
                            {isMainnetOpen ? <MinusSquare className="w-4 h-4 text-[#0066FF]" /> : <PlusSquare className="w-4 h-4 text-[#0066FF]" />}
                            <h2 className="text-[16px] font-bold tracking-wide text-white">Mainnet Services (Production)</h2>
                        </button>

                        {isMainnetOpen && (
                            <div className="pl-[2px] animate-in fade-in duration-300">
                                {mainnetServices.map((service, i) => renderServiceRow(service, i + 10))}
                            </div>
                        )}
                    </div>
                )}

                {/* Core Infrastructure block */}
                {coreServices.length > 0 && (
                    <div className="p-6 border-b border-[#333]">
                        <div className="flex items-center gap-2 mb-6">
                            <MinusSquare className="w-4 h-4 text-white" />
                            <h2 className="text-[16px] font-bold tracking-wide text-white">Core Infrastructure</h2>
                        </div>

                        <div className="pl-[2px]">
                            {coreServices.map((service, i) => renderServiceRow(service, i))}
                        </div>
                    </div>
                )}

                {/* Testnet Relayers block */}
                {testnetServices.length > 0 && (
                    <div className="p-6 border-b border-[#333] last:border-b-0">
                        <div className="flex items-center gap-2 mb-6">
                            <MinusSquare className="w-4 h-4 text-white" />
                            <h2 className="text-[16px] font-bold tracking-wide text-white">Testnet Relayers (Experimental)</h2>
                        </div>

                        <div className="pl-[2px]">
                            {testnetServices.map((service, i) => renderServiceRow(service, i + 20))}
                        </div>
                    </div>
                )}
            </div>

            {/* Past Incidents Section */}
            <div className="mt-12 mb-8">
                <h2 className="text-[20px] font-bold text-white mb-6">Past Incidents</h2>

                {pastIncidents.length === 0 ? (
                    <div className="text-[#A1A1AA] text-[15px] p-6 border border-[#333] border-dashed rounded-sm text-center">
                        No incidents reported in the last 90 days. All systems operational.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {pastIncidents.map((incident, i) => (
                            <div key={i} className="pb-6 border-b border-[#333] last:border-b-0">
                                <h3 className="text-white text-[16px] font-medium mb-3">
                                    {incident.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </h3>
                                <div className="space-y-2 pl-4 border-l-2 border-[#333]">
                                    {incident.services.map((svc, j) => (
                                        <div key={j} className="flex flex-col gap-1">
                                            <span className={`text-[14px] font-medium ${svc.status === 'degraded_performance' ? 'text-[#F5A623]' : 'text-[#D0021B]'
                                                }`}>
                                                {svc.status === 'degraded_performance' ? 'Degraded Performance' : 'Major Outage'}
                                            </span>
                                            <span className="text-[#A1A1AA] text-[14px]">
                                                Impacted {svc.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
