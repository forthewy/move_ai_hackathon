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
  Link,
  Newspaper,
  ExternalLink,
  CheckSquare,
  Square,
  Globe,
  Calendar,
} from "lucide-react";
import { RiskAnalyzeResponse, NewsSearchItem } from "../types";
import { analyzeRisk, searchNews } from "../api/client";
import { displayPlant, formatPallets } from "../utils/display";

type ManualInputMode = "KEYWORD" | "ARTICLE";
type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

const DEFAULT_SCENARIO = "홍해 수에즈 상선 공격";

export function TabRiskAnalysis() {
  const [inputMode, setInputMode] = useState<ManualInputMode>("KEYWORD");
  const [query, setQuery] = useState(DEFAULT_SCENARIO);
  const [articleUrl, setArticleUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<RiskLevel | null>(null);

  // Real-time news search states (multi-selection)
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchedArticles, setSearchedArticles] = useState<NewsSearchItem[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<NewsSearchItem[]>([]);
  const [searchExecuted, setSearchExecuted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RiskAnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      level: "HIGH" as const,
      label: "홍해 선박 공격과 수에즈 운항 중단이 공식 발표된 상황",
      queryText: "홍해 선박 공격 및 수에즈 운항 중단 공식 발표",
      badgeColor: "bg-red-50 text-red-700 border-red-200",
    },
    {
      level: "MEDIUM" as const,
      label: "홍해 수송 위험 경고로 주요 선사가 우회를 검토하는 상황",
      queryText: "홍해 수송 위험 경고 및 주요 선사 우회 검토",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      level: "LOW" as const,
      label: "중동 지역의 지정학적 긴장이 관찰되는 일반 상황",
      queryText: "중동 지역 지정학적 긴장 및 일반 동향",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];

  const canAnalyze =
    selectedPreset !== null ||
    selectedArticles.length > 0 ||
    (inputMode === "KEYWORD" ? query.trim().length > 0 : articleUrl.trim().length > 0);

  const switchInputMode = (mode: ManualInputMode) => {
    setInputMode(mode);
    setSelectedPreset(null);
    setError(null);
  };

  const handleSearchNews = async () => {
    if (!query.trim()) {
      setError("검색할 뉴스 키워드를 입력하세요.");
      return;
    }
    setSearchLoading(true);
    setError(null);
    setSelectedArticles([]);
    try {
      const res = await searchNews(query.trim(), 5);
      setSearchedArticles(res.articles || []);
      setSearchExecuted(true);
      if ((res.articles || []).length === 0) {
        setError("최근 1달 내 관련 뉴스를 찾지 못했습니다. 다른 키워드로 검색해 보세요.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "뉴스 검색 중 오류가 발생했습니다.");
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleArticleSelection = (art: NewsSearchItem) => {
    setSelectedPreset(null);
    setSelectedArticles((prev) => {
      const exists = prev.some((a) => a.link === art.link);
      if (exists) {
        return prev.filter((a) => a.link !== art.link);
      } else {
        return [...prev, art];
      }
    });
  };

  const toggleSelectAllArticles = () => {
    setSelectedPreset(null);
    if (selectedArticles.length === searchedArticles.length) {
      setSelectedArticles([]);
    } else {
      setSelectedArticles([...searchedArticles]);
    }
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError(
        inputMode === "ARTICLE"
          ? "분석할 기사 URL을 입력하세요."
          : "분석할 키워드를 입력하거나 검색된 기사를 선택하세요."
      );
      return;
    }

    if (inputMode === "ARTICLE" && !selectedPreset) {
      try {
        const url = new URL(articleUrl.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        setError("http:// 또는 https://로 시작하는 올바른 기사 URL을 입력하세요.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      let data: RiskAnalyzeResponse;
      if (selectedPreset) {
        data = await analyzeRisk({
          input_mode: "KEYWORD",
          query,
          preset_level: selectedPreset,
        });
      } else if (selectedArticles.length > 0) {
        data = await analyzeRisk({
          input_mode: "ARTICLE",
          selected_articles: selectedArticles,
        });
      } else if (inputMode === "ARTICLE") {
        data = await analyzeRisk({
          input_mode: "ARTICLE",
          article_url: articleUrl.trim(),
        });
      } else {
        data = await analyzeRisk({
          input_mode: "KEYWORD",
          query: query.trim(),
        });
      }
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "위험 분석을 완료하지 못했습니다. 다시 시도해 주세요."
      );
    } finally {
      setLoading(false);
    }
  };

  const riskColor =
    result?.risk_grade === "HIGH"
      ? "bg-red-100 text-red-800 border-red-200"
      : result?.risk_grade === "MEDIUM"
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : "bg-emerald-100 text-emerald-800 border-emerald-200";

  const yesNo = (value: boolean) => (value ? "예" : "아니오");
  const riskLabel = (level: RiskLevel) =>
    level === "HIGH" ? "위험 높음" : level === "MEDIUM" ? "주의 필요" : "위험 낮음";
  const relevanceLabel = (value: RiskAnalyzeResponse["shipping_relevance"]) =>
    value === "DIRECT" ? "직접 관련" : value === "INDIRECT" ? "간접 관련" : "관련 없음";

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">차질 위험 분석 입력</h2>
          <span className="text-[11px] px-2.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3 text-sky-600" />
            최근 1달 실시간 뉴스 다중 분석
          </span>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            빠른 데모 시나리오 (합성 데이터)
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
                  setArticleUrl("");
                  setSelectedArticles([]);
                  setSearchedArticles([]);
                  setSearchExecuted(false);
                }}
                className={`p-3 rounded-xl border text-left text-xs transition-all flex flex-col justify-between cursor-pointer ${
                  selectedPreset === p.level
                    ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 font-medium"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.badgeColor}`}>
                    {riskLabel(p.level)}
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
            분석 입력 방식
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
              🔍 최근 1달 뉴스 키워드 검색 (다중 기사 분석)
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
              🔗 특정 기사 URL 입력
            </button>
          </div>
        </div>

        {inputMode === "KEYWORD" ? (
          <div className="mb-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>뉴스 검색 키워드 (최근 30일 제한)</span>
                <span className="text-[11px] text-blue-600 font-normal">
                  * 여러 기사를 체크하여 종합 분석 가능
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedPreset(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !searchLoading) handleSearchNews();
                  }}
                  placeholder="예: 홍해 수에즈 상선 공격"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={handleSearchNews}
                  disabled={searchLoading || !query.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:bg-black disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {searchLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>최근 1달 뉴스 검색 (5건)</span>
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Google News RSS (`when:30d`) 및 Naver API를 연동하여 최근 30일 이내 뉴스만 수집합니다.
              </p>
            </div>

            {/* Render Searched Articles List (Multi-select support) */}
            {searchedArticles.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Newspaper className="w-4 h-4 text-blue-600" />
                    <span>최근 1달 검색 기사 ({searchedArticles.length}건중 {selectedArticles.length}개 선택됨):</span>
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={toggleSelectAllArticles}
                      className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      {selectedArticles.length === searchedArticles.length ? (
                        <>
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>전체 해제</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>전체 선택</span>
                        </>
                      )}
                    </button>
                    {selectedArticles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedArticles([])}
                        className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        선택 초기화 (키워드 문장만 분석)
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {searchedArticles.map((art, idx) => {
                    const isSelected = selectedArticles.some((a) => a.link === art.link);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleArticleSelection(art)}
                        className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 text-slate-900 shadow-sm"
                            : "bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              {art.source_name || "뉴스 매체"}
                            </span>
                            {art.pub_date && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                🗓️ {art.pub_date}
                              </span>
                            )}
                          </div>
                          <a
                            href={art.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-medium flex-shrink-0"
                          >
                            <span>원문 링크</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <h4 className="font-bold text-slate-900 mb-1 leading-snug flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <CheckSquare className="w-3 h-3" />}
                          </span>
                          <span>{art.title}</span>
                        </h4>
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed pl-6">
                          {art.snippet}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              기사 URL
            </label>
            <div className="relative">
              <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                value={articleUrl}
                onChange={(e) => {
                  setArticleUrl(e.target.value);
                  setSelectedPreset(null);
                  setSelectedArticles([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAnalyze && !loading) handleAnalyze();
                }}
                placeholder="https://example.com/news/article"
                autoComplete="url"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              공개적으로 접근 가능한 기사 URL을 입력하면 서버가 본문을 수집하여 분석합니다.
            </p>
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
                <span>Gemini 다중 정성 위험 분석 중...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>
                  {selectedArticles.length > 1
                    ? `선택한 ${selectedArticles.length}개 기사 종합 위험 분석 실행`
                    : selectedArticles.length === 1
                    ? "선택한 기사 위험 분석 실행"
                    : "차질 위험 분석 실행"}
                </span>
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
                    <span className="text-xs text-slate-500">차질 위험 등급:</span>
                    <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider border ${riskColor}`}>
                      {riskLabel(result.risk_grade)}
                    </span>
                    {result.is_synthetic ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-medium">
                        데모 시나리오
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1 font-medium">
                        <Globe className="w-3 h-3 text-purple-600" />
                        최근 1달 실시간 기사 종합 분석
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    홍해·수에즈 회랑 정성 위험 분석 결과
                  </h3>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>상황 요약</span>
              </h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed">
                {result.situation_summary}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-1.5">위험 등급 판단 근거</h4>
              <p className="text-xs text-slate-700 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 leading-relaxed">
                {result.analysis_explanation}
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">핵심 판단 항목</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
                <StructuredItem label="홍해 관련성" value={relevanceLabel(result.shipping_relevance)} />
                <StructuredItem label="상선 직접 위협" value={yesNo(result.commercial_shipping_threat)} />
                <StructuredItem label="실제 상선 공격" value={yesNo(result.actual_commercial_ship_attack)} />
                <StructuredItem label="선사 운영 변경" value={yesNo(result.carrier_operation_change)} />
                <StructuredItem label="공식 통항 제한" value={yesNo(result.official_transit_restriction)} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-900">
                  우선 점검 대상 운송 건
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
                      <th className="py-2.5 px-3 font-semibold">부품명</th>
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
                        <td className="py-2.5 px-3">
                          <span className="block font-semibold text-blue-700">{displayPlant(s.destination_plant)}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.destination_plant}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="block text-slate-800 font-medium">{s.part_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{s.part_id}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">{formatPallets(s.qty)}</td>
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
                <span>판단 근거</span>
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
                <span>주요 불확실성</span>
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
                <span>지금 할 준비 행동</span>
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
