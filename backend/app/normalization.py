from typing import List, Dict, Any
from .schemas import OrderModel, OptionItemModel, InventoryItemModel, AppConfigModel

def normalize_orders(raw_orders: List[Dict[str, Any]]) -> List[OrderModel]:
    normalized = []
    for item in raw_orders:
        order_id = item.get("shipment_id") or item.get("order_id") or ""
        destination_plant = item.get("plant") or item.get("destination_plant") or ""
        part_id = item.get("part_code") or item.get("part_id") or ""
        part_name = item.get("part_name", "")
        qty = int(item.get("qty", 0))
        required_arrival_day = int(item.get("required_arrival_day", 30))
        planned_dep = item.get("planned_departure_date", "2026-08-15")
        req_arr_date = item.get("required_arrival_date", "2026-09-14")
        delay_penalty = int(item.get("delay_penalty_per_pallet_day", 500))
        is_compatible = item.get("is_compatible", True)

        normalized.append(
            OrderModel(
                order_id=order_id,
                destination_plant=destination_plant,
                part_id=part_id,
                part_name=part_name,
                qty=qty,
                required_arrival_day=required_arrival_day,
                planned_departure_date=planned_dep,
                required_arrival_date=req_arr_date,
                delay_penalty_per_pallet_day=delay_penalty,
                is_compatible=is_compatible,
            )
        )
    return normalized


def normalize_inventory(raw_inventory: Dict[str, Dict[str, Dict[str, int]]]) -> Dict[str, Dict[str, InventoryItemModel]]:
    normalized: Dict[str, Dict[str, InventoryItemModel]] = {}
    for plant, parts in raw_inventory.items():
        normalized[plant] = {}
        for part_id, inv_data in parts.items():
            c_stock = int(inv_data.get("current_stock", 0))
            m_stock = int(inv_data.get("min_safety_stock", 0))
            transferable = max(0, c_stock - m_stock)
            normalized[plant][part_id] = InventoryItemModel(
                current_stock=c_stock,
                min_safety_stock=m_stock,
                transferable_qty=transferable,
            )
    return normalized


def normalize_options(raw_options: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, OptionItemModel]]:
    # Map raw option keys: ALT_ROUTE -> ALTERNATIVE_PLAN, STOCK_MOVE -> STOCK_TRANSFER
    KEY_MAP = {
        "WAIT": "WAIT",
        "ALT_ROUTE": "ALTERNATIVE_PLAN",
        "ALTERNATIVE_PLAN": "ALTERNATIVE_PLAN",
        "STOCK_MOVE": "STOCK_TRANSFER",
        "STOCK_TRANSFER": "STOCK_TRANSFER",
        "AIR": "AIR",
    }

    normalized: Dict[str, Dict[str, OptionItemModel]] = {}
    for plant, options in raw_options.items():
        normalized[plant] = {}
        for raw_opt_key, opt_data in options.items():
            norm_opt_key = KEY_MAP.get(raw_opt_key, raw_opt_key)
            
            # Arrival day computation
            if "arrival_day" in opt_data:
                arrival_day = int(opt_data["arrival_day"])
            else:
                base_day = int(opt_data.get("baseline_arrival_day", 30))
                disruption_delay = int(opt_data.get("disruption_delay", 0))
                arrival_day = base_day + disruption_delay

            option_name = opt_data.get("option_name", norm_opt_key)
            if norm_opt_key == "ALTERNATIVE_PLAN" and "대체 운송" in option_name:
                option_name = "대체 운송계획 (함부르크 우회)"
            elif norm_opt_key == "STOCK_TRANSFER" and "재고 이동" in option_name:
                option_name = "인근 공장 재고 이동"

            max_q = opt_data.get("max_qty")
            max_qty_val = int(max_q) if max_q is not None else None

            normalized[plant][norm_opt_key] = OptionItemModel(
                option_id=norm_opt_key,
                option_name=option_name,
                passes_red_sea=bool(opt_data.get("passes_red_sea", False)),
                arrival_day=arrival_day,
                fixed_cost=int(opt_data.get("fixed_cost", 0)),
                unit_cost_per_pallet=int(opt_data.get("unit_cost_per_pallet", 0)),
                max_qty=max_qty_val,
                available=bool(opt_data.get("available", True)),
            )
    return normalized


def normalize_app_config(raw_config: Dict[str, Any]) -> AppConfigModel:
    return AppConfigModel(
        air_total_capacity=int(raw_config.get("air_total_capacity", 15)),
        alternative_plan_total_capacity=int(raw_config.get("alternative_plan_total_capacity", 50)),
        cost_currency=str(raw_config.get("cost_currency", "USD")),
        quantity_unit=str(raw_config.get("quantity_unit", "pallet")),
        time_unit=str(raw_config.get("time_unit", "day")),
    )
