import pytest
from backend.app.data_loader import load_data
from backend.app.schemas import (
    RiskAnalyzeRequest,
    PureCompareRequest,
    MixedOptimizeRequest,
)
from backend.app.risk_service import analyze_risk
from backend.app.pure_service import compare_pure_options
from backend.app.mixed_service import optimize_mixed_allocation

def test_1_json_normalization():
    orders, inventory, options, config = load_data()
    assert len(orders) == 10
    assert "HMMC_CZ" in inventory
    assert "KASK_SK" in inventory
    assert "HMMC_CZ" in options
    
    # Check normalized option keys: ALT_ROUTE -> ALTERNATIVE_PLAN, STOCK_MOVE -> STOCK_TRANSFER
    hmmc_opts = options["HMMC_CZ"]
    assert "ALTERNATIVE_PLAN" in hmmc_opts
    assert "STOCK_TRANSFER" in hmmc_opts
    assert "WAIT" in hmmc_opts
    assert "AIR" in hmmc_opts

    # Check order fields
    assert orders[0].order_id == "ORD-CZ-01"
    assert orders[0].destination_plant == "HMMC_CZ"
    assert orders[0].part_id == "PART_ECU"

    # Check transferable_qty calculation: max(0, current_stock - min_safety_stock)
    # HMMC_CZ PART_ECU stock=13, min=10 -> 3
    assert inventory["HMMC_CZ"]["PART_ECU"].transferable_qty == 3

def test_2_mixed_variable_count_dynamic():
    req_full = MixedOptimizeRequest()
    res_full = optimize_mixed_allocation(req_full)
    assert res_full.status in ["OPTIMAL", "FEASIBLE"]
    assert len(res_full.allocations) > 0

    # Partial selection (2 orders)
    req_partial = MixedOptimizeRequest(selected_order_ids=["ORD-CZ-01", "ORD-CZ-02"])
    res_partial = optimize_mixed_allocation(req_partial)
    assert res_partial.status in ["OPTIMAL", "FEASIBLE"]
    
    # Sum of allocated qty equals sum of selected orders qty
    orders, _, _, _ = load_data()
    selected_qty = sum(o.qty for o in orders if o.order_id in ["ORD-CZ-01", "ORD-CZ-02"])
    total_allocated = sum(item.allocated_qty for item in res_partial.allocations)
    assert total_allocated == selected_qty

def test_3_quantity_preservation():
    orders, _, _, _ = load_data()
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.status in ["OPTIMAL", "FEASIBLE"]

    for o in orders:
        o_allocs = [item for item in res.allocations if item.order_id == o.order_id]
        total_o_qty = sum(item.allocated_qty for item in o_allocs)
        assert total_o_qty == o.qty, f"Order {o.order_id} qty mismatch: {total_o_qty} vs {o.qty}"

def test_4_air_capacity_limit():
    _, _, _, config = load_data()
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.status in ["OPTIMAL", "FEASIBLE"]

    air_total = sum(item.allocated_qty for item in res.allocations if item.option_id == "AIR")
    assert air_total <= config.air_total_capacity, f"AIR capacity exceeded: {air_total} > {config.air_total_capacity}"

def test_5_stock_transfer_limit():
    orders, inventory, _, _ = load_data()
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.status in ["OPTIMAL", "FEASIBLE"]

    # Group allocations by plant and part
    plant_part_st = {}
    for item in res.allocations:
        if item.option_id == "STOCK_TRANSFER":
            key = (item.destination_plant, item.part_id)
            plant_part_st[key] = plant_part_st.get(key, 0) + item.allocated_qty

    for (p, k), qty in plant_part_st.items():
        inv_item = inventory.get(p, {}).get(k)
        trans_qty = inv_item.transferable_qty if inv_item else 0
        assert qty <= trans_qty, f"STOCK_TRANSFER limit exceeded for {p}-{k}: {qty} > {trans_qty}"

def test_6_alternative_plan_shared_capacity():
    _, _, _, config = load_data()
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.status in ["OPTIMAL", "FEASIBLE"]

    alt_total = sum(item.allocated_qty for item in res.allocations if item.option_id == "ALTERNATIVE_PLAN")
    assert alt_total <= config.alternative_plan_total_capacity

