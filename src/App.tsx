import React, { useState } from "react";
import { Header } from "./components/Header";
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
        {/* Tab Views */}
        {activeTab === "A" && <TabRiskAnalysis />}
        {activeTab === "B" && <TabPureComparison />}
        {activeTab === "C" && <TabMixedOptimization />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-700">
            홍해·수에즈 회랑 KD 부품 물류 의사결정 데모
          </p>
          <p className="text-[11px] text-slate-500">
            차질 위험 분석 · 단일 대안 비교 · 혼합 물량 배분
          </p>
          <p className="text-[10px] text-slate-400 max-w-3xl mx-auto">
            본 결과는 운송 의사결정을 지원하는 참고안이며, 실제 실행 전 담당자의 확인이 필요합니다.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
