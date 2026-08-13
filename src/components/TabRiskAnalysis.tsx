import React, { useState } from "react";
import {
  Search,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ListOrdered,
  HelpCircle,
  ArrowRight,
  Database,
} from "lucide-react";
import { RiskAnalyzeResponse } from "../types";
import { analyzeRisk } from "../api/client";

type ManualInputMode = "KEYWORD" | "ARTICLE";
type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

export function TabRiskAnalysis() {
  const [inputMode, setInputMode] = useState<ManualInputMode>("KEYWORD");
  const [query, setQuery] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<RiskLevel | null>(null);
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

  const canAnalyze = selectedPreset !== null ||
    (inputMode === "KEYWORD" ? query.trim().length > 0 : articleBody.trim().length > 0);

  const switchInputMode = (mode: ManualInputMode) => {
    setInputMode(mode);
    setSelectedPreset(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError(inputMode === "ARTICLE" ? "분석할 기사 본문을 입력하세요." : "분석할 키워드·상황을 입력하세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await analyzeRisk(
        selectedPreset
          ? {
              input_mode: "KEYWORD",
              query,
              preset_level: selectedPreset,
            }
          : inputMode === "ARTICLE"
          ? {
              input_mode: "ARTICLE",
              article_title: articleTitle || undefined,
              article_body: articleBody,
            }
          : {
              input_mode: "KEYWORD",
              query,
            },
      );
      setResult(data);
    } catch (err: any) {
      setError("위험 분석 처리 중 오류가 발생했습니다: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const riskColor = result?.risk_grade === "HIGH"
    ? "bg-red-100 text-red-800 border-red-200"
    : result?.risk_grade === "MEDIUM"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : "bg-emerald-100 text-emerald-800 border-emerald-200";

  const yesNo = (value: boolean) => value ? "YES" : "NO";

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">차질 위험 분석 입력</h2>
          <span className="text-[11px] px-2.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium">
            기사·상황을 Gemini가 직접 분석
          </span>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            팀 합성 시나리오 프리셋
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {presets.map((p) => (
              <button
                key={p.level}
                type="button"
                onClick={() => {
                  setSelectedPreset(p.level);
                  setInputMode("KEYWORD");
                  setQuery(p.queryText);
                  setArticleTitle("");
                  setArticleBody("");
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
                  {selectedPreset === p.level && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                </div>
                <span className="font-medium line-clamp-2">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            직접 분석 입력 방식
          </label>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => switchInputMode("KEYWORD")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "KEYWORD" && !selectedPreset
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              키워드·상황 입력
            </button>
            <button
              type="button"
              onClick={() => switchInputMode("ARTICLE")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputMode === "ARTICLE"
                  ? "bg-white text-blue-700 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              기사 본문 직접 입력
            </button>
          </div>
        </div>

        {inputMode === "KEYWORD" ? (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              키워드·상황 문장
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedPreset(null);
              }}
              placeholder="예: 후티가 홍해 상선에 대한 공격 범위를 확대하겠다고 경고"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              이 모드는 입력한 문장 자체를 분석합니다. 실시간 뉴스 검색을 수행하지 않습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                기사 제목 (선택)
              </label>
              <input
                type="text"
                value={articleTitle}
                onChange={(e) => {
                  setArticleTitle(e.target.value);
                  setSelectedPreset(null);
                }}
                placeholder="기사 제목을 입력하세요"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                기사 본문
              </label>
              <textarea
                value={articleBody}
                onChange={(e) => {
                  setArticleBody(e.target.value);
                  setSelectedPreset(null);
                }}
                rows={9}
                placeholder="분석할 기사 본문 또는 필요한 발췌문을 붙여넣으세요. URL만 입력하면 본문을 자동 수집하지 않습니다."
                className="w-full resize-y bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all leading-relaxed"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading || !canAnalyze}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gemini 분석 수행 중...</span>
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

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl border ${riskColor}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">차질 위험 평가 등급:</span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider border ${riskColor}`}>
                      {result.risk_grade} RISK
                    </span>
                    {result.is_synthetic ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-medium">
                        <Database className="w-3 h-3 text-emerald-600" />
                        팀 합성 시나리오
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium">
                        Gemini 직접 분석
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    홍해·수에즈 회랑 정성적 차질 분석 보고서
                  </h3>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>1. 상황 요약</span>
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                {result.situation_summary}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5">2. Gemini 판단 설명</h4>
              <p className="text-xs text-slate-700 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 leading-relaxed">
                {result.analysis_explanation}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">3. 구조화 분석 데이터</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                <StructuredItem label="입력 방식" value={result.input_mode} />
                <StructuredItem label="홍해 관련성" value={result.shipping_relevance} />
                <StructuredItem label="사건 유형" value={result.event_type} />
                <StructuredItem label="상선 직접 위협" value={yesNo(result.commercial_shipping_threat)} />
                <StructuredItem label="실제 상선 공격" value={yesNo(result.actual_commercial_ship_attack)} />
                <StructuredItem label="선사 운영 변경" value={yesNo(result.carrier_operation_change)} />
                <StructuredItem label="공식 통항 제한" value={yesNo(result.official_transit_restriction)} />
                <StructuredItem label="합성 데이터" value={yesNo(result.is_synthetic)} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  4. 우선 점검 대상 운송 건
                </h3>
                <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                  출항예정일 오름차순
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                총 {result.priority_shipments.length}건
              </span>
            </div>

            {result.priority_shipments.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                입력이 홍해·수에즈 상업 해운과 무관하다고 판단되어 우선 점검 화물을 표시하지 않습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                      <th className="py-2.5 px-3 font-semibold">우선순위</th>
                      <th className="py-2.5 px-3 font-semibold">주문 ID</th>
                      <th className="py-2.5 px-3 font-semibold">목적 공장</th>
                      <th className="py-2.5 px-3 font-semibold">부품 ID / 명칭</th>
                      <th className="py-2.5 px-3 font-semibold text-right">물량</th>
                      <th className="py-2.5 px-3 font-semibold">출항 예정일</th>
                      <th className="py-2.5 px-3 font-semibold">요구 도착일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {result.priority_shipments.map((s, idx) => (
                      <tr key={s.order_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-amber-600">#{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-800 font-semibold">{s.order_id}</td>
                        <td className="py-2.5 px-3 font-semibold text-blue-700">{s.destination_plant}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-500 mr-1.5">[{s.part_id}]</span>
                          <span className="text-slate-800 font-medium">{s.part_name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">{s.qty} pallet</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{s.planned_departure_date}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{s.required_arrival_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-sky-800 mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sky-600" />
                <span>5. 판단 근거</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700">
                {result.evidence_summary.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-sky-600 font-bold">•</span>
                    <span>{ev}</span>
                  </li>
                ))}
              </ul>
              {result.evidence_spans.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-600 mb-2">입력 원문 근거 구절</p>
                  <div className="space-y-2">
                    {result.evidence_spans.map((span, i) => (
                      <blockquote key={i} className="text-[11px] text-slate-600 border-l-2 border-sky-300 pl-2.5 leading-relaxed">
                        “{span}”
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-amber-800 mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>6. 주요 불확실성</span>
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

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h4 className="text-xs font-bold text-emerald-800 mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>7. 지금 할 준비 행동</span>
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

function StructuredItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 min-w-0">
      <div className="text-[10px] font-semibold text-slate-500 mb-1">{label}</div>
      <div className="text-[11px] font-bold text-slate-800 break-words">{value}</div>
    </div>
  );
}
