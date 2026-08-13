import React, { useState, useEffect, useRef } from "react";
import {
  GitMerge,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  PieChart,
  BarChart2,
  Layers,
  Sparkles,
  Loader2,
  List,
  CheckSquare,
  Square,
  Database,
} from "lucide-react";
import { OrderModel, MixedOptimizeResponse } from "../types";
import { fetchOrders, optimizeMixedAllocation, explainResult } from "../api/client";

export function TabMixedOptimization() {
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [objectiveMode, setObjectiveMode] = useState<"TOTAL_DECISION_COST" | "DELAY_THEN_COST">("TOTAL_DECISION_COST");
  const [disruptionOccurred, setDisruptionOccurred] = useState<boolean>(true);
  const [result, setResult] = useState<MixedOptimizeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState<boolean>(false);
  const [aiExplanationError, setAiExplanationError] = useState<string | null>(null);
  const explanationRequestId = useRef(0);

  useEffect(() => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
        setSelectedOrderIds(data.map((o) => o.order_id));
      })
      .catch((err) => setError("주문 목록을 불러오지 못했습니다: " + err.message));
  }, []);

  const handleRunOptimization = async () => {
    explanationRequestId.current += 1;
    setAiExplanation(null);
    setAiExplanationLoading(false);
    setAiExplanationError(null);
    setLoading(true);
    setError(null);
    try {
      const res = await optimizeMixedAllocation({
        selected_order_ids: selectedOrderIds.length > 0 ? selectedOrderIds : undefined,
        objective_mode: objectiveMode,
        disruption_occurred: disruptionOccurred,
      });
      setResult(res);
    } catch (err: any) {
      setError("OR-Tools 최적화 처리 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.order_id));
    }
  };

  const toggleOrderSelection = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((oId) => oId !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const handleGenerateAiExplanation = async () => {
    if (!result || loading || aiExplanationLoading || aiExplanation) return;

    const requestId = ++explanationRequestId.current;
    setAiExplanationLoading(true);
    setAiExplanationError(null);
    try {
      const explanation = await explainResult({
        mode: "mixed",
        data: {
          solver_status: result.status,
          is_optimal: result.is_optimal,
          objective_mode: result.objective_mode,
          stage1_status: result.stage1_status,
          stage2_status: result.stage2_status,
          total_variable_transport_cost: result.total_variable_transport_cost,
          total_fixed_cost: result.total_fixed_cost,
          total_delay_penalty: result.total_delay_penalty,
          total_decision_cost: result.total_decision_cost,
          total_delay_pallet_days: result.total_delay_pallet_days,
          best_delay_pallet_days: result.best_delay_pallet_days,
          secondary_transport_cost: result.secondary_transport_cost,
          alternative_plan_usage: result.alternative_plan_usage,
          air_usage: result.air_usage,
          stock_transfer_usages: result.stock_transfer_usages,
          option_activations: result.option_activations,
          allocations: result.allocations,
          facts: result.facts,
          warnings: result.warnings,
        },
      });
      if (requestId === explanationRequestId.current) {
        setAiExplanation(explanation);
      }
    } catch (err) {
      if (requestId === explanationRequestId.current) {
        setAiExplanationError(
          err instanceof Error ? err.message : "AI 결과 해설을 생성하지 못했습니다."
        );
      }
    } finally {
      if (requestId === explanationRequestId.current) {
        setAiExplanationLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration & Order Selection Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Google OR-Tools CP-SAT Mixed 최적 물량 배분
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1 font-mono font-medium">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              CP-SAT SOLVER
            </span>
          </div>

          <button
            onClick={handleRunOptimization}
            disabled={loading || selectedOrderIds.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>CP-SAT 최적화 계산 중...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>OR-Tools CP-SAT 최적 배분 실행</span>
              </>
            )}
          </button>
        </div>

        {/* Objective Mode Selection UI */}
        <div className="mb-5 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>최적화 목적함수 정책 선택 (Objective Mode)</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setObjectiveMode("TOTAL_DECISION_COST")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                objectiveMode === "TOTAL_DECISION_COST"
                  ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">
                  1. 비용·지연 종합 최소화 (TOTAL_DECISION_COST)
                </span>
                {objectiveMode === "TOTAL_DECISION_COST" && (
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                운송비, 고정비, 지연 패널티의 합이 가장 낮은 조합 (기본 설정)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setObjectiveMode("DELAY_THEN_COST")}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                objectiveMode === "DELAY_THEN_COST"
                  ? "bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-900">
                  2. 납기 우선 후 비용 최소화 (DELAY_THEN_COST)
                </span>
                {objectiveMode === "DELAY_THEN_COST" && (
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                총 지연 pallet-day를 먼저 최소화한 뒤 같은 지연 수준에서 운송비 최소화 (사전식 2단계)
              </p>
            </button>
          </div>
        </div>

        {/* Disruption Status */}
        <div className="mb-5 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>홍해·수에즈 물류 차질 상태</span>
          </span>
          <button
            type="button"
            onClick={() => setDisruptionOccurred(!disruptionOccurred)}
            className={`text-[11px] px-3.5 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
              disruptionOccurred
                ? "bg-red-100 border border-red-300 text-red-800"
                : "bg-emerald-100 border border-emerald-300 text-emerald-800"
            }`}
          >
            {disruptionOccurred ? "차질 발생" : "정상 운항"}
          </button>
        </div>

        {/* Order Multi-Selection */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
              <List className="w-4 h-4 text-slate-500" />
              <span>최적 배분 대상 주문 선택 ({selectedOrderIds.length}/{orders.length}개 선택):</span>
            </label>

            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold cursor-pointer"
            >
              {selectedOrderIds.length === orders.length ? (
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
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {orders.map((o) => {
              const isSelected = selectedOrderIds.includes(o.order_id);
              return (
                <button
                  key={o.order_id}
                  type="button"
                  onClick={() => toggleOrderSelection(o.order_id)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/80 border-blue-500 text-slate-900 font-medium"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 font-mono font-bold">
                    <span>{o.order_id}</span>
                    <span className="text-[10px] text-emerald-700 font-bold">{o.qty}P</span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate">
                    {o.destination_plant} - {o.part_id}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Warnings Block */}
      {result && result.warnings && result.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1 font-medium">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>최적화 유의사항 및 경고:</span>
          </div>
          {result.warnings.map((w, idx) => (
            <div key={idx} className="pl-6">• {w}</div>
          ))}
        </div>
      )}

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Header Metric Cards */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Solver 상태:</span>
                    <span
                      className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-wider border ${
                        result.status === "OPTIMAL"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                          : result.status === "FEASIBLE"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-red-100 text-red-800 border-red-200"
                      }`}
                    >
                      {result.status}
                    </span>

                    <span className="text-[11px] px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono font-medium">
                      정책: {result.objective_mode}
                    </span>

                    {result.objective_mode === "DELAY_THEN_COST" && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-mono font-medium">
                        Stage 1: {result.stage1_status || "N/A"} | Stage 2: {result.stage2_status || "N/A"}
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      ({result.solve_time_ms} ms 계산)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    OR-Tools CP-SAT 다주문 혼합 최적 배분 결과 ({result.objective_mode === "DELAY_THEN_COST" ? "납기 우선 사전식 최적화" : "종합 비용 최소화"})
                  </h3>
                </div>
              </div>
            </div>

            {/* Cost Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider">
                  총 의사결정 비용
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-blue-900 mt-1">
                  ${result.total_decision_cost.toLocaleString()}
                </span>
              </div>

              {result.secondary_transport_cost !== undefined && result.secondary_transport_cost !== null && (
                <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200 flex flex-col justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-purple-800 tracking-wider">
                    순수 운송비(변동+고정)
                  </span>
                  <span className="text-base sm:text-lg font-black font-mono text-purple-900 mt-1">
                    ${result.secondary_transport_cost.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  변동 운송비
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-1">
                  ${result.total_variable_transport_cost.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  고정 발주비
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-1">
                  ${result.total_fixed_cost.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider">
                  총 지연 패널티
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-amber-800 mt-1">
                  ${result.total_delay_penalty.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                  총 지연 Pallet·일
                </span>
                <span className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-1">
                  {result.total_delay_pallet_days} P·일
                  {result.best_delay_pallet_days !== undefined && result.best_delay_pallet_days !== null && (
                    <span className="block text-[10px] font-normal text-purple-700">
                      (최상위 최소지연: {result.best_delay_pallet_days}P·일)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Shared Capacity Usage Gauges */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>공용 수송 용량 및 공장별 재고 이동 한도 소진 현황</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Alternative Plan Gauge */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-semibold text-slate-700">
                    대체 운송계획 (ALTERNATIVE_PLAN)
                  </span>
                  <span className="font-mono text-emerald-700 font-bold">
                    {result.alternative_plan_usage.used_qty} / {result.alternative_plan_usage.total_capacity} pallet
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (result.alternative_plan_usage.used_qty /
                          result.alternative_plan_usage.total_capacity) *
                          100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Emergency Air Gauge */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex justify-between items-center text-xs mb-2">
                  <span className="font-semibold text-slate-700">
                    긴급 항공 수송 (AIR)
                  </span>
                  <span className="font-mono text-sky-700 font-bold">
                    {result.air_usage.used_qty} / {result.air_usage.total_capacity} pallet
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (result.air_usage.used_qty / result.air_usage.total_capacity) *
                          100
                      )}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Stock Transfer Usage Summary */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                <span className="font-semibold text-slate-700 block mb-1">
                  공장 재고 이동 (STOCK_TRANSFER):
                </span>
                {result.stock_transfer_usages.map((st) => (
                  <div key={`${st.destination_plant}-${st.part_id}`} className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-mono">
                      {st.destination_plant} [{st.part_id}]
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      {st.used_qty} / {st.transferable_qty} pallet
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Allocation Matrix Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <span>주문별·대안별 최적 Pallet 물량 배분 명세표</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3 font-semibold">주문 ID</th>
                    <th className="py-2.5 px-3 font-semibold">목적 공장</th>
                    <th className="py-2.5 px-3 font-semibold">부품 ID</th>
                    <th className="py-2.5 px-3 font-semibold">배정 대안</th>
                    <th className="py-2.5 px-3 font-semibold text-right">배정 물량</th>
                    <th className="py-2.5 px-3 font-semibold text-center">도착일</th>
                    <th className="py-2.5 px-3 font-semibold text-center">지연 일수</th>
                    <th className="py-2.5 px-3 font-semibold text-right">변동 운송비</th>
                    <th className="py-2.5 px-3 font-semibold text-right">지연 패널티</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {result.allocations.map((item, idx) => (
                    <tr key={`${item.order_id}-${item.option_id}-${idx}`} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                        {item.order_id}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.destination_plant}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{item.part_id}</td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            item.option_id === "WAIT"
                              ? "bg-slate-100 text-slate-700 border border-slate-200"
                              : item.option_id === "ALTERNATIVE_PLAN"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : item.option_id === "STOCK_TRANSFER"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-sky-50 text-sky-800 border border-sky-200"
                          }`}
                        >
                          {item.option_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                        {item.allocated_qty} pallet
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">Day {item.arrival_day}</td>
                      <td
                        className={`py-2.5 px-3 text-center font-mono font-bold ${
                          item.delay_days > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {item.delay_days}일
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        ${item.variable_transport_cost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700 font-semibold">
                        ${item.delay_penalty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* On-demand AI Explanation */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Mixed 최적 배분 결과 해설</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    필요할 때만 AI가 최적 배분과 용량·비용·지연 trade-off를 설명합니다.
                  </p>
                </div>
              </div>

              {!aiExplanation && (
                <button
                  type="button"
                  onClick={handleGenerateAiExplanation}
                  disabled={loading || aiExplanationLoading}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {aiExplanationLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{aiExplanationLoading ? "AI 해설 생성 중..." : "AI 결과 해설 생성"}</span>
                </button>
              )}
            </div>

            {aiExplanation && (
              <div className="mt-4 text-xs text-slate-700 bg-purple-50/50 p-4 rounded-xl border border-purple-200 leading-relaxed font-sans">
                <div className="mb-2 text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                  AI 해설 생성 완료
                </div>
                <p>{aiExplanation}</p>
              </div>
            )}

            {aiExplanationError && (
              <p className="mt-3 text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
                AI 해설 생성 실패: {aiExplanationError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