def test_7_8_fixed_cost_once_and_zero_for_unused():
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.status in ["OPTIMAL", "FEASIBLE"]

    for act in res.option_activations:
        if act.activated:
            # Check fixed cost matches options master
            if act.option_id == "WAIT":
                assert act.fixed_cost == 0
            elif act.option_id == "ALTERNATIVE_PLAN":
                assert act.fixed_cost == 1000
            elif act.option_id == "STOCK_TRANSFER":
                assert act.fixed_cost == 500
            elif act.option_id == "AIR":
                assert act.fixed_cost == 2000
        else:
            assert act.fixed_cost == 0

def test_9_pure_capacity_unavailability():
    # ORD-CZ-04 has qty 14. STOCK_TRANSFER transferable for HMMC_CZ PART_ECU is 3.
    # So STOCK_TRANSFER must be unavailable for ORD-CZ-04 in Pure comparison.
    res = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-04"))
    st_opt = next(r for r in res.options_results if r.option_id == "STOCK_TRANSFER")
    assert st_opt.available is False
    assert "초과" in st_opt.unavailability_reason

def test_10_pure_sensitivity_recommendation_change():
    # Hand-calculable sample for ORD-CZ-02 (qty=10, MCU, STOCK_TRANSFER unavailable due to 0 transferable stock):
    # At penalty=100/day:
    #   WAIT: var_cost=10*3000=30000, fixed=0, delay=12 -> penalty=10*12*100=12000. Total=42000.
    #   ALT_PLAN: var_cost=10*6500=65000, fixed=1000, delay=4 -> penalty=10*4*100=4000. Total=70000.
    #   Recommendation: WAIT (42000 < 70000)
    res_low_pen = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-02", delay_penalty_per_pallet_day_override=100))
    assert res_low_pen.recommended_option_id == "WAIT"

    # At penalty=1000/day:
    #   WAIT: penalty=10*12*1000=120000. Total=150000.
    #   ALT_PLAN: penalty=10*4*1000=40000. Total=106000.
    #   Recommendation: ALTERNATIVE_PLAN (106000 < 150000)
    res_high_pen = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-02", delay_penalty_per_pallet_day_override=1000))
    assert res_high_pen.recommended_option_id == "ALTERNATIVE_PLAN"

def test_11_fallback_without_gemini_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    risk_res = analyze_risk(RiskAnalyzeRequest(preset_level="HIGH"))
    assert risk_res.risk_grade == "HIGH"
    assert risk_res.is_synthetic is True

    pure_res = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-01"))
    assert pure_res.recommended_option_id is not None
    assert len(pure_res.explanation) > 0

    mixed_res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert mixed_res.status in ["OPTIMAL", "FEASIBLE"]
    assert len(mixed_res.explanation) > 0

def test_12_error_handling():
    res = compare_pure_options(PureCompareRequest(order_id="NON_EXISTENT_ORDER"))
    assert res.order is not None

    res_mixed = optimize_mixed_allocation(MixedOptimizeRequest(selected_order_ids=["INVALID_ID"]))
    assert res_mixed.status == "INVALID_ORDER_ID"
    assert res_mixed.allocations == []

def test_13_disruption_occurred_toggle():
    # 1) When disruption_occurred = False in Pure compare, WAIT arrival day must be baseline_arrival_day (30) and delay = 0
    res_no_disruption = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-01", disruption_occurred=False))
    wait_opt = next(r for r in res_no_disruption.options_results if r.option_id == "WAIT")
    assert wait_opt.arrival_day == 30
    assert wait_opt.delay_days == 0

    # When disruption_occurred = True, WAIT arrival day must be baseline_arrival_day + disruption_delay (30 + 12 = 42) and delay = 12
    res_disruption = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-01", disruption_occurred=True))
    wait_opt_disrupted = next(r for r in res_disruption.options_results if r.option_id == "WAIT")
    assert wait_opt_disrupted.arrival_day == 42
    assert wait_opt_disrupted.delay_days == 12

    # 2) When disruption_occurred = False in Mixed optimize, the total cost must be lower than when disruption_occurred = True
    res_mixed_no_disruption = optimize_mixed_allocation(MixedOptimizeRequest(disruption_occurred=False))
    assert res_mixed_no_disruption.status in ["OPTIMAL", "FEASIBLE"]
    
    res_mixed_disruption = optimize_mixed_allocation(MixedOptimizeRequest(disruption_occurred=True))
    assert res_mixed_disruption.status in ["OPTIMAL", "FEASIBLE"]

    # No-disruption cost must be lower than disruption cost
    assert res_mixed_no_disruption.total_decision_cost < res_mixed_disruption.total_decision_cost
    # Under normal conditions, no order should suffer any delays since WAIT (arrival Day 30) satisfies all required arrivals (Day 30)
    assert res_mixed_no_disruption.total_delay_pallet_days == 0


