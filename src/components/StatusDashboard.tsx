'use client';

import { useState, useEffect } from 'react';
import { PlusSquare, MinusSquare, RefreshCw, AlertCircle } from 'lucide-react';

type ServiceStatus = 'operational' | 'degraded_performance' | 'major_outage';

interface Service {
    id: string;
    name: string;
    description: string;
    status: ServiceStatus;
    latency: number;
    history: ServiceStatus[];
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
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, []);

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
            : Array(90).fill(service.status);
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
            </div>
        );
    };

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
                <button
                    onClick={fetchStatus}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 text-[14px] text-[#A1A1AA] hover:text-white transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0066FF]' : ''}`} />
                    {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                </button>
                <span className="text-[14px] text-[#A1A1AA]">
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

        </div>
    );
}
