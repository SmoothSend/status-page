import Image from 'next/image';
import { StatusDashboard } from '@/components/StatusDashboard';

export const metadata = {
  title: 'SmoothSend Status',
  description: 'Real-time status of SmoothSend core infrastructure and services.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex flex-col items-start gap-4 border-b border-[#333] pb-6">
          <div className="flex items-center gap-3">
            <Image
              src="/Logo Light.png"
              alt="SmoothSend Logo"
              width={32}
              height={32}
              className="object-contain hover:opacity-80 transition-opacity"
            />
            <h1 className="text-xl font-medium tracking-tight text-white/90">
              SmoothSend Status
            </h1>
          </div>
        </header>

        <StatusDashboard />

        <footer className="mt-24 pt-8 border-t border-[#333] text-sm text-[#888] flex flex-col items-start gap-2">
          <p>&copy; {new Date().getFullYear()} SmoothSend. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
