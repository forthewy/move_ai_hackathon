import json
import os
from typing import List, Dict, Tuple, Any
from .schemas import OrderModel, OptionItemModel, InventoryItemModel, AppConfigModel
from .normalization import normalize_orders, normalize_inventory, normalize_options, normalize_app_config

def get_data_dir() -> str:
    possible_paths = [
        os.path.join(os.getcwd(), "backend", "data"),
        os.path.join(os.getcwd(), "data"),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data")),
    ]
    for p in possible_paths:
        if os.path.exists(p) and os.path.exists(os.path.join(p, "orders.json")):
            return p
    return os.path.join(os.getcwd(), "backend", "data")

def load_data() -> Tuple[List[OrderModel], Dict[str, Dict[str, InventoryItemModel]], Dict[str, Dict[str, OptionItemModel]], AppConfigModel]:
    data_dir = get_data_dir()

    # Load orders
    orders_path = os.path.join(data_dir, "orders.json")
    with open(orders_path, "r", encoding="utf-8") as f:
        raw_orders = json.load(f)
    orders = normalize_orders(raw_orders)

    # Load inventory
    inv_path = os.path.join(data_dir, "factory_inventory.json")
    with open(inv_path, "r", encoding="utf-8") as f:
        raw_inv = json.load(f)
    inventory = normalize_inventory(raw_inv)

    # Load options
    options_path = os.path.join(data_dir, "options_master.json")
    with open(options_path, "r", encoding="utf-8") as f:
        raw_options = json.load(f)
    options = normalize_options(raw_options)

    # Load config
    config_path = os.path.join(data_dir, "app_config.json")
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            raw_config = json.load(f)
    else:
        raw_config = {}
    config = normalize_app_config(raw_config)

    return orders, inventory, options, config

def load_synthetic_news() -> Dict[str, Any]:
    data_dir = get_data_dir()
    news_path = os.path.join(data_dir, "synthetic_news.json")
    if os.path.exists(news_path):
        with open(news_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}
