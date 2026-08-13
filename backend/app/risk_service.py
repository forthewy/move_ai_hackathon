from typing import List

from .schemas import (
    GeminiRiskAnalysis,
    OrderModel,
    PriorityShipment,
    RiskAnalyzeRequest,
    RiskAnalyzeResponse,
)
from .data_loader import load_data, load_synthetic_news
from .gemini_service import generate_structured_with_gemini


RISK_SYSTEM_INSTRUCTION = """
너는 자동차 KD 부품을 해외 생산공장으로 운송하는 물류 담당자를 지원하는 해상운송 위험 분석가다.
분석 대상 회랑은 홍해·수에즈로 고정되어 있다. 제공된 기사 또는 키워드·상황 문장만 근거로 판단하고,
검색하지 않은 외부 사실, 사건 발생확률, 차질 지속기간, 종료일, 재고 커버리지, 생산중단비용을 만들어내지 마라.

위험등급은 다음 의미를 따른다.
- LOW: 일반적인 지정학적 긴장 또는 간접 신호만 있고, 상선 운항에 대한 직접 위협·공격·운영 변경이 입력에 없다.
- MEDIUM: 상선 공격 경고, 직접 위협, 선사 운항 중단 검토처럼 차질 가능성이 구체화됐지만 실제 공격 또는 공식 운영 변경은 확인되지 않았다.
- HIGH: 실제 상선 공격 또는 공격 시도, 주요 선사의 공식 운항 중단·우회, 공식 통항 제한처럼 상업 운송에 직접적인 사건이나 운영 변경이 입력에 확인된다.

판정 원칙:
1. 단순히 '전쟁', '공격', '홍해'라는 단어가 있다는 이유만으로 HIGH를 선택하지 마라.
2. 공격 '경고'나 '위협'만 있고 실제 공격 또는 운영 변경이 없다면 MEDIUM을 우선 검토하라.
3. 홍해·수에즈 상업 해운과 무관한 입력은 shipping_relevance=NONE, risk_grade=LOW로 판정하라.
4. evidence_spans에는 제공된 입력에서 그대로 가져온 짧은 구절만 넣어라. 원문 구절이 없으면 빈 목록으로 반환하라.
5. preparation_actions는 선사 문의, 요구 도착일 확인, 대체 운송 견적 확보, 긴급 수송 필요 여부 확인 등 준비 행동으로 한정하고 자동 운송 변경을 지시하지 마라.
6. 모든 설명은 한국어로 작성하되 event_type은 짧은 영문 대문자 코드로 반환하라.
""".strip()


def sort_shipments_by_priority(orders: List[OrderModel]) -> List[PriorityShipment]:
    # Sort order:
    # 1. planned_departure_date ascending
    # 2. required_arrival_date ascending
    sorted_orders = sorted(
        orders,
        key=lambda x: (
            x.planned_departure_date or "9999-12-31",
            x.required_arrival_date or "9999-12-31",
            x.order_id,
        ),
    )

    return [
        PriorityShipment(
            order_id=o.order_id,
            destination_plant=o.destination_plant,
            part_id=o.part_id,
            part_name=o.part_name or o.part_id,
            qty=o.qty,
            planned_departure_date=o.planned_departure_date or "2026-08-15",
            required_arrival_date=o.required_arrival_date or "2026-09-14",
        )
        for o in sorted_orders
    ]


def _build_manual_prompt(req: RiskAnalyzeRequest) -> str:
    if req.input_mode == "ARTICLE":
        return f"""
[입력 유형]
기사 본문 직접 입력

[기사 제목]
{(req.article_title or '').strip() or '(제목 미입력)'}

[기사 본문]
{(req.article_body or '').strip()}

위 입력을 직접 읽고 홍해·수에즈 상업 해운에 대한 관련성과 위험등급을 판단하라.
기사에 쓰이지 않은 사실은 보완하지 말고, 근거 문구와 불확실성을 명확히 구분하라.
""".strip()

    return f"""
[입력 유형]
키워드·상황 문장

[입력 내용]
{(req.query or '').strip()}

이 입력은 기사 원문이 아닐 수 있다. 입력에 명시된 내용만 분석하고 실제 뉴스 검색을 수행했다고 주장하지 마라.
정보가 부족하면 그 한계를 uncertainty에 명시하라.
""".strip()


