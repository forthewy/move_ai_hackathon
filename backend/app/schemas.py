from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field, model_validator
from urllib.parse import urlparse

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
    baseline_arrival_day: Optional[int] = 30
    disruption_delay: Optional[int] = 0

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

RiskGrade = Literal["LOW", "MEDIUM", "HIGH"]
ShippingRelevance = Literal["DIRECT", "INDIRECT", "NONE"]
RiskInputMode = Literal["KEYWORD", "ARTICLE"]


class GeminiRiskAnalysis(BaseModel):
    """Gemini가 기사 또는 상황 문장에서 직접 생성하는 구조화 분석 결과."""

    shipping_relevance: ShippingRelevance = Field(
        description=(
            "홍해·수에즈 상업 해운과의 관련성. 직접적인 상선 위협·공격·운영 변경은 DIRECT, "
            "지역 긴장처럼 간접 영향만 있으면 INDIRECT, 무관하면 NONE."
        )
    )
    event_type: str = Field(
        description="입력에서 식별한 사건 유형을 짧은 영문 대문자 코드로 표현. 예: MARITIME_ATTACK_WARNING"
    )
    risk_grade: RiskGrade = Field(
        description="제공된 입력의 증거만 근거로 판정한 홍해·수에즈 해상운송 위험등급"
    )
    situation_summary: str = Field(
        description="물류 담당자가 바로 이해할 수 있는 한국어 상황 요약 2~4문장"
    )
    analysis_explanation: str = Field(
        description="왜 해당 위험등급으로 판단했는지 증거의 직접성과 미확정 사항을 연결한 한국어 설명"
    )
    commercial_shipping_threat: bool = Field(
        description="상선 또는 상업 해운에 대한 직접적인 위협·공격 경고가 입력에 명시됐는지"
    )
    actual_commercial_ship_attack: bool = Field(
        description="상선을 대상으로 한 실제 공격 또는 공격 시도가 입력에 명시됐는지"
    )
    carrier_operation_change: bool = Field(
        description="선사의 운항 중단·우회·서비스 변경이 입력에 공식적으로 명시됐는지"
    )
    official_transit_restriction: bool = Field(
        description="정부·군·운하 당국 등의 공식 통항 제한 또는 폐쇄 조치가 입력에 명시됐는지"
    )
    evidence_summary: List[str] = Field(
        description="위험등급을 뒷받침하는 핵심 근거를 한국어로 요약한 목록"
    )
    evidence_spans: List[str] = Field(
        description="입력 원문에서 그대로 가져온 짧은 근거 구절. 직접 인용할 구절이 없으면 빈 목록"
    )
    uncertainty: List[str] = Field(
        description="입력만으로 확인할 수 없는 내용. 발생확률·지속기간·종료일을 임의 생성하지 않음"
    )
    preparation_actions: List[str] = Field(
        description="자동 변경이 아닌 사전 확인·문의·견적 확보 중심의 준비 행동"
    )


class NewsSearchItemSchema(BaseModel):
    title: str
    link: str
    snippet: str
    pub_date: str
    source_name: str


class NewsSearchRequest(BaseModel):
    query: str = Field(..., max_length=1000)
    limit: Optional[int] = 5


class NewsSearchResponse(BaseModel):
    query: str
    articles: List[NewsSearchItemSchema]


# Risk Analysis Request/Response
class RiskAnalyzeRequest(BaseModel):
    input_mode: RiskInputMode = "KEYWORD"
    query: Optional[str] = Field(default="", max_length=3000)
    article_url: Optional[str] = Field(default="", max_length=2048)
    preset_level: Optional[RiskGrade] = None
    selected_article: Optional[NewsSearchItemSchema] = None

    @model_validator(mode="after")
    def validate_analysis_input(self):
        if self.preset_level or self.selected_article:
            return self

        if self.input_mode == "ARTICLE":
            article_url = (self.article_url or "").strip()
            parsed = urlparse(article_url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                raise ValueError("기사 URL 입력 모드에서는 올바른 http 또는 https URL이 필요합니다.")

        if self.input_mode == "KEYWORD" and not (self.query or "").strip():
            raise ValueError("키워드·상황 입력 모드에서는 query가 필요합니다.")

        return self


class PriorityShipment(BaseModel):
    order_id: str
    destination_plant: str
    part_id: str
    part_name: str
    qty: int
    planned_departure_date: str
    required_arrival_date: str


class RiskAnalyzeResponse(BaseModel):
    input_mode: Literal["KEYWORD", "ARTICLE", "PRESET"]
    situation_summary: str
    analysis_explanation: str
    risk_grade: RiskGrade
    shipping_relevance: ShippingRelevance
    event_type: str
    commercial_shipping_threat: bool
    actual_commercial_ship_attack: bool
    carrier_operation_change: bool
    official_transit_restriction: bool
    priority_shipments: List[PriorityShipment]
    evidence_summary: List[str]
    evidence_spans: List[str]
    uncertainty: List[str]
    preparation_actions: List[str]
    is_synthetic: bool = False

# Pure Compare Request/Response
class PureCompareRequest(BaseModel):
    order_id: str
    delay_penalty_per_pallet_day_override: Optional[int] = None
    disruption_occurred: bool = True

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
    disruption_occurred: bool = True
    objective_mode: Literal["TOTAL_DECISION_COST", "DELAY_THEN_COST"] = "TOTAL_DECISION_COST"

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
    status: str  # OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, MODEL_INVALID, INVALID_ORDER_ID
    is_optimal: bool
    solve_time_ms: float
    objective_mode: str = "TOTAL_DECISION_COST"
    stage1_status: Optional[str] = None
    stage2_status: Optional[str] = None
    best_delay_pallet_days: Optional[int] = None
    secondary_transport_cost: Optional[int] = None
    warnings: List[str] = Field(default_factory=list)
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
    error: Optional[str] = None

# General Explain Request
class ExplainRequest(BaseModel):
    mode: str  # "pure" or "mixed"
    data: Dict[str, Any]
