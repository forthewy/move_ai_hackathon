from .schemas import ExplainRequest
from .gemini_service import generate_text_with_gemini

def explain_result(req: ExplainRequest) -> str:
    prompt = f"""
다음 {req.mode} 계산 결과를 물류 담당자가 빠르게 검토할 수 있도록 한국어로 설명하라.
- 제공된 계산 결과에 있는 사실과 숫자만 사용하고, 새로운 수치나 전제는 만들지 않는다.
- 추천 또는 배분 결과와 그 이유, 비용·지연의 핵심 trade-off를 3~5문장으로 설명한다.
- 최종 실행에는 담당자의 검토가 필요하다는 점을 마지막에 짧게 밝힌다.

계산 결과:
{req.data}
""".strip()
    out = generate_text_with_gemini(prompt)
    if out:
        return out
    
    if req.mode == "pure":
        return "선택한 주문의 단일 대안 비교 결과, 지연 패널티와 운송 고정비의 트레이드오프에 따라 최저 총 의사결정 비용 대안이 추천되었습니다."
    else:
        return "전체 주문에 대해 OR-Tools CP-SAT 최적화 모델이 항공 및 공장별 재고 이동 용량 한도 내에서 총 의사결정 비용을 최소화하는 물량을 배분했습니다."