def _build_synthetic_response(
    preset_level: str,
    priority_shipments: List[PriorityShipment],
) -> RiskAnalyzeResponse:
    synthetic_data = load_synthetic_news()
    synth_info = synthetic_data.get(preset_level, synthetic_data.get("HIGH", {}))

    if preset_level == "HIGH":
        event_type = "SYNTHETIC_CONFIRMED_DISRUPTION"
        commercial_shipping_threat = True
        actual_commercial_ship_attack = True
        carrier_operation_change = True
        official_transit_restriction = False
    elif preset_level == "MEDIUM":
        event_type = "SYNTHETIC_MARITIME_WARNING"
        commercial_shipping_threat = True
        actual_commercial_ship_attack = False
        carrier_operation_change = False
        official_transit_restriction = False
    else:
        event_type = "SYNTHETIC_REGIONAL_TENSION"
        commercial_shipping_threat = False
        actual_commercial_ship_attack = False
        carrier_operation_change = False
        official_transit_restriction = False

    return RiskAnalyzeResponse(
        input_mode="PRESET",
        situation_summary=synth_info.get(
            "situation_summary", "홍해 해역 및 수에즈 항로 운송 위험 합성 시나리오"
        ),
        analysis_explanation=(
            "선택한 팀 합성 시나리오에 저장된 위험등급과 근거를 표시했습니다. "
            "실제 기사 분석 결과가 아니며 Gemini 호출 없이 데모 fallback으로 사용됩니다."
        ),
        risk_grade=synth_info.get("risk_grade", preset_level),
        shipping_relevance="DIRECT" if preset_level in {"HIGH", "MEDIUM"} else "INDIRECT",
        event_type=event_type,
        commercial_shipping_threat=commercial_shipping_threat,
        actual_commercial_ship_attack=actual_commercial_ship_attack,
        carrier_operation_change=carrier_operation_change,
        official_transit_restriction=official_transit_restriction,
        priority_shipments=priority_shipments,
        evidence_summary=synth_info.get("evidence_summary", []),
        evidence_spans=[],
        uncertainty=synth_info.get("uncertainty", []),
        preparation_actions=synth_info.get("preparation_actions", []),
        is_synthetic=True,
    )


def analyze_risk(req: RiskAnalyzeRequest) -> RiskAnalyzeResponse:
    orders, _, _, _ = load_data()
    all_priority_shipments = sort_shipments_by_priority(orders)

    # 합성 프리셋은 기존 데이터를 그대로 유지하며 Gemini 없이 실행한다.
    if req.preset_level:
        return _build_synthetic_response(req.preset_level, all_priority_shipments)

    # 실제 키워드·상황 또는 기사 본문은 Gemini가 직접 읽고 구조화된 결과를 생성한다.
    analysis = generate_structured_with_gemini(
        prompt=_build_manual_prompt(req),
        response_model=GeminiRiskAnalysis,
        system_instruction=RISK_SYSTEM_INSTRUCTION,
    )

    # 홍해·수에즈 해운과 무관한 입력에는 우선 점검 화물을 제시하지 않는다.
    priority_shipments = (
        [] if analysis.shipping_relevance == "NONE" else all_priority_shipments
    )

    return RiskAnalyzeResponse(
        input_mode=req.input_mode,
        situation_summary=analysis.situation_summary,
        analysis_explanation=analysis.analysis_explanation,
        risk_grade=analysis.risk_grade,
        shipping_relevance=analysis.shipping_relevance,
        event_type=analysis.event_type,
        commercial_shipping_threat=analysis.commercial_shipping_threat,
        actual_commercial_ship_attack=analysis.actual_commercial_ship_attack,
        carrier_operation_change=analysis.carrier_operation_change,
        official_transit_restriction=analysis.official_transit_restriction,
        priority_shipments=priority_shipments,
        evidence_summary=analysis.evidence_summary,
        evidence_spans=analysis.evidence_spans,
        uncertainty=analysis.uncertainty,
        preparation_actions=analysis.preparation_actions,
        is_synthetic=False,
    )