def test_14_default_objective_mode():
    res = optimize_mixed_allocation(MixedOptimizeRequest())
    assert res.objective_mode == "TOTAL_DECISION_COST"


def test_15_objective_mode_policy_difference():
    from backend.app.schemas import OrderModel
    from backend.app.mixed_service import solve_total_decision_cost, solve_delay_then_cost

    test_order = OrderModel(
        order_id="TEST-POLICY-01",
        destination_plant="HMMC_CZ",
        part_id="PART_MCU",
        qty=1,
        required_arrival_day=1,
        delay_penalty_per_pallet_day=10,
    )
    _, inventory, options_master, config = load_data()

    res_cost = solve_total_decision_cost(
        [test_order], inventory, options_master, config, disruption_occurred=True
    )
    assert res_cost.status == "OPTIMAL"
    wait_alloc = next((i for i in res_cost.allocations if i.option_id == "WAIT"), None)
    assert wait_alloc is not None and wait_alloc.allocated_qty == 1

    res_delay = solve_delay_then_cost(
        [test_order], inventory, options_master, config, disruption_occurred=True
    )
    assert res_delay.status == "OPTIMAL"
    assert res_delay.best_delay_pallet_days == 3
    air_alloc = next((i for i in res_delay.allocations if i.option_id == "AIR"), None)
    assert air_alloc is not None and air_alloc.allocated_qty == 1


def test_16_stage2_tie_breaking():
    from backend.app.schemas import OrderModel, OptionItemModel, InventoryItemModel, AppConfigModel
    from backend.app.mixed_service import solve_delay_then_cost

    test_order = OrderModel(
        order_id="TEST-TIE-01",
        destination_plant="PLANT_X",
        part_id="PART_A",
        qty=2,
        required_arrival_day=10,
        delay_penalty_per_pallet_day=500,
    )
    custom_options = {
        "PLANT_X": {
            "WAIT": OptionItemModel(
                option_id="WAIT", option_name="Wait", passes_red_sea=True,
                arrival_day=30, baseline_arrival_day=30, disruption_delay=0,
                fixed_cost=0, unit_cost_per_pallet=1000, available=True,
            ),
            "ALTERNATIVE_PLAN": OptionItemModel(
                option_id="ALTERNATIVE_PLAN", option_name="Alt Expensive", passes_red_sea=False,
                arrival_day=4, baseline_arrival_day=4, disruption_delay=0,
                fixed_cost=5000, unit_cost_per_pallet=10000, available=True,
            ),
            "STOCK_TRANSFER": OptionItemModel(
                option_id="STOCK_TRANSFER", option_name="Stock Cheap", passes_red_sea=False,
                arrival_day=4, baseline_arrival_day=4, disruption_delay=0,
                fixed_cost=500, unit_cost_per_pallet=1000, available=True,
            ),
            "AIR": OptionItemModel(
                option_id="AIR", option_name="Air", passes_red_sea=False,
                arrival_day=4, baseline_arrival_day=4, disruption_delay=0,
                fixed_cost=2000, unit_cost_per_pallet=20000, available=True,
            ),
        }
    }
    custom_inventory = {
        "PLANT_X": {
            "PART_A": InventoryItemModel(
                current_stock=10, min_safety_stock=0, transferable_qty=10
            )
        }
    }
    config = AppConfigModel(air_total_capacity=50, alternative_plan_total_capacity=50)

    res = solve_delay_then_cost(
        [test_order], custom_inventory, custom_options, config, disruption_occurred=True
    )
    assert res.status == "OPTIMAL"
    assert res.stage1_status == "OPTIMAL"
    assert res.stage2_status == "OPTIMAL"
    assert res.best_delay_pallet_days == 0
    cheap_alloc = next(
        (i for i in res.allocations if i.option_id == "STOCK_TRANSFER"), None
    )
    assert cheap_alloc is not None
    assert cheap_alloc.allocated_qty == 2


