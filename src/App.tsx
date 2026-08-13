import React, { useState } from "react";
import { Header } from "./components/Header";
import { BadgeLegend } from "./components/BadgeLegend";
import { TabRiskAnalysis } from "./components/TabRiskAnalysis";
import { TabPureComparison } from "./components/TabPureComparison";
import { TabMixedOptimization } from "./components/TabMixedOptimization";

export function App() {
  const [activeTab, setActiveTab] = useState<"A" | "B" | "C">("A");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Top Sticky Navigation Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Source Badges Legend */}
        <BadgeLegend />

        {/* Tab Views */}
        {activeTab === "A" && <TabRiskAnalysis />}
        {activeTab === "B" && <TabPureComparison />}
        {activeTab === "C" && <TabMixedOptimization />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-700">
            MOVE AI Challenge 2026 — 현대글로비스 트랙 데모 솔루션
          </p>
          <p className="text-[11px] text-slate-500">
            Operations Research (Google OR-Tools CP-SAT) & Server-side Gemini AI Decision Support System
          </p>
          <p className="text-[10px] text-slate-400 max-w-3xl mx-auto">
            ※ 본 시스템에서 제공하는 정성적 위험 분석 및 물량 배분 최적안은 담당자의 의사결정을 지원하기 위한 참고 자료이며, 최종 발주 및 운송 계약 승인은 담당자 판단에 의합니다.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
