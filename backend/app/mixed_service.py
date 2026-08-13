import time
from typing import List, Dict, Optional, Tuple, Literal
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


def effective_arrival_day(opt: Optional[OptionItemModel], disruption_occurred: bool) -> int:
    if opt is None:
        return 999
    if disruption_occurred:
        if opt.baseline_arrival_day is not None and opt.disruption_delay is not None:
            return opt.baseline_arrival_day + opt.disruption_delay
        return opt.arrival_day
    return opt.baseline_arrival_day if opt.baseline_arrival_day is not None else opt.arrival_day


def build_mixed_model(
    orders: List[OrderModel],
    inventory: Dict[str, Dict[str, InventoryItemModel]],
    options_master: Dict[str, Dict[str, OptionItemModel]],
    config: AppConfigModel,
    objective_kind: Literal["TOTAL_DECISION_COST", "STAGE1_DELAY", "STAGE2_COST"],
    fixed_delay: Optional[int] = None,
    disruption_occurred: bool = True,
):
    """
    Builds CP-SAT model, decision variables, and constraints for mixed allocation.
    objective_kind:
      - TOTAL_DECISION_COST: Minimize var_cost + fixed_cost + delay_penalty
      - STAGE1_DELAY: Minimize total_delay_pallet_days
      - STAGE2_COST: Constrain total_delay_pallet_days == fixed_delay, Minimize var_cost + fixed_cost
    """
    options_list = ["WAIT", "ALTERNATIVE_PLAN", "STOCK_TRANSFER", "AIR"]
    plants = sorted(list(set(o.destination_plant for o in orders)))

    model = cp_model.CpModel()

    # Decision variables
    # x[o_idx, a] = allocated pallets for order o_idx and option a
    x = {}
    for o_idx, o in enumerate(orders):
        for a in options_list:
            x[o_idx, a] = model.NewIntVar(0, o.qty, f"x_{o.order_id}_{a}")

    # y[p, a] = binary activation variable for plant p and option a
    y = {}
    for p in plants:
        for a in options_list:
            y[p, a] = model.NewBoolVar(f"y_{p}_{a}")

    # Precomputations
    decision_cost_coeff = {}
    unit_transport_cost_coeff = {}
    delay_days_dict = {}

    for o_idx, o in enumerate(orders):
        plant = o.destination_plant
        plant_opts = options_master.get(plant, {})
        for a in options_list:
            opt = plant_opts.get(a)
            if not opt or not opt.available:
                model.Add(x[o_idx, a] == 0)

            arrival_day = effective_arrival_day(opt, disruption_occurred)
            delay = max(0, arrival_day - o.required_arrival_day)
            delay_days_dict[o_idx, a] = delay

            unit_cost = opt.unit_cost_per_pallet if opt else 999999
            unit_transport_cost_coeff[o_idx, a] = unit_cost
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

            if a == "ALTERNATIVE_PLAN":
                M_pa = min(p_total_qty, config.alternative_plan_total_capacity)
            elif a == "AIR":
                M_pa = min(p_total_qty, config.air_total_capacity)
            elif a == "STOCK_TRANSFER":
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

    # Expression for total delay pallet-days
    total_delay_terms = [x[o_idx, a] * delay_days_dict[o_idx, a] for o_idx in range(len(orders)) for a in options_list]

    if objective_kind == "STAGE2_COST":
        if fixed_delay is not None:
            model.Add(sum(total_delay_terms) == fixed_delay)

    # Set objective
    if objective_kind == "TOTAL_DECISION_COST":
        obj_terms = []
        for o_idx, o in enumerate(orders):
            for a in options_list:
                obj_terms.append(x[o_idx, a] * decision_cost_coeff[o_idx, a])
        for p in plants:
            plant_opts = options_master.get(p, {})
            for a in options_list:
                opt = plant_opts.get(a)
                fixed_c = opt.fixed_cost if opt else 0
                if fixed_c > 0:
                    obj_terms.append(y[p, a] * fixed_c)
        model.Minimize(sum(obj_terms))

    elif objective_kind == "STAGE1_DELAY":
        model.Minimize(sum(total_delay_terms))

    elif objective_kind == "STAGE2_COST":
        # Minimize variable transport cost + fixed cost (no delay penalty in stage 2 objective)
        obj_terms = []
        for o_idx, o in enumerate(orders):
            for a in options_list:
                obj_terms.append(x[o_idx, a] * unit_transport_cost_coeff[o_idx, a])
        for p in plants:
            plant_opts = options_master.get(p, {})
            for a in options_list:
                opt = plant_opts.get(a)
                fixed_c = opt.fixed_cost if opt else 0
                if fixed_c > 0:
                    obj_terms.append(y[p, a] * fixed_c)
        model.Minimize(sum(obj_terms))

    return model, x, y, delay_days_dict, plant_part_orders, options_list, plants


