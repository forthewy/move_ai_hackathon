const PLANT_NAMES: Record<string, string> = {
  HMMC_CZ: "현대자동차 체코공장",
  KASK_SK: "기아 슬로바키아공장",
};

const OPTION_NAMES: Record<string, string> = {
  WAIT: "기존 계획 유지·대기",
  ALTERNATIVE_PLAN: "대체 운송계획",
  STOCK_TRANSFER: "인근 공장 재고 이동",
  AIR: "긴급 항공 수송",
};

export function displayPlant(code: string): string {
  return PLANT_NAMES[code] ?? code;
}

export function displayOption(code: string, fallback?: string): string {
  return fallback || OPTION_NAMES[code] || code;
}

export function formatUsd(value: number): string {
  return `USD ${value.toLocaleString()}`;
}

export function formatPallets(value: number): string {
  return `${value.toLocaleString()} 팔레트`;
}

export function displayObjective(
  mode: "TOTAL_DECISION_COST" | "DELAY_THEN_COST"
): string {
  return mode === "DELAY_THEN_COST"
    ? "납기 우선 후 비용 최소화"
    : "비용·지연 종합 최소화";
}
