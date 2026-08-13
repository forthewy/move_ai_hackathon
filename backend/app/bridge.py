import sys
import json
from backend.app.data_loader import load_data
from backend.app.schemas import (
    RiskAnalyzeRequest,
    PureCompareRequest,
    MixedOptimizeRequest,
    ExplainRequest,
)
from backend.app.risk_service import analyze_risk
from backend.app.pure_service import compare_pure_options
from backend.app.mixed_service import optimize_mixed_allocation
from backend.app.explanation_service import explain_result

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command argument"}))
        sys.exit(1)

    cmd = sys.argv[1]
    input_json = sys.argv[2] if len(sys.argv) > 2 else "{}"

    try:
        data = json.loads(input_json)
    except Exception:
        data = {}

    try:
        if cmd == "get_orders":
            orders, _, _, _ = load_data()
            print(json.dumps([o.model_dump() for o in orders], ensure_ascii=False))
        elif cmd == "get_options":
            _, _, options, _ = load_data()
            result = {}
            for plant, opt_dict in options.items():
                result[plant] = {k: v.model_dump() for k, v in opt_dict.items()}
            print(json.dumps(result, ensure_ascii=False))
        elif cmd == "risk_analyze":
            req = RiskAnalyzeRequest(**data)
            res = analyze_risk(req)
            print(json.dumps(res.model_dump(), ensure_ascii=False))
        elif cmd == "pure_compare":
            req = PureCompareRequest(**data)
            res = compare_pure_options(req)
            print(json.dumps(res.model_dump(), ensure_ascii=False))
        elif cmd == "mixed_optimize":
            req = MixedOptimizeRequest(**data)
            res = optimize_mixed_allocation(req)
            print(json.dumps(res.model_dump(), ensure_ascii=False))
        elif cmd == "search_news":
            from backend.app.schemas import NewsSearchRequest, NewsSearchResponse, NewsSearchItemSchema
            from backend.app.news_searcher import search_realtime_news

            req = NewsSearchRequest(**data)
            items = search_realtime_news(req.query, req.limit or 5)
            res = NewsSearchResponse(
                query=req.query,
                articles=[
                    NewsSearchItemSchema(
                        title=i.title,
                        link=i.link,
                        snippet=i.snippet,
                        pub_date=i.pub_date,
                        source_name=i.source_name,
                    )
                    for i in items
                ],
            )
            print(json.dumps(res.model_dump(), ensure_ascii=False))
        elif cmd == "explain":
            req = ExplainRequest(**data)
            exp = explain_result(req)
            print(json.dumps({"explanation": exp}, ensure_ascii=False))
        else:
            print(json.dumps({"error": f"Unknown command: {cmd}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
