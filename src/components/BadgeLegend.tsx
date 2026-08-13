import React from "react";
import { Info, ShieldAlert, Cpu, Database } from "lucide-react";

export function BadgeLegend() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 mb-6 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-700 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-800">
        <Info className="w-4 h-4 text-blue-600" />
        <span>데이터 및 AI 출처 표기 기준:</span>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-800 font-medium">
          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          🔵 공개 근거 (외신·선사 공지)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          🟢 팀 합성 데이터 (운송·재고)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-800 font-medium">
          <Cpu className="w-3.5 h-3.5 text-purple-600" />
          🟣 AI 설명 (Gemini 요약)
        </span>
      </div>
    </div>
  );
}
