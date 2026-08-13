import {
  OrderModel,
  RiskAnalyzeResponse,
  PureCompareResponse,
  MixedOptimizeResponse,
} from "../types";

export async function fetchOrders(): Promise<OrderModel[]> {
  const res = await fetch("/api/data/orders");
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function fetchOptions(): Promise<any> {
  const res = await fetch("/api/data/options");
  if (!res.ok) throw new Error("Failed to fetch options master");
  return res.json();
}

export async function analyzeRisk(payload: {
  query?: string;
  user_prompt?: string;
  preset_level?: string;
}): Promise<RiskAnalyzeResponse> {
  const res = await fetch("/api/risk/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to analyze risk");
  return res.json();
}

export async function comparePureOptions(payload: {
  order_id: string;
  delay_penalty_per_pallet_day_override?: number;
}): Promise<PureCompareResponse> {
  const res = await fetch("/api/pure/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to compare pure options");
  return res.json();
}

export async function optimizeMixedAllocation(payload: {
  selected_order_ids?: string[];
}): Promise<MixedOptimizeResponse> {
  const res = await fetch("/api/mixed/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to optimize mixed allocation");
  return res.json();
}
