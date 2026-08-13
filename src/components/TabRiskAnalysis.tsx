import React, { useState } from "react";
import {
  Search,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ListOrdered,
  HelpCircle,
  ArrowRight,
  Database,
  Cpu,
} from "lucide-react";
import { RiskAnalyzeResponse } from "../types";
import { analyzeRisk } from "../api/client";

export function TabRiskAnalysis() {
  const [query, setQuery] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<"HIGH" | "MEDIUM" | "LOW" | null>("HIGH");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      level: "HIGH" as const,
      label: "HIGH 위험: 홍해 선박 공격 및 수에즈 운항 중단 공식 발표",
      queryText: "홍해 선박 공격 및 수에즈 운항 중단 공식 발표",
      badgeColor: "bg-red-50 text-red-700 border-red-200",
    },
    {
      level: "MEDIUM" as const,
      label: "MEDIUM 위험: 홍해 수송 위험 경고 및 주요 선사 우회 검토",
      queryText: "홍해 수송 위험 경고 및 주요 선사 우회 검토",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      level: "LOW" as const,
      label: "LOW 위험: 중동 지역 지정학적 긴장 및 일반 동향",
      queryText: "중동 지역 지정학적 긴장 및 일반 동향",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];

  const handleAnalyze = async (presetOverride?: "HIGH" | "MEDIUM" | "LOW") => {
    setLoading(true);
    setError(null);
    try {
      const levelToUse = presetOverride || selectedPreset || undefined;
      const data = await analyzeRisk({
        query: query || (levelToUse ? presets.find(p => p.level === levelToUse)?.queryText : undefined),
        user_prompt: userPrompt || undefined,
        preset_level: levelToUse || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError("위험 분석 처리 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">차질 위험 분석 입력</h2>
          <span className="text-[11px] px-2.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium">
            🔵 공개 근거 뉴스 & 🟢 팀 합성 시나리오
          </span>
        </div>

        {/* Preset Selection Buttons */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            합성 시나리오 프리셋 선택:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {presets.map((p) => (
              <button
                key={p.level}
                type="button"
                onClick={() => {
                  setSelectedPreset(p.level);
                  setQuery(p.queryText);
                }}
                className={`p-3 rounded-xl border text-left text-xs transition-all flex flex-col justify-between cursor-pointer ${
                  selectedPreset === p.level
                    ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.badgeColor}`}>
                    {p.level} RISK
                  </span>
                  {selectedPreset === p.level && (
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  )}
                </div>
                <span className="font-medium line-clamp-2">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Query or Natural Language Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              뉴스 검색 요청 (키워드)
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedPreset(null);
              }}
              placeholder="예: 홍해 선박 공격 및 선사 운항 중단 동향"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              담당자 자연어 구체적 상황 요청 (선택)
            </label>
            <input
              type="text"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="예: 유럽 HMMC 공장향 ECU 부품의 선사 우회 여부 정밀 점검"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            onClick={() => handleAnalyze()}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>위험 분석 수행 중...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>차질 위험 분석 실행</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Analysis Results View */}
      {result && (
        <div className="space-y-5">
          {/* Top Status Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl border ${
                    result.risk_grade === "HIGH"
                      ? "bg-red-50 border-red-200 text-red-600"
                      : result.risk_grade === "MEDIUM"
                      ? "bg-amber-50 border-amber-200 text-amber-600"
                      : "bg-emerald-50 border-emerald-200 text-emerald-600"
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">차질 위험 평가 등급:</span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider border ${
                        result.risk_grade === "HIGH"
                          ? "bg-red-100 text-red-800 border-red-200"
                          : result.risk_grade === "MEDIUM"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {result.risk_grade} RISK
                    </span>
                    {result.is_synthetic && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-medium">
                        <Database className="w-3 h-3 text-emerald-600" />
                        🟢 팀 합성 시나리오
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    홍해·수에즈 회랑 정성적 차질 분석 보고서
                  </h3>
                </div>
              </div>
            </div>

            {/* Situation Summary */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>1. 상황 요약 (Situation Summary)</span>
                <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded font-medium">
                  🟣 AI 요약
                </span>
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed font-sans">
                {result.situation_summary}
              </p>
            </div>
          </div>

          {/* Priority Check Shipments Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  2. 우선 점검 대상 운송 건 (Priority Check Shipments)
                </h3>
                <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                  🟢 출항예정일 오름차순 정렬
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                총 {result.priority_shipments.length}건 화물
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">우선순위</th>
                    <th className="py-2.5 px-3 font-semibold">주문 ID (Shipment)</th>
                    <th className="py-2.5 px-3 font-semibold">목적 공장</th>
                    <th className="py-2.5 px-3 font-semibold">부품 ID / 명칭</th>
                    <th className="py-2.5 px-3 font-semibold text-right">물량 (Pallet)</th>
                    <th className="py-2.5 px-3 font-semibold">출항 예정일</th>
                    <th className="py-2.5 px-3 font-semibold">요구 도착일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {result.priority_shipments.map((s, idx) => (
                    <tr key={s.order_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-amber-600">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">
                        {s.order_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        {s.destination_plant}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-slate-500 mr-1.5">[{s.part_id}]</span>
                        <span className="text-slate-800 font-medium">{s.part_name}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                        {s.qty} pallet
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {s.planned_departure_date}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {s.required_arrival_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence, Uncertainty, Preparation Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Judgement Evidence */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-sky-800 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-600" />
                <span>3. 판단 근거 (Public Evidence)</span>
                <span className="text-[10px] text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-medium">
                  🔵 공개
                </span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {result.evidence_summary.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-sky-600 font-bold">•</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Uncertainty */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>4. 주요 불확실성 (Uncertainty)</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {result.uncertainty.map((un, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-amber-600 font-bold">•</span>
                    <span>{un}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Preparation Actions */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-emerald-800 mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>5. 지금 할 준비 행동 (Actions)</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {result.preparation_actions.map((act, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
