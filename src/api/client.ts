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
  input_mode: "KEYWORD" | "ARTICLE";
  query?: string;
  article_title?: string;
  article_body?: string;
  preset_level?: "LOW" | "MEDIUM" | "HIGH";
}): Promise<RiskAnalyzeResponse> {
  const res = await fetch("/api/risk/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail || "Failed to analyze risk");
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function comparePureOptions(payload: {
  order_id: string;
  delay_penalty_per_pallet_day_override?: number;
  disruption_occurred?: boolean;
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
  disruption_occurred?: boolean;
}): Promise<MixedOptimizeResponse> {
  const res = await fetch("/api/mixed/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to optimize mixed allocation");
  return res.json();
}
