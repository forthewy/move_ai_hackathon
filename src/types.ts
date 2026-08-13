export interface OrderModel {
  order_id: string;
  destination_plant: string;
  part_id: string;
  part_name: string;
  qty: number;
  required_arrival_day: number;
  planned_departure_date: string;
  required_arrival_date: string;
  delay_penalty_per_pallet_day: number;
  is_compatible: boolean;
}

export interface PriorityShipment {
  order_id: string;
  destination_plant: string;
  part_id: string;
  part_name: string;
  qty: number;
  planned_departure_date: string;
  required_arrival_date: string;
}

export type RiskInputMode = "KEYWORD" | "ARTICLE" | "PRESET";
export type ShippingRelevance = "DIRECT" | "INDIRECT" | "NONE";

export interface NewsSearchItem {
  title: string;
  link: string;
  snippet: string;
  pub_date: string;
  source_name: string;
}

export interface NewsSearchResponse {
  query: string;
  articles: NewsSearchItem[];
}

export interface RiskAnalyzeResponse {
  input_mode: RiskInputMode;
  situation_summary: string;
  analysis_explanation: string;
  risk_grade: "LOW" | "MEDIUM" | "HIGH";
  shipping_relevance: ShippingRelevance;
  event_type: string;
  commercial_shipping_threat: boolean;
  actual_commercial_ship_attack: boolean;
  carrier_operation_change: boolean;
  official_transit_restriction: boolean;
  priority_shipments: PriorityShipment[];
  evidence_summary: string[];
  evidence_spans: string[];
  uncertainty: string[];
  preparation_actions: string[];
  is_synthetic: boolean;
}

export interface PureOptionResult {
  option_id: string;
  option_name: string;
  available: boolean;
  unavailability_reason?: string;
  arrival_day: number;
  delay_days: number;
  variable_transport_cost: number;
  fixed_activation_cost: number;
  delay_penalty: number;
  decision_cost: number;
  is_recommended: boolean;
}

export interface PureCompareResponse {
  order: OrderModel;
  options_results: PureOptionResult[];
  recommended_option_id?: string;
  explanation: string;
}

export interface AllocationItem {
  order_id: string;
  destination_plant: string;
  part_id: string;
  option_id: string;
  allocated_qty: number;
  arrival_day: number;
  delay_days: number;
  variable_transport_cost: number;
  delay_penalty: number;
}

export interface CapacityUsage {
  used_qty: number;
  total_capacity: number;
}

export interface StockTransferUsage {
  destination_plant: string;
  part_id: string;
  used_qty: number;
  transferable_qty: number;
}

export interface OptionActivation {
  destination_plant: string;
  option_id: string;
  activated: boolean;
  fixed_cost: number;
}

export interface MixedOptimizeRequest {
  selected_order_ids?: string[];
  disruption_occurred?: boolean;
  objective_mode?: "TOTAL_DECISION_COST" | "DELAY_THEN_COST";
}

export interface MixedOptimizeResponse {
  status: string;
  is_optimal: boolean;
  solve_time_ms: number;
  objective_mode: "TOTAL_DECISION_COST" | "DELAY_THEN_COST";
  stage1_status?: string | null;
  stage2_status?: string | null;
  best_delay_pallet_days?: number | null;
  secondary_transport_cost?: number | null;
  warnings?: string[];
  total_variable_transport_cost: number;
  total_fixed_cost: number;
  total_delay_penalty: number;
  total_decision_cost: number;
  total_delay_pallet_days: number;
  allocations: AllocationItem[];
  alternative_plan_usage: CapacityUsage;
  air_usage: CapacityUsage;
  stock_transfer_usages: StockTransferUsage[];
  option_activations: OptionActivation[];
  facts: string[];
  explanation: string;
  error?: string;
}