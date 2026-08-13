from typing import List, Dict, Optional, Tuple
from .schemas import (
    OrderModel,
    OptionItemModel,
    InventoryItemModel,
    AppConfigModel,
    PureCompareRequest,
    PureCompareResponse,
    PureOptionResult,
)
from .data_loader import load_data
from .gemini_service import generate_text_with_gemini

def compare_pure_options(req: PureCompareRequest) -> PureCompareResponse:
    orders, inventory, options_master, config = load_data()

    # Find target order
    order = next((o for o in orders if o.order_id == req.order_id), None)
    if not order:
        # Fallback to first order if not found
        order = orders[0]

    # Apply override for delay penalty per pallet day if specified
    delay_penalty = (
        req.delay_penalty_per_pallet_day_override
        if req.delay_penalty_per_pallet_day_override is not None
        else order.delay_penalty_per_pallet_day
    )

    plant = order.destination_plant
    part_id = order.part_id
    plant_options = options_master.get(plant, {})
    plant_inv = inventory.get(plant, {}).get(part_id)
    transferable_qty = plant_inv.transferable_qty if plant_inv else 0

    results: List[PureOptionResult] = []
    
    # 4 options: WAIT, ALTERNATIVE_PLAN, STOCK_TRANSFER, AIR
    OPTION_ORDER = ["WAIT", "ALTERNATIVE_PLAN", "STOCK_TRANSFER", "AIR"]

    for opt_id in OPTION_ORDER:
        opt = plant_options.get(opt_id)
        if not opt:
            continue

        is_avail = opt.available
        unavail_reason = None

        # Capacity checks for Pure single-order allocation
        if opt_id == "ALTERNATIVE_PLAN":
            limit = min(opt.max_qty if opt.max_qty is not None else 999, config.alternative_plan_total_capacity)
            if order.qty > limit:
                is_avail = False
                unavail_reason = f"주문 물량({order.qty} pallet)이 대안 용량 한도({limit} pallet) 초과"
        elif opt_id == "AIR":
            limit = min(opt.max_qty if opt.max_qty is not None else 999, config.air_total_capacity)
            if order.qty > limit:
                is_avail = False
                unavail_reason = f"주문 물량({order.qty} pallet)이 항공 총 용량 한도({limit} pallet) 초과"
        elif opt_id == "STOCK_TRANSFER":
            if order.qty > transferable_qty:
                is_avail = False
                unavail_reason = f"주문 물량({order.qty} pallet)이 해당 공장·품목 재고 이동 가능량({transferable_qty} pallet) 초과"

        if not opt.available and not unavail_reason:
            unavail_reason = "대안 마스터 설정상 비가용 상태"

        arrival_day = opt.arrival_day
        delay_days = max(0, arrival_day - order.required_arrival_day)
        var_cost = order.qty * opt.unit_cost_per_pallet
        fixed_cost = opt.fixed_cost
        delay_pen_cost = order.qty * delay_days * delay_penalty
        decision_cost = var_cost + fixed_cost + delay_pen_cost

        results.append(
            PureOptionResult(
                option_id=opt_id,
                option_name=opt.option_name,
                available=is_avail,
                unavailability_reason=unavail_reason,
                arrival_day=arrival_day,
                delay_days=delay_days,
                variable_transport_cost=var_cost,
                fixed_activation_cost=fixed_cost,
                delay_penalty=delay_pen_cost,
                decision_cost=decision_cost,
                is_recommended=False,
            )
        )

    # Find minimum decision cost among AVAILABLE options
    available_results = [r for r in results if r.available]
    recommended_id = None
    if available_results:
        min_opt = min(available_results, key=lambda x: x.decision_cost)
        recommended_id = min_opt.option_id
        for r in results:
            if r.option_id == recommended_id:
                r.is_recommended = True

    # Generate Gemini or template explanation
    rec_opt = next((r for r in results if r.is_recommended), None)
    if rec_opt:
        prompt = f"""
주문 {order.order_id} ({order.destination_plant}, 물량 {order.qty} pallet, 일일 지연패널티 ${delay_penalty}/pallet·day)의 Pure 대안 비교 결과:
- 추천 대안: {rec_opt.option_name} (총 의사결정 비용 ${rec_opt.decision_cost:,})
- 지연일수: {rec_opt.delay_days}일, 변동 운송비: ${rec_opt.variable_transport_cost:,}, 고정비: ${rec_opt.fixed_activation_cost:,}, 지연 패널티: ${rec_opt.delay_penalty:,}

지연 패널티 변동에 따른 추천 대안 선정 이유 및 비용 트레이드오프를 2~4문장으로 명확히 설명하라. 숫자는 주어진 결과만 사용하라.
"""
        explanation = generate_text_with_gemini(prompt)
        if not explanation:
            explanation = (
                f"일일 지연 패널티 ${delay_penalty}/pallet·day 적용 시, {rec_opt.option_name} 대안이 "
                f"총 의사결정 비용 ${rec_opt.decision_cost:,}로 가장 경제적입니다. "
                f"지연일수({rec_opt.delay_days}일)에 따른 패널티와 운송비 및 고정비의 합산 비용 트레이드오프를 반영한 결과입니다."
            )
    else:
        explanation = "수용 가능한 대안이 없습니다."

    # Return updated order model with delay penalty override if provided
    updated_order = order.model_copy()
    updated_order.delay_penalty_per_pallet_day = delay_penalty

    return PureCompareResponse(
        order=updated_order,
        options_results=results,
        recommended_option_id=recommended_id,
        explanation=explanation,
    )