def extract_solution_response(
    orders: List[OrderModel],
    inventory: Dict[str, Dict[str, InventoryItemModel]],
    options_master: Dict[str, Dict[str, OptionItemModel]],
    config: AppConfigModel,
    solver: cp_model.CpSolver,
    x: Dict,
    y: Dict,
    delay_days_dict: Dict,
    plant_part_orders: Dict,
    options_list: List[str],
    plants: List[str],
    solve_time_ms: float,
    status_str: str,
    is_optimal: bool,
    objective_mode: str,
    stage1_status: Optional[str] = None,
    stage2_status: Optional[str] = None,
    best_delay_pallet_days: Optional[int] = None,
    warnings: Optional[List[str]] = None,
    disruption_occurred: bool = True,
) -> MixedOptimizeResponse:
    if warnings is None:
        warnings = []

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
                arr_day = effective_arrival_day(opt, disruption_occurred)
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

    secondary_transport_cost = total_var_cost + total_fixed_cost
    total_decision_cost = secondary_transport_cost + total_delay_penalty

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

    opt_totals = {a: sum(item.allocated_qty for item in allocations if item.option_id == a) for a in options_list}
    top_option = max(opt_totals, key=opt_totals.get) if opt_totals else "WAIT"

    if objective_mode == "DELAY_THEN_COST":
        facts = [
            f"목적함수 정책: 납기 우선 사전식 최적화 (DELAY_THEN_COST)",
            f"1단계 최소 지연: {total_delay_pallet_days} pallet·일 (Stage 1 상태: {stage1_status})",
            f"2단계 순수 운송 비용 (변동비+고정비): ${secondary_transport_cost:,} (Stage 2 상태: {stage2_status})",
            f"비교용 지연 패널티: ${total_delay_penalty:,} (총 의사결정 비용: ${total_decision_cost:,})",
            f"대체 운송계획 사용량: {alt_used} / {config.alternative_plan_total_capacity} pallet",
            f"긴급 항공 사용량: {air_used} / {config.air_total_capacity} pallet",
        ]
    else:
        facts = [
            f"목적함수 정책: 비용·지연 종합 최소화 (TOTAL_DECISION_COST)",
            f"총 의사결정 비용: ${total_decision_cost:,} (변동비: ${total_var_cost:,}, 고정비: ${total_fixed_cost:,}, 지연패널티: ${total_delay_penalty:,})",
            f"가장 많은 물량이 배정된 대안: {top_option} ({opt_totals.get(top_option, 0)} pallet)",
            f"대체 운송계획 사용량: {alt_used} / {config.alternative_plan_total_capacity} pallet",
            f"긴급 항공 사용량: {air_used} / {config.air_total_capacity} pallet",
        ]

    allocated_options_desc = []
    for a_code, a_name in [("AIR", "항공 수송"), ("STOCK_TRANSFER", "재고 이동"), ("ALTERNATIVE_PLAN", "대체 운송계획"), ("WAIT", "기존 대기")]:
        items_a = [item for item in allocations if item.option_id == a_code]
        if items_a:
            parts = list(set(f"{item.destination_plant} {item.part_id}" for item in items_a))
            allocated_options_desc.append(f"{a_name} {sum(i.allocated_qty for i in items_a)} pallet ({', '.join(parts)})")

    detail_str = "; ".join(allocated_options_desc) if allocated_options_desc else "배정 물량 없음"

    if objective_mode == "DELAY_THEN_COST":
        gemini_prompt = f"""
다음은 OR-Tools CP-SAT 최적화 (납기 우선 사전식 최적화 policy) 계산 결과다:
- Solver 상태: Stage 1={stage1_status}, Stage 2={stage2_status} (최종 Status={status_str})
- 최소 달성 지연: {total_delay_pallet_days} pallet·일
- 2단계 최적 운송비용 (변동비+고정비): ${secondary_transport_cost:,} (변동비 ${total_var_cost:,}, 고정비 ${total_fixed_cost:,})
- 참고용 지연 패널티: ${total_delay_penalty:,} (총 의사결정비용: ${total_decision_cost:,})
- 대안별 배분 명세: [{detail_str}]

3~5문장으로 다음을 설명하라:
1. 총 지연 pallet-day({total_delay_pallet_days}일)를 최우선 1순위로 최소화했다는 점
2. 그 지연 수준을 고정한 상태에서 2순위로 변동 운송비와 고정비 합계(${secondary_transport_cost:,})를 최소화했다는 점
3. 지연 패널티(${total_delay_penalty:,})는 결과 비교용으로 계산된 값이라는 점
4. 최종 결과는 담당자 승인이 필요하다는 점
숫자는 주어진 결과만 사용하고 새로운 숫자를 만들어내지 마라.
"""
    else:
        gemini_prompt = f"""
다음은 OR-Tools CP-SAT 최적화 (비용·지연 종합 최소화 policy) 계산 결과다:
- Solver 상태: {status_str} (Optimal: {is_optimal})
- 총 의사결정 비용: ${total_decision_cost:,}
- 변동 운송비: ${total_var_cost:,}, 고정비: ${total_fixed_cost:,}, 지연 패널티: ${total_delay_penalty:,}
- 대안별 배분 명세: [{detail_str}]

3~5문장으로 다음을 설명하라:
1. 운송비, 고정비, 지연 패널티의 종합 합계를 최소화하는 trade-off 정책으로 배분되었다는 점
2. 대안별 주요 배분 내용과 용량 제약 준수 여부
3. 최종 결정은 담당자가 승인해야 한다는 점
숫자는 주어진 결과만 사용하고 새로운 숫자를 만들어내지 마라.
"""

    explanation = generate_text_with_gemini(gemini_prompt)
    if not explanation:
        if objective_mode == "DELAY_THEN_COST":
            explanation = (
                f"납기 우선 사전식 최적화(DELAY_THEN_COST) 적용 결과, 1단계에서 총 지연 pallet-day가 최소 수준인 {total_delay_pallet_days} pallet·일로 확정되었습니다. "
                f"2단계에서는 최적 지연 수준을 고정한 상태에서 순수 운송비 및 고정비(${secondary_transport_cost:,})를 최소화했습니다. "
                f"배분 명세: [{detail_str}]. (참고용 지연 패널티: ${total_delay_penalty:,}) "
                f"※ 본 추천안은 담당자의 최종 승인 후 실행됩니다."
            )
        else:
            explanation = (
                f"종합 비용 최소화(TOTAL_DECISION_COST) 적용 결과, 총 의사결정 비용이 ${total_decision_cost:,}로 최적화되었습니다. "
                f"(변동비 ${total_var_cost:,}, 고정비 ${total_fixed_cost:,}, 지연 패널티 ${total_delay_penalty:,}). "
                f"배분 명세: [{detail_str}]. 공용 용량 제약이 엄격히 준수되었습니다. "
                f"※ 본 추천안은 담당자의 최종 승인 후 실행됩니다."
            )

    return MixedOptimizeResponse(
        status=status_str,
        is_optimal=is_optimal,
        solve_time_ms=round(solve_time_ms, 2),
        objective_mode=objective_mode,
        stage1_status=stage1_status,
        stage2_status=stage2_status,
        best_delay_pallet_days=best_delay_pallet_days,
        secondary_transport_cost=secondary_transport_cost,
        warnings=warnings,
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


def solve_total_decision_cost(
    orders: List[OrderModel],
    inventory: Dict[str, Dict[str, InventoryItemModel]],
    options_master: Dict[str, Dict[str, OptionItemModel]],
    config: AppConfigModel,
    time_limit_sec: float = 5.0,
    disruption_occurred: bool = True,
) -> MixedOptimizeResponse:
    start_time = time.time()
    model, x, y, delay_days_dict, plant_part_orders, options_list, plants = build_mixed_model(
        orders, inventory, options_master, config, objective_kind="TOTAL_DECISION_COST",
        disruption_occurred=disruption_occurred,
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    status_code = solver.Solve(model)
    solve_time_ms = (time.time() - start_time) * 1000.0

    if status_code == cp_model.OPTIMAL:
        return extract_solution_response(
            orders, inventory, options_master, config, solver, x, y, delay_days_dict,
            plant_part_orders, options_list, plants, solve_time_ms, "OPTIMAL", True,
            "TOTAL_DECISION_COST", disruption_occurred=disruption_occurred,
        )
    elif status_code == cp_model.FEASIBLE:
        return extract_solution_response(
            orders, inventory, options_master, config, solver, x, y, delay_days_dict,
            plant_part_orders, options_list, plants, solve_time_ms, "FEASIBLE", False, "TOTAL_DECISION_COST",
            warnings=["시간 내에 최적해 보장 없이 실행 가능한(Feasible) 해를 찾았습니다."],
            disruption_occurred=disruption_occurred,
        )
    else:
        status_str = "INFEASIBLE" if status_code == cp_model.INFEASIBLE else "MODEL_INVALID" if status_code == cp_model.MODEL_INVALID else "UNKNOWN"
        return MixedOptimizeResponse(
            status=status_str,
            is_optimal=False,
            solve_time_ms=solve_time_ms,
            objective_mode="TOTAL_DECISION_COST",
            warnings=[f"최적화 풀이 실패: 상태 = {status_str}"],
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
            facts=[f"상태: {status_str}"],
            explanation="제약 조건을 충족하는 배분안을 찾지 못했습니다.",
        )


def solve_delay_then_cost(
    orders: List[OrderModel],
    inventory: Dict[str, Dict[str, InventoryItemModel]],
    options_master: Dict[str, Dict[str, OptionItemModel]],
    config: AppConfigModel,
    time_limit_sec: float = 5.0,
    disruption_occurred: bool = True,
) -> MixedOptimizeResponse:
    start_time = time.time()

    # Stage 1: Minimize total_delay_pallet_days
    model1, x1, y1, delay_days_dict1, plant_part_orders1, options_list1, plants1 = build_mixed_model(
        orders, inventory, options_master, config, objective_kind="STAGE1_DELAY",
        disruption_occurred=disruption_occurred,
    )

    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = time_limit_sec
    status_code1 = solver1.Solve(model1)
    stage1_time_ms = (time.time() - start_time) * 1000.0

    if status_code1 == cp_model.OPTIMAL:
        stage1_status = "OPTIMAL"
    elif status_code1 == cp_model.FEASIBLE:
        stage1_status = "FEASIBLE"
    else:
        status_str1 = "INFEASIBLE" if status_code1 == cp_model.INFEASIBLE else "MODEL_INVALID" if status_code1 == cp_model.MODEL_INVALID else "UNKNOWN"
        return MixedOptimizeResponse(
            status=status_str1,
            is_optimal=False,
            solve_time_ms=stage1_time_ms,
            objective_mode="DELAY_THEN_COST",
            stage1_status=status_str1,
            warnings=[f"1단계 지연 최소화 실패: 상태 = {status_str1}"],
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
            facts=[f"1단계 상태: {status_str1}"],
            explanation="1단계 지연 최소화 모델에서 실행 가능한 해를 찾지 못했습니다.",
        )

    # Calculate delay from Stage 1 solver
    stage1_delay = sum(
        int(solver1.Value(x1[o_idx, a])) * delay_days_dict1[o_idx, a]
        for o_idx in range(len(orders))
        for a in options_list1
    )

    # If Stage 1 is FEASIBLE (not OPTIMAL), do NOT claim exact minimum delay and DO NOT run Stage 2
    if stage1_status == "FEASIBLE":
        solve_time_ms = (time.time() - start_time) * 1000.0
        return extract_solution_response(
            orders, inventory, options_master, config, solver1, x1, y1, delay_days_dict1,
            plant_part_orders1, options_list1, plants1, solve_time_ms, "FEASIBLE", False,
            objective_mode="DELAY_THEN_COST", stage1_status="FEASIBLE", stage2_status=None,
            best_delay_pallet_days=None,
            warnings=["1단계에서 시간 내 최소 지연(OPTIMAL)을 보장하지 못하고 Feasible해만 찾았습니다. 2단계 사전식 최적화를 건너뜁니다."],
            disruption_occurred=disruption_occurred,
        )

    # Stage 1 is OPTIMAL: Save best_delay and proceed to Stage 2
    best_delay = stage1_delay

    # Stage 2: Create fresh new model with fixed_delay = best_delay and minimize var_cost + fixed_cost
    model2, x2, y2, delay_days_dict2, plant_part_orders2, options_list2, plants2 = build_mixed_model(
        orders, inventory, options_master, config, objective_kind="STAGE2_COST",
        fixed_delay=best_delay, disruption_occurred=disruption_occurred,
    )

    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = time_limit_sec
    status_code2 = solver2.Solve(model2)
    total_time_ms = (time.time() - start_time) * 1000.0

    if status_code2 == cp_model.OPTIMAL:
        return extract_solution_response(
            orders, inventory, options_master, config, solver2, x2, y2, delay_days_dict2,
            plant_part_orders2, options_list2, plants2, total_time_ms, "OPTIMAL", True,
            objective_mode="DELAY_THEN_COST", stage1_status="OPTIMAL", stage2_status="OPTIMAL",
            best_delay_pallet_days=best_delay, warnings=[],
            disruption_occurred=disruption_occurred,
        )
    elif status_code2 == cp_model.FEASIBLE:
        return extract_solution_response(
            orders, inventory, options_master, config, solver2, x2, y2, delay_days_dict2,
            plant_part_orders2, options_list2, plants2, total_time_ms, "FEASIBLE", False,
            objective_mode="DELAY_THEN_COST", stage1_status="OPTIMAL", stage2_status="FEASIBLE",
            best_delay_pallet_days=best_delay,
            warnings=["1단계 최소 지연은 달성했으나, 2단계 운송비 최소화에서 시간 내 최적해(OPTIMAL)가 아닌 Feasible해를 탐색했습니다."],
            disruption_occurred=disruption_occurred,
        )
    elif status_code2 == cp_model.UNKNOWN:
        # Time limit reached in Stage 2; return Stage 1 solution as FEASIBLE fallback
        return extract_solution_response(
            orders, inventory, options_master, config, solver1, x1, y1, delay_days_dict1,
            plant_part_orders1, options_list1, plants1, total_time_ms, "FEASIBLE", False,
            objective_mode="DELAY_THEN_COST", stage1_status="OPTIMAL", stage2_status="UNKNOWN",
            best_delay_pallet_days=best_delay,
            warnings=["2단계 운송비 최소화 계산 시간 초과(UNKNOWN). 1단계 배분안을 Fallback으로 반환하며 비용 최소화는 미완료되었습니다."],
            disruption_occurred=disruption_occurred,
        )
    else:
        status_str2 = "INFEASIBLE" if status_code2 == cp_model.INFEASIBLE else "MODEL_INVALID"
        return MixedOptimizeResponse(
            status=status_str2,
            is_optimal=False,
            solve_time_ms=total_time_ms,
            objective_mode="DELAY_THEN_COST",
            stage1_status="OPTIMAL",
            stage2_status=status_str2,
            best_delay_pallet_days=best_delay,
            warnings=[f"2단계 모델 불가능 원인: {status_str2}"],
            total_variable_transport_cost=0,
            total_fixed_cost=0,
            total_delay_penalty=0,
            total_decision_cost=0,
            total_delay_pallet_days=best_delay,
            allocations=[],
            alternative_plan_usage=CapacityUsage(used_qty=0, total_capacity=config.alternative_plan_total_capacity),
            air_usage=CapacityUsage(used_qty=0, total_capacity=config.air_total_capacity),
            stock_transfer_usages=[],
            option_activations=[],
            facts=[f"2단계 상태: {status_str2}"],
            explanation=f"2단계 운송비 최소화 과정에서 실행 불가능 상태({status_str2})가 발생했습니다.",
            error=status_str2,
        )


def optimize_mixed_allocation(req: MixedOptimizeRequest) -> MixedOptimizeResponse:
    all_orders, inventory, options_master, config = load_data()
    valid_order_ids = {o.order_id for o in all_orders}

    # Filter selected orders if specified; return INVALID_ORDER_ID if any selected ID is invalid
    if req.selected_order_ids and len(req.selected_order_ids) > 0:
        invalid_ids = [oid for oid in req.selected_order_ids if oid not in valid_order_ids]
        if invalid_ids:
            return MixedOptimizeResponse(
                status="INVALID_ORDER_ID",
                is_optimal=False,
                solve_time_ms=0,
                objective_mode=req.objective_mode,
                warnings=[f"존재하지 않는 주문 ID 포함: {', '.join(invalid_ids)}"],
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
                facts=[f"INVALID_ORDER_ID: 존재하지 않는 주문 ID가 포함되어 있습니다. ({', '.join(invalid_ids)})"],
                explanation=f"INVALID_ORDER_ID: 요청한 주문 ID ({', '.join(invalid_ids)})를 찾을 수 없습니다.",
                error="INVALID_ORDER_ID",
            )
        orders = [o for o in all_orders if o.order_id in req.selected_order_ids]
    else:
        orders = all_orders

    if not orders:
        return MixedOptimizeResponse(
            status="INVALID_ORDER_ID",
            is_optimal=False,
            solve_time_ms=0,
            objective_mode=req.objective_mode,
            warnings=["선택된 주문이 없습니다."],
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
            facts=["INVALID_ORDER_ID: 선택된 주문이 없습니다."],
            explanation="INVALID_ORDER_ID: 선택된 주문이 없습니다.",
            error="INVALID_ORDER_ID",
        )

    mode = req.objective_mode
    if mode == "DELAY_THEN_COST":
        return solve_delay_then_cost(
            orders, inventory, options_master, config,
            disruption_occurred=req.disruption_occurred,
        )
    else:
        return solve_total_decision_cost(
            orders, inventory, options_master, config,
            disruption_occurred=req.disruption_occurred,
        )
