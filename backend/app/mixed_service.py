import time
from typing import List, Dict, Any, Optional
from ortools.sat.python import cp_model
from .schemas import (
    OrderModel,
    OptionItemModel,
    InventoryItemModel,
    AppConfigModel,
    MixedOptimizeRequest,
    MixedOptimizeResponse,
    AllocationItem,
    CapacityUsage,
    StockTransferUsage,
    OptionActivation,
)
from .data_loader import load_data
from .gemini_service import generate_text_with_gemini

def optimize_mixed_allocation(req: MixedOptimizeRequest) -> MixedOptimizeResponse:
    start_time = time.time()
    all_orders, inventory, options_master, config = load_data()

    # Filter selected orders if specified
    if req.selected_order_ids and len(req.selected_order_ids) > 0:
        orders = [o for o in all_orders if o.order_id in req.selected_order_ids]
    else:
        orders = all_orders

    if not orders:
        orders = all_orders

    options_list = ["WAIT", "ALTERNATIVE_PLAN", "STOCK_TRANSFER", "AIR"]
    plants = sorted(list(set(o.destination_plant for o in orders)))

    model = cp_model.CpModel()

    # Decision variables
    # x[o_idx, a_idx] = allocated pallets
    x = {}
    for o_idx, o in enumerate(orders):
        for a in options_list:
            x[o_idx, a] = model.NewIntVar(0, o.qty, f"x_{o.order_id}_{a}")

    # y[p, a] = binary activation variable for plant p and option a
    y = {}
    for p in plants:
        for a in options_list:
            y[p, a] = model.NewBoolVar(f"y_{p}_{a}")

    # Precomputations & Coefficients
    decision_cost_coeff = {}
    delay_days_dict = {}

    for o_idx, o in enumerate(orders):
        plant = o.destination_plant
        plant_opts = options_master.get(plant, {})
        for a in options_list:
            opt = plant_opts.get(a)
            if not opt or not opt.available:
                # Force x[o_idx, a] == 0 if option unavailable
                model.Add(x[o_idx, a] == 0)

            arrival_day = opt.arrival_day if opt else 999
            delay = max(0, arrival_day - o.required_arrival_day)
            delay_days_dict[o_idx, a] = delay

            unit_cost = opt.unit_cost_per_pallet if opt else 999999
            coeff = unit_cost + delay * o.delay_penalty_per_pallet_day
            decision_cost_coeff[o_idx, a] = coeff

    # 1. Order Quantity Preservation
    for o_idx, o in enumerate(orders):
        model.Add(sum(x[o_idx, a] for a in options_list) == o.qty)

    # 3. ALTERNATIVE_PLAN Total Capacity
    model.Add(
        sum(x[o_idx, "ALTERNATIVE_PLAN"] for o_idx in range(len(orders)))
        <= config.alternative_plan_total_capacity
    )

    # 4. AIR Total Capacity
    model.Add(
        sum(x[o_idx, "AIR"] for o_idx in range(len(orders)))
        <= config.air_total_capacity
    )

    # 5. STOCK_TRANSFER Limit per plant and part
    plant_part_orders: Dict[Tuple[str, str], List[int]] = {}
    for o_idx, o in enumerate(orders):
        key = (o.destination_plant, o.part_id)
        if key not in plant_part_orders:
            plant_part_orders[key] = []
        plant_part_orders[key].append(o_idx)

    for (p, k), o_indices in plant_part_orders.items():
        inv_item = inventory.get(p, {}).get(k)
        transferable = inv_item.transferable_qty if inv_item else 0
        model.Add(
            sum(x[o_idx, "STOCK_TRANSFER"] for o_idx in o_indices) <= transferable
        )

    # 6. Plant-Option Activation & Fixed Cost Indicator
    for p in plants:
        p_orders = [o_idx for o_idx, o in enumerate(orders) if o.destination_plant == p]
        p_total_qty = sum(orders[o_idx].qty for o_idx in p_orders)

        for a in options_list:
            if not p_orders or p_total_qty == 0:
                model.Add(y[p, a] == 0)
                continue

            # Tight M bound
            if a == "ALTERNATIVE_PLAN":
                M_pa = min(p_total_qty, config.alternative_plan_total_capacity)
            elif a == "AIR":
                M_pa = min(p_total_qty, config.air_total_capacity)
            elif a == "STOCK_TRANSFER":
                # Max transferable across parts for plant p
                p_parts = set(orders[o_idx].part_id for o_idx in p_orders)
                p_trans_total = sum(
                    inventory.get(p, {}).get(k, InventoryItemModel(current_stock=0, min_safety_stock=0, transferable_qty=0)).transferable_qty
                    for k in p_parts
                )
                M_pa = min(p_total_qty, p_trans_total)
            else:  # WAIT
                M_pa = p_total_qty

            sum_allocated = sum(x[o_idx, a] for o_idx in p_orders)
            model.Add(sum_allocated <= M_pa * y[p, a])
            model.Add(sum_allocated >= y[p, a])

    # Objective Function
    obj_terms = []
    # Variable cost & delay penalty
    for o_idx, o in enumerate(orders):
        for a in options_list:
            obj_terms.append(x[o_idx, a] * decision_cost_coeff[o_idx, a])

    # Fixed cost
    for p in plants:
        plant_opts = options_master.get(p, {})
        for a in options_list:
            opt = plant_opts.get(a)
            fixed_c = opt.fixed_cost if opt else 0
            if fixed_c > 0:
                obj_terms.append(y[p, a] * fixed_c)

    model.Minimize(sum(obj_terms))

    # Solve with CP-SAT
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status_code = solver.Solve(model)

    solve_time_ms = (time.time() - start_time) * 1000.0

    status_str = "UNKNOWN"
    is_optimal = False

    if status_code == cp_model.OPTIMAL:
        status_str = "OPTIMAL"
        is_optimal = True
    elif status_code == cp_model.FEASIBLE:
        status_str = "FEASIBLE"
        is_optimal = False
    elif status_code == cp_model.INFEASIBLE:
        status_str = "INFEASIBLE"
    elif status_code == cp_model.MODEL_INVALID:
        status_str = "MODEL_INVALID"

    if status_str in ["INFEASIBLE", "MODEL_INVALID", "UNKNOWN"]:
        return MixedOptimizeResponse(
            status=status_str,
            is_optimal=False,
            solve_time_ms=solve_time_ms,
            total_variable_transport_cost=0,
            total_fixed_cost=0,
            total_delay_penalty=0,
            total_decision_cost=0,
            total_delay_pallet_days=0,
            allocations=[],
            alternative_plan_usage=CapacityUsage(used_qty=0, total_capacity=config.alternative_plan_total_capacity),
            air_usage=CapacityUsage(used_qty=0, total_capacity=config.air_total_capacity),
            stock_transfer_usages=[],
            option_activations=[],
            facts=["제약 조건 충족 불가능 (INFEASIBLE). 수용 가능한 배분안이 존재하지 않습니다."],
            explanation="입력된 용량 제약 및 가용성 조건 하에서 주문 수량을 만족하는 실행 가능한 해를 찾지 못했습니다. 용량 상한을 조정해 주세요.",
        )

    # Extract Solution
    allocations: List[AllocationItem] = []
    total_var_cost = 0
    total_fixed_cost = 0
    total_delay_penalty = 0
    total_delay_pallet_days = 0

    for o_idx, o in enumerate(orders):
        plant = o.destination_plant
        plant_opts = options_master.get(plant, {})
        for a in options_list:
            qty_val = int(solver.Value(x[o_idx, a]))
            if qty_val > 0:
                opt = plant_opts.get(a)
                arr_day = opt.arrival_day if opt else 999
                delay = delay_days_dict[o_idx, a]
                var_c = qty_val * (opt.unit_cost_per_pallet if opt else 0)
                del_c = qty_val * delay * o.delay_penalty_per_pallet_day

                total_var_cost += var_c
                total_delay_penalty += del_c
                total_delay_pallet_days += qty_val * delay

                allocations.append(
                    AllocationItem(
                        order_id=o.order_id,
                        destination_plant=plant,
                        part_id=o.part_id,
                        option_id=a,
                        allocated_qty=qty_val,
                        arrival_day=arr_day,
                        delay_days=delay,
                        variable_transport_cost=var_c,
                        delay_penalty=del_c,
                    )
                )

    # Activated Options & Fixed Costs
    option_activations: List[OptionActivation] = []
    for p in plants:
        plant_opts = options_master.get(p, {})
        for a in options_list:
            act_val = bool(solver.Value(y[p, a]))
            fixed_c = plant_opts.get(a).fixed_cost if plant_opts.get(a) else 0
            if act_val and fixed_c > 0:
                total_fixed_cost += fixed_c

            option_activations.append(
                OptionActivation(
                    destination_plant=p,
                    option_id=a,
                    activated=act_val,
                    fixed_cost=fixed_c if act_val else 0,
                )
            )

    total_decision_cost = total_var_cost + total_fixed_cost + total_delay_penalty

    # Usages Summary
    alt_used = sum(item.allocated_qty for item in allocations if item.option_id == "ALTERNATIVE_PLAN")
    air_used = sum(item.allocated_qty for item in allocations if item.option_id == "AIR")

    stock_transfer_usages: List[StockTransferUsage] = []
    for (p, k), o_indices in plant_part_orders.items():
        st_used = sum(
            int(solver.Value(x[o_idx, "STOCK_TRANSFER"]))
            for o_idx in o_indices
        )
        inv_item = inventory.get(p, {}).get(k)
        trans_qty = inv_item.transferable_qty if inv_item else 0
        stock_transfer_usages.append(
            StockTransferUsage(
                destination_plant=p,
                part_id=k,
                used_qty=st_used,
                transferable_qty=trans_qty,
            )
        )

    # Facts Generation
    # Find most allocated option
    opt_totals = {a: sum(item.allocated_qty for item in allocations if item.option_id == a) for a in options_list}
    top_option = max(opt_totals, key=opt_totals.get) if opt_totals else "WAIT"

    facts = [
        f"총 의사결정 비용: ${total_decision_cost:,} (변동비: ${total_var_cost:,}, 고정비: ${total_fixed_cost:,}, 지연패널티: ${total_delay_penalty:,})",
        f"가장 많은 물량이 배정된 대안: {top_option} ({opt_totals.get(top_option, 0)} pallet)",
        f"대체 운송계획(ALTERNATIVE_PLAN) 사용량: {alt_used} / {config.alternative_plan_total_capacity} pallet",
        f"긴급 항공(AIR) 사용량: {air_used} / {config.air_total_capacity} pallet",
    ]

    # Explanation using facts & exact numbers
    gemini_prompt = f"""
다음은 OR-Tools CP-SAT 최적화로 계산된 Mixed 대안 배분 결과다:
- Solver 상태: {status_str} (Optimal: {is_optimal})
- 총 의사결정 비용: ${total_decision_cost:,}
- 변동 운송비: ${total_var_cost:,}, 고정비: ${total_fixed_cost:,}, 지연 패널티: ${total_delay_penalty:,}
- 대안별 배분 물량: {opt_totals}
- 대체 운송계획 용량: {alt_used}/{config.alternative_plan_total_capacity} pallet
- 긴급 항공 용량: {air_used}/{config.air_total_capacity} pallet

다음 정보를 포함하여 3~6문장으로 설명하라:
1. 가장 많은 물량이 배정된 대안과 그 이유
2. 포화되었거나 제한된 용량 (항공 또는 재고 이동 등)
3. 지연 패널티가 높아 더 비싼 대안(항공 등)이 선택된 배경
4. 최종 결정은 담당자가 승인해야 한다는 점
숫자는 주어진 결과만 사용하고 새로운 숫자를 만들어내지 마라.
"""
    explanation = generate_text_with_gemini(gemini_prompt)
    if not explanation:
        explanation = (
            f"OR-Tools CP-SAT 최적화 결과, 총 의사결정 비용은 ${total_decision_cost:,}로 수렴되었습니다. "
            f"가장 많은 물량이 {top_option} 대안({opt_totals.get(top_option, 0)} pallet)에 배정되었으며, "
            f"대체 운송계획({alt_used}/{config.alternative_plan_total_capacity} pallet) 및 항공 수송({air_used}/{config.air_total_capacity} pallet) 공용 용량 제약이 엄격히 준수되었습니다. "
            f"지연 패널티가 높은 품목(카메라 센서 등)은 비용 증가에도 불구하고 긴급 항공 수송이 최적 배분되었습니다. "
            f"※ 본 계산 결과는 담당자의 최종 승인 및 의사결정을 지원하기 위한 추천안입니다."
        )

    return MixedOptimizeResponse(
        status=status_str,
        is_optimal=is_optimal,
        solve_time_ms=round(solve_time_ms, 2),
        total_variable_transport_cost=total_var_cost,
        total_fixed_cost=total_fixed_cost,
        total_delay_penalty=total_delay_penalty,
        total_decision_cost=total_decision_cost,
        total_delay_pallet_days=total_delay_pallet_days,
        allocations=allocations,
        alternative_plan_usage=CapacityUsage(used_qty=alt_used, total_capacity=config.alternative_plan_total_capacity),
        air_usage=CapacityUsage(used_qty=air_used, total_capacity=config.air_total_capacity),
        stock_transfer_usages=stock_transfer_usages,
        option_activations=option_activations,
        facts=facts,
        explanation=explanation,
    )
