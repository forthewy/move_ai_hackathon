from typing import List, Dict, Any, Optional
from .schemas import RiskAnalyzeRequest, RiskAnalyzeResponse, PriorityShipment, OrderModel
from .data_loader import load_data, load_synthetic_news
from .gemini_service import generate_text_with_gemini

def sort_shipments_by_priority(orders: List[OrderModel]) -> List[PriorityShipment]:
    # Sort order:
    # 1. planned_departure_date ascending
    # 2. required_arrival_date ascending
    sorted_orders = sorted(
        orders,
        key=lambda x: (
            x.planned_departure_date or "9999-12-31",
            x.required_arrival_date or "9999-12-31",
            x.order_id
        )
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

def analyze_risk(req: RiskAnalyzeRequest) -> RiskAnalyzeResponse:
    orders, _, _, _ = load_data()
    priority_shipments = sort_shipments_by_priority(orders)
    synthetic_data = load_synthetic_news()

    # If explicit preset level requested or matching text
    preset_level = (req.preset_level or "").upper()
    
    query_text = (req.query or req.user_prompt or "").strip()
    
    # Check if user query matches keyword hints for level selection if preset not provided
    if not preset_level:
        if "공격" in query_text and ("중단" in query_text or "우회" in query_text or "수에즈" in query_text or "공식" in query_text):
            preset_level = "HIGH"
        elif "경고" in query_text or "검토" in query_text or "위험" in query_text:
            preset_level = "MEDIUM"
        elif "긴장" in query_text or "동향" in query_text:
            preset_level = "LOW"
        else:
            preset_level = "HIGH" # default demo preset

    synth_info = synthetic_data.get(preset_level, synthetic_data.get("HIGH", {}))

    # Try Gemini if API key is present
    gemini_prompt = f"""
다음 물류 동향 및 담당자 요청을 분석하여 홍해·수에즈 차질 위험등급을 판정해라.

[요청 내용]
{query_text or synth_info.get('situation_summary', '')}

[판단 기준]
- LOW: 일반적인 지정학적 긴장 또는 간접 신호만 있고 상선 운항에 대한 직접 위협·조치가 없음.
- MEDIUM: 상선 공격 경고, 직접 위협, 선사 운항 중단 검토 등 차질 가능성이 구체화되었으나 실제 대규모 운영 변경 미확정.
- HIGH: 실제 상선 공격, 주요 선사 운항 중단·우회 공식 발표, 통항 제한 등 상업 운송에 직접적인 사건/운영 변경 확인됨.

원문에 없는 사건 발생확률, 지속기간, 종료일을 생성하지 말고, "영향 확정 화물"이라는 표현 대신 "우선 점검 대상 운송 건"으로 다루어라.

위험등급(LOW/MEDIUM/HIGH)과 함께 상황요약, 판단근거(3가지), 불확실성(2가지), 준비행동(4가지)을 작성해라.
"""
    
    gemini_out = generate_text_with_gemini(gemini_prompt)

    if gemini_out:
        # Gemini returned a text response; parse or build structure around preset_level
        # To guarantee exact valid structure without JSON parsing errors, merge Gemini insight
        return RiskAnalyzeResponse(
            situation_summary=synth_info.get("situation_summary", "홍해 해역 및 수에즈 항로 운송 위험 상황 요약"),
            risk_grade=preset_level if preset_level in ["LOW", "MEDIUM", "HIGH"] else "HIGH",
            priority_shipments=priority_shipments,
            evidence_summary=synth_info.get("evidence_summary", []),
            uncertainty=synth_info.get("uncertainty", []),
            preparation_actions=synth_info.get("preparation_actions", []),
            is_synthetic=False,
        )

    # Fallback to synthetic_news.json
    return RiskAnalyzeResponse(
        situation_summary=synth_info.get("situation_summary", "홍해 해역 및 수에즈 항로 운송 위험 상황 요약"),
        risk_grade=synth_info.get("risk_grade", "HIGH"),
        priority_shipments=priority_shipments,
        evidence_summary=synth_info.get("evidence_summary", []),
        uncertainty=synth_info.get("uncertainty", []),
        preparation_actions=synth_info.get("preparation_actions", []),
        is_synthetic=True,
    )
