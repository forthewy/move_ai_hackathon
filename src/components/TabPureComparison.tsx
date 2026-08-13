import React, { useState, useEffect, useRef } from "react";
import {
  Layers,
  Sliders,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  Sparkles,
  Loader2,
  Calendar,
  AlertCircle,
  Database,
  Cpu,
} from "lucide-react";
import { OrderModel, PureCompareResponse } from "../types";
import { fetchOrders, comparePureOptions, explainResult } from "../api/client";

export function TabPureComparison() {
  const [orders, setOrders] = useState<OrderModel[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("ORD-CZ-01");
  const [delayPenaltyOverride, setDelayPenaltyOverride] = useState<number>(500);
  const [useOverride, setUseOverride] = useState<boolean>(false);
  const [result, setResult] = useState<PureCompareResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [disruptionOccurred, setDisruptionOccurred] = useState<boolean>(true);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState<boolean>(false);
  const [aiExplanationError, setAiExplanationError] = useState<string | null>(null);
  const explanationRequestId = useRef(0);

  // Load orders on mount
  useEffect(() => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
        if (data.length > 0) {
          setSelectedOrderId(data[0].order_id);
          setDelayPenaltyOverride(data[0].delay_penalty_per_pallet_day);
        }
      })
      .catch((err) => setError("주문 목록을 불러오지 못했습니다: " + err.message));
  }, []);

  // Update comparison whenever order or slider changes
  const runComparison = async (orderId: string, penaltyVal?: number, disruption?: boolean) => {
    explanationRequestId.current += 1;
    setAiExplanation(null);
    setAiExplanationLoading(false);
    setAiExplanationError(null);
    setLoading(true);
    setError(null);
    try {
      const res = await comparePureOptions({
        order_id: orderId,
        delay_penalty_per_pallet_day_override: useOverride ? penaltyVal : undefined,
        disruption_occurred: disruption,
      });
      setResult(res);
    } catch (err: any) {
      setError("Pure 대안 비교 계산 중 오류가 발생했습니다: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOrderId) {
      runComparison(selectedOrderId, delayPenaltyOverride, disruptionOccurred);
    }
  }, [selectedOrderId, delayPenaltyOverride, useOverride, disruptionOccurred]);

  const currentOrder = orders.find((o) => o.order_id === selectedOrderId);

  const handleGenerateAiExplanation = async () => {
    if (!result || loading || aiExplanationLoading || aiExplanation) return;

    const requestId = ++explanationRequestId.current;
    setAiExplanationLoading(true);
    setAiExplanationError(null);
    try {
      const explanation = await explainResult({
        mode: "pure",
        data: {
          order: {
            order_id: result.order.order_id,
            destination_plant: result.order.destination_plant,
            part_id: result.order.part_id,
            part_name: result.order.part_name,
            qty: result.order.qty,
            required_arrival_day: result.order.required_arrival_day,
          },
          disruption_occurred: disruptionOccurred,
          applied_delay_penalty_per_pallet_day: useOverride
            ? delayPenaltyOverride
            : result.order.delay_penalty_per_pallet_day,
          recommended_option_id: result.recommended_option_id,
          options: result.options_results.map((option) => ({
            option_id: option.option_id,
            option_name: option.option_name,
            available: option.available,
            arrival_day: option.arrival_day,
            delay_days: option.delay_days,
            variable_transport_cost: option.variable_transport_cost,
            fixed_activation_cost: option.fixed_activation_cost,
            delay_penalty: option.delay_penalty,
            decision_cost: option.decision_cost,
            is_recommended: option.is_recommended,
          })),
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
      {/* Top Configuration Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">Pure 대안 비교 조건 설정</h2>
          <span className="text-[11px] px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
            🟢 팀 합성 주문 및 대안 마스터
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Order Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              주문 선택 (Shipment Order):
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedOrderId(newId);
                const found = orders.find((o) => o.order_id === newId);
                if (found) {
                  setDelayPenaltyOverride(found.delay_penalty_per_pallet_day);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white font-mono transition-all"
            >
              {orders.map((o) => (
                <option key={o.order_id} value={o.order_id}>
                  [{o.order_id}] {o.destination_plant} - {o.part_name} ({o.qty} pallet, 기본패널티: ${o.delay_penalty_per_pallet_day}/일)
                </option>
              ))}
            </select>

            {/* Disruption Status Toggle */}
            <div className="mt-3 flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>물류 차질 발생 상태 (Disruption):</span>
              </span>
              <button
                type="button"
                onClick={() => setDisruptionOccurred(!disruptionOccurred)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  disruptionOccurred
                    ? "bg-red-100 border border-red-300 text-red-800"
                    : "bg-emerald-100 border border-emerald-300 text-emerald-800"
                }`}
              >
                {disruptionOccurred ? "🔴 차질 발생 (지연 가산)" : "🟢 정상 운송 (지연 없음)"}
              </button>
            </div>

            {currentOrder && (
              <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">목적 공장:</span>
                  <span className="font-semibold text-blue-700">{currentOrder.destination_plant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">부품명:</span>
                  <span className="font-semibold text-slate-800">{currentOrder.part_name} ({currentOrder.part_id})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">주문 물량:</span>
                  <span className="font-bold text-emerald-700 font-mono">{currentOrder.qty} pallet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">요구 도착일 / 약속일:</span>
                  <span className="font-mono text-slate-800">{currentOrder.required_arrival_date} (Day {currentOrder.required_arrival_day})</span>
                </div>
              </div>
            )}
          </div>

          {/* Delay Penalty Sensitivity Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>지연 패널티 수치 조정 (Sensitivity Control):</span>
              </label>
              <button
                type="button"
                onClick={() => setUseOverride(!useOverride)}
                className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  useOverride
                    ? "bg-amber-100 border border-amber-300 text-amber-800 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                }`}
              >
                {useOverride ? "커스텀 패널티 적용 중" : "기본 패널티 사용"}
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">지연 패널티 (1 pallet·일당):</span>
                <span className="font-mono font-black text-amber-700 text-sm">
                  ${delayPenaltyOverride.toLocaleString()} / pallet·day
                </span>
              </div>

              <input
                type="range"
                min={100}
                max={3000}
                step={50}
                value={delayPenaltyOverride}
                onChange={(e) => {
                  setDelayPenaltyOverride(Number(e.target.value));
                  setUseOverride(true);
                }}
                className="w-full accent-amber-600 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>$100 (저지연 손실)</span>
                <span>$1,500</span>
                <span>$3,000 (고지연 라인 중단 위험)</span>
              </div>

              <p className="text-[11px] text-slate-500 leading-tight">
                * 지연 패널티 슬라이더를 조정하면 지연 일수가 긴 대안(WAIT 등)의 비용이 급증하여 추천 대안이 실시간 변경됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Option Cards Grid */}
      {loading && !result && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {result.options_results.map((opt) => {
              const isRecommended = opt.is_recommended;
              return (
                <div
                  key={opt.option_id}
                  className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between relative ${
                    isRecommended
                      ? "border-2 border-emerald-500 ring-4 ring-emerald-500/10 shadow-lg shadow-emerald-500/10"
                      : opt.available
                      ? "border-slate-200 shadow-sm hover:shadow-md"
                      : "border-slate-200 opacity-60 bg-slate-50/50"
                  }`}
                >
                  {/* Recommended Badge Header */}
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-md">
                      <Award className="w-3.5 h-3.5" />
                      <span>최저 비용 추천</span>
                    </div>
                  )}

                  <div>
                    {/* Title & Availability */}
                    <div className="flex items-start justify-between gap-2 mb-3 mt-1">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 font-mono">
                          {opt.option_id}
                        </h3>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {opt.option_name}
                        </p>
                      </div>

                      {opt.available ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          실행 가능
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" />
                          실행 불가
                        </span>
                      )}
                    </div>

                    {/* Unavailability Reason */}
                    {!opt.available && opt.unavailability_reason && (
                      <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-[10px] text-red-700 font-medium">
                        ⚠️ {opt.unavailability_reason}
                      </div>
                    )}

                    {/* Arrival & Delay */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3 space-y-1 text-xs">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>도착일 (Arrival Day):</span>
                        <span className="font-mono text-slate-800 font-semibold">Day {opt.arrival_day}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">지연 일수 (Delay):</span>
                        <span
                          className={`font-mono font-bold ${
                            opt.delay_days > 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {opt.delay_days}일 지연
                        </span>
                      </div>
                    </div>

                    {/* Cost Breakdown Table */}
                    <div className="space-y-1.5 text-xs mb-4 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">변동 운송비:</span>
                        <span className="font-mono font-medium">${opt.variable_transport_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">고정 발주비:</span>
                        <span className="font-mono font-medium">${opt.fixed_activation_cost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">지연 패널티:</span>
                        <span className="font-mono font-semibold text-amber-700">
                          ${opt.delay_penalty.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Decision Cost Card Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col items-end">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      총 의사결정 비용 (Decision Cost)
                    </span>
                    <span
                      className={`text-base font-black font-mono ${
                        isRecommended ? "text-emerald-700" : "text-slate-900"
                      }`}
                    >
                      ${opt.decision_cost.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* On-demand AI Explanation */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Pure 대안 결과 해설</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    필요할 때만 AI가 계산 결과와 비용·지연 trade-off를 설명합니다.
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
