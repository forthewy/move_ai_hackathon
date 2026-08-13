from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from .schemas import (
    RiskAnalyzeRequest,
    RiskAnalyzeResponse,
    PureCompareRequest,
    PureCompareResponse,
    MixedOptimizeRequest,
    MixedOptimizeResponse,
    ExplainRequest,
)
from .data_loader import load_data
from .risk_service import analyze_risk
from .pure_service import compare_pure_options
from .mixed_service import optimize_mixed_allocation
from .explanation_service import explain_result

app = FastAPI(
    title="Gemini-based KD Logistics Disruption Response API",
    description="MOVE AI Challenge 2026 - Operations Research & Gemini Decision Support API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "kd-logistics-backend"}

@app.get("/api/data/orders")
def get_orders():
    orders, _, _, _ = load_data()
    return [o.model_dump() for o in orders]

@app.get("/api/data/options")
def get_options():
    _, _, options, _ = load_data()
    result = {}
    for plant, opt_dict in options.items():
        result[plant] = {k: v.model_dump() for k, v in opt_dict.items()}
    return result

@app.post("/api/risk/analyze", response_model=RiskAnalyzeResponse)
def api_analyze_risk(req: RiskAnalyzeRequest):
    try:
        return analyze_risk(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/pure/compare", response_model=PureCompareResponse)
def api_compare_pure(req: PureCompareRequest):
    try:
        return compare_pure_options(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mixed/optimize", response_model=MixedOptimizeResponse)
def api_optimize_mixed(req: MixedOptimizeRequest):
    try:
        return optimize_mixed_allocation(req)
    except Exception as e:
        # Structured error response, never crash 500 without details
        return MixedOptimizeResponse(
            status="ERROR",
            is_optimal=False,
            solve_time_ms=0,
            total_variable_transport_cost=0,
            total_fixed_cost=0,
            total_delay_penalty=0,
            total_decision_cost=0,
            total_delay_pallet_days=0,
            allocations=[],
            alternative_plan_usage={"used_qty": 0, "total_capacity": 50},
            air_usage={"used_qty": 0, "total_capacity": 15},
            stock_transfer_usages=[],
            option_activations=[],
            facts=[f"서버 처리 오류: {str(e)}"],
            explanation=f"최적화 계산 중 내부 오류가 발생했습니다: {str(e)}",
        )

@app.post("/api/explain")
def api_explain(req: ExplainRequest):
    try:
        explanation = explain_result(req)
        return {"explanation": explanation}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
