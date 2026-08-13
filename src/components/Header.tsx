import React from "react";
import { AlertTriangle, Layers, GitMerge, Anchor } from "lucide-react";

interface HeaderProps {
  activeTab: "A" | "B" | "C";
  setActiveTab: (tab: "A" | "B" | "C") => void;
}

export function Header({ activeTab, setActiveTab }: HeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-md shadow-blue-950/50">
              <Anchor className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  KD 부품 물류 차질 대응 지원
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 border border-blue-400/30 text-blue-300 px-2.5 py-0.5 rounded-full">
                  MOVE AI Challenge 2026
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                홍해·수에즈 위험 감지부터 운송 대안 비교와 물량 배분까지
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab("A")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "A"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>1. 차질 위험 분석</span>
            </button>

            <button
              onClick={() => setActiveTab("B")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "B"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. 단일 대안 비교</span>
            </button>

            <button
              onClick={() => setActiveTab("C")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "C"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <GitMerge className="w-4 h-4" />
              <span>3. 혼합 물량 배분</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
