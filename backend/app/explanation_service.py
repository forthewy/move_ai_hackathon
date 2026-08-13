from typing import Dict, Any
from .schemas import ExplainRequest
from .gemini_service import generate_text_with_gemini

def explain_result(req: ExplainRequest) -> str:
    prompt = f"다음 {req.mode} 계산 결과를 바탕으로 담당자를 위한 정밀 분석 보고서 및 선택 사유 요약을 작성하라:\n{req.data}"
    out = generate_text_with_gemini(prompt)
    if out:
        return out
    
    if req.mode == "pure":
        return "선택한 주문의 단일 대안 비교 결과, 지연 패널티와 운송 고정비의 트레이드오프에 따라 최저 총 의사결정 비용 대안이 추천되었습니다."
    else:
        return "전체 주문에 대해 OR-Tools CP-SAT 최적화 모델이 항공 및 공장별 재고 이동 용량 한도 내에서 총 의사결정 비용을 최소화하는 물량을 배분했습니다."
