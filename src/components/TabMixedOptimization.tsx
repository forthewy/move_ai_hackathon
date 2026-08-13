import React, { useState, useEffect } from "react";
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
import { fetchOrders, optimizeMixedAllocation } from "../api/client";

export function TabMixedOptimization() {
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [result, setResult] = useState<MixedOptimizeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [disruptionOccurred, setDisruptionOccurred] = useState<boolean>(true);

  useEffect(() => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
        setSelectedOrderIds(data.map((o) => o.order_id));
      })
      .catch((err) => setError("주문 목록을 불러오지 못했습니다: " + err.message));
  }, []);

  const handleRunOptimization = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await optimizeMixedAllocation({
        selected_order_ids: selectedOrderIds.length > 0 ? selectedOrderIds : undefined,
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

        {/* Disruption Status Toggle */}
        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mt-4">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>홍해·수에즈 물류 차질 발생 상태 (Disruption):</span>
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
            {disruptionOccurred ? "🔴 차질 발생 (지연 12일 가산 상태)" : "🟢 정상 통항 (정상 소요일 기준 최적화)"}
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">CP-SAT Solver 상태:</span>
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
                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                      ({result.solve_time_ms} ms 계산)
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    OR-Tools CP-SAT 다주문 혼합 최적 배분 결과
                  </h3>
                </div>
              </div>
            </div>

            {/* Cost Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 flex flex-col justify-between">
                <span className="text-[10px] font-extrabold uppercase text-blue-800 tracking-wider">
                  총 의사결정 비용
                </span>
                <span className="text-base sm:text-lg font-black font-mono text-blue-900 mt-1">
                  ${result.total_decision_cost.toLocaleString()}
                </span>
              </div>

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

          {/* Gemini Fact-based Narrative Explanation Box */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold text-slate-900">
                Gemini Mixed 최적 배분 리포트 및 담당자 승인 안내
              </h3>
              <span className="text-[10px] text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded font-medium">
                🟣 AI 수치 해석
              </span>
            </div>
            <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200/80 leading-relaxed font-sans">
              {result.explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
