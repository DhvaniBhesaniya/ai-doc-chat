import React, { useEffect, useState } from "react";

export default function LoadingOverlay() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-900 to-purple-900">
      <div className="relative w-64 h-64">
        <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-indigo-500 shadow-lg flex items-center justify-center animate-pulse">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-6 0l6 6" />
                </svg>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/80">AI Scanner</div>
            </div>
            <div className="w-40 h-28 bg-white/5 rounded-md border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 p-3 text-white/60 text-xs">
                <div className="h-2 w-3/4 bg-white/10 rounded mb-2" />
                <div className="h-2 w-2/3 bg-white/10 rounded mb-2" />
                <div className="h-2 w-1/2 bg-white/10 rounded mb-2" />
                <div className="h-2 w-4/5 bg-white/10 rounded" />
              </div>
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-transparent via-indigo-400 to-transparent animate-[scan_1.5s_ease-in-out_infinite]" />
            </div>
            <div className="text-white/80 text-sm">Scanning your documents...</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes scan{0%{transform:translateX(0)}50%{transform:translateX(9.5rem)}100%{transform:translateX(0)}}`}</style>
    </div>
  );
} 