from .schemas import ExplainRequest
from .gemini_service import generate_text_with_gemini

def explain_result(req: ExplainRequest) -> str:
    prompt = f"""
다음 {req.mode} 계산 결과를 물류 담당자가 빠르게 검토할 수 있도록 한국어로 설명하라.
- 제공된 계산 결과에 있는 사실과 숫자만 사용하고, 새로운 수치나 전제는 만들지 않는다.
- 추천 또는 배분 결과와 그 이유, 비용과 지연 사이의 핵심 균형을 3~5문장으로 설명한다.
- 통화는 USD, 물량은 팔레트, 물량가중 지연은 팔레트·일로 표기한다.

계산 결과:
{req.data}
""".strip()
    out = generate_text_with_gemini(prompt)
    if out:
        return out
    
    if req.mode == "pure":
        return "선택한 주문의 단일 대안 비교 결과, 지연 패널티와 운송비의 균형을 반영해 총비용이 가장 낮은 대안이 추천되었습니다."
    else:
        return "전체 주문에 대해 항공 및 공장별 재고 이동 용량 한도 안에서 총비용을 최소화하도록 물량을 배분했습니다."