def test_17_constraint_preservation_across_both_modes():
    orders, _, _, config = load_data()
    for mode in ["TOTAL_DECISION_COST", "DELAY_THEN_COST"]:
        res = optimize_mixed_allocation(
            MixedOptimizeRequest(objective_mode=mode, disruption_occurred=True)
        )
        assert res.status in ["OPTIMAL", "FEASIBLE"]

        for order in orders:
            allocated = sum(
                item.allocated_qty
                for item in res.allocations
                if item.order_id == order.order_id
            )
            assert allocated == order.qty

        assert res.air_usage.used_qty <= config.air_total_capacity
        assert (
            res.alternative_plan_usage.used_qty
            <= config.alternative_plan_total_capacity
        )


def test_18_representative_factories_integration():
    orders, _, _, _ = load_data()
    assert {"HMMC_CZ", "KASK_SK"} <= {o.destination_plant for o in orders}

    res = optimize_mixed_allocation(
        MixedOptimizeRequest(
            objective_mode="TOTAL_DECISION_COST",
            disruption_occurred=True,
        )
    )
    assert res.status in ["OPTIMAL", "FEASIBLE"]
    assert {"HMMC_CZ", "KASK_SK"} <= {
        item.destination_plant for item in res.allocations
    }


def test_19_disruption_toggle_is_preserved_in_both_objective_modes():
    for mode in ["TOTAL_DECISION_COST", "DELAY_THEN_COST"]:
        normal = optimize_mixed_allocation(
            MixedOptimizeRequest(
                disruption_occurred=False,
                objective_mode=mode,
            )
        )
        disrupted = optimize_mixed_allocation(
            MixedOptimizeRequest(
                disruption_occurred=True,
                objective_mode=mode,
            )
        )

        assert normal.status in ["OPTIMAL", "FEASIBLE"]
        assert disrupted.status in ["OPTIMAL", "FEASIBLE"]
        assert normal.total_delay_pallet_days == 0
        assert disrupted.total_delay_pallet_days >= normal.total_delay_pallet_days


def test_20_optimization_does_not_call_gemini_automatically(monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("Pure/Mixed calculation must not call Gemini automatically")

    monkeypatch.setattr(
        "backend.app.pure_service.generate_text_with_gemini",
        fail_if_called,
        raising=False,
    )
    monkeypatch.setattr(
        "backend.app.mixed_service.generate_text_with_gemini",
        fail_if_called,
        raising=False,
    )

    pure = compare_pure_options(PureCompareRequest(order_id="ORD-CZ-01"))
    mixed = optimize_mixed_allocation(MixedOptimizeRequest())

    assert pure.recommended_option_id is not None
    assert mixed.status in ["OPTIMAL", "FEASIBLE"]


def test_21_realtime_news_search_integration():
    from backend.app.news_searcher import search_realtime_news
    from backend.app.schemas import NewsSearchItemSchema, RiskAnalyzeRequest

    articles = search_realtime_news("홍해 수에즈 공격", limit=3)
    assert isinstance(articles, list)
    assert len(articles) > 0

    first_item = articles[0]
    assert first_item.title
    assert first_item.link

    schema_item = NewsSearchItemSchema(
        title=first_item.title,
        link=first_item.link,
        snippet=first_item.snippet,
        pub_date=first_item.pub_date,
        source_name=first_item.source_name,
    )

    req = RiskAnalyzeRequest(
        input_mode="ARTICLE",
        selected_article=schema_item,
    )
    assert req.selected_article is not None
