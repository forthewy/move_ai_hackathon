import {
  OrderModel,
  RiskAnalyzeResponse,
  PureCompareResponse,
  MixedOptimizeRequest,
  MixedOptimizeResponse,
  NewsSearchItem,
  NewsSearchResponse,
} from "../types";

async function safeParseResponse(res: Response, fallbackErrorMsg: string): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(`${fallbackErrorMsg} (서버 응답이 비어 있습니다)`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${fallbackErrorMsg} (서버 응답 파싱 실패)`);
  }
}

export async function fetchOrders(): Promise<OrderModel[]> {
  const res = await fetch("/api/data/orders");
  const data = await safeParseResponse(res, "주문 정보를 불러오지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "주문 정보를 불러오지 못했습니다.");
  }
  return data;
}

export async function fetchOptions(): Promise<any> {
  const res = await fetch("/api/data/options");
  const data = await safeParseResponse(res, "운송 대안 정보를 불러오지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "운송 대안 정보를 불러오지 못했습니다.");
  }
  return data;
}

export async function searchNews(query: string, limit: number = 5): Promise<NewsSearchResponse> {
  const res = await fetch("/api/news/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
  });

  const data = await safeParseResponse(res, "실시간 뉴스 검색에 실패했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "실시간 뉴스 검색에 실패했습니다.");
  }
  return data;
}

export async function analyzeRisk(payload: {
  input_mode: "KEYWORD" | "ARTICLE";
  query?: string;
  article_url?: string;
  preset_level?: "LOW" | "MEDIUM" | "HIGH";
  selected_article?: NewsSearchItem;
}): Promise<RiskAnalyzeResponse> {
  const res = await fetch("/api/risk/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await safeParseResponse(res, "위험 분석을 완료하지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "위험 분석을 완료하지 못했습니다.");
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
  const data = await safeParseResponse(res, "대안 비교를 완료하지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "대안 비교를 완료하지 못했습니다.");
  }
  return data;
}

export async function optimizeMixedAllocation(
  payload: MixedOptimizeRequest
): Promise<MixedOptimizeResponse> {
  const res = await fetch("/api/mixed/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await safeParseResponse(res, "최적 배분을 완료하지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "최적 배분을 완료하지 못했습니다.");
  }
  return data;
}

export async function explainResult(payload: {
  mode: "pure" | "mixed";
  data: Record<string, unknown>;
}): Promise<string> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await safeParseResponse(res, "해설을 생성하지 못했습니다.");
  if (!res.ok || data?.error) {
    throw new Error(data?.error || data?.detail || "해설을 생성하지 못했습니다.");
  }
  if (typeof data.explanation !== "string" || !data.explanation.trim()) {
    throw new Error("생성된 해설이 비어 있습니다. 다시 시도해 주세요.");
  }
  return data.explanation;
}
