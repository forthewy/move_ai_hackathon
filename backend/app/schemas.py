from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

# Normalized Order Model
class OrderModel(BaseModel):
    order_id: str
    destination_plant: str
    part_id: str
    part_name: Optional[str] = ""
    qty: int
    required_arrival_day: int
    planned_departure_date: Optional[str] = ""
    required_arrival_date: Optional[str] = ""
    delay_penalty_per_pallet_day: int
    is_compatible: Optional[bool] = True

# Option Master Item Model
class OptionItemModel(BaseModel):
    option_id: str
    option_name: str
    passes_red_sea: bool
    arrival_day: int
    fixed_cost: int
    unit_cost_per_pallet: int
    max_qty: Optional[int] = None
    available: bool

# Inventory Item Model
class InventoryItemModel(BaseModel):
    current_stock: int
    min_safety_stock: int
    transferable_qty: int

# App Config Model
class AppConfigModel(BaseModel):
    air_total_capacity: int = 15
    alternative_plan_total_capacity: int = 50
    cost_currency: str = "USD"
    quantity_unit: str = "pallet"
    time_unit: str = "day"

# Risk Analysis Request/Response
class RiskAnalyzeRequest(BaseModel):
    query: Optional[str] = ""
    user_prompt: Optional[str] = ""
    preset_level: Optional[str] = None  # "HIGH", "MEDIUM", "LOW"

class PriorityShipment(BaseModel):
    order_id: str
    destination_plant: str
    part_id: str
    part_name: str
    qty: int
    planned_departure_date: str
    required_arrival_date: str

class RiskAnalyzeResponse(BaseModel):
    situation_summary: str
    risk_grade: str  # "LOW", "MEDIUM", "HIGH"
    priority_shipments: List[PriorityShipment]
    evidence_summary: List[str]
    uncertainty: List[str]
    preparation_actions: List[str]
    is_synthetic: bool = False

# Pure Compare Request/Response
class PureCompareRequest(BaseModel):
    order_id: str
    delay_penalty_per_pallet_day_override: Optional[int] = None

class PureOptionResult(BaseModel):
    option_id: str
    option_name: str
    available: bool
    unavailability_reason: Optional[str] = None
    arrival_day: int
    delay_days: int
    variable_transport_cost: int
    fixed_activation_cost: int
    delay_penalty: int
    decision_cost: int
    is_recommended: bool = False

class PureCompareResponse(BaseModel):
    order: OrderModel
    options_results: List[PureOptionResult]
    recommended_option_id: Optional[str] = None
    explanation: str

# Mixed Optimize Request/Response
class MixedOptimizeRequest(BaseModel):
    selected_order_ids: Optional[List[str]] = None

class AllocationItem(BaseModel):
    order_id: str
    destination_plant: str
    part_id: str
    option_id: str
    allocated_qty: int
    arrival_day: int
    delay_days: int
    variable_transport_cost: int
    delay_penalty: int

class CapacityUsage(BaseModel):
    used_qty: int
    total_capacity: int

class StockTransferUsage(BaseModel):
    destination_plant: str
    part_id: str
    used_qty: int
    transferable_qty: int

class OptionActivation(BaseModel):
    destination_plant: str
    option_id: str
    activated: bool
    fixed_cost: int

class MixedOptimizeResponse(BaseModel):
    status: str  # OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, MODEL_INVALID
    is_optimal: bool
    solve_time_ms: float
    total_variable_transport_cost: int
    total_fixed_cost: int
    total_delay_penalty: int
    total_decision_cost: int
    total_delay_pallet_days: int
    allocations: List[AllocationItem]
    alternative_plan_usage: CapacityUsage
    air_usage: CapacityUsage
    stock_transfer_usages: List[StockTransferUsage]
    option_activations: List[OptionActivation]
    facts: List[str]
    explanation: str

# General Explain Request
class ExplainRequest(BaseModel):
    mode: str  # "pure" or "mixed"
    data: Dict[str, Any]
