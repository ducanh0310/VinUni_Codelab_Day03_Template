import os
import sys
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Add starter-code to path so template.py and tools.py are accessible
starter_code_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "starter-code"))
if starter_code_dir not in sys.path:
    sys.path.insert(0, starter_code_dir)

from template import ChatbotBaseline, ReActAgent

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

# Initialize models
chatbot_baseline = ChatbotBaseline()
react_agent = ReActAgent(max_iterations=5)

SAMPLE_QUERIES = [
    {
        "id": "multi_step",
        "title": "Chuyến bay & Thời tiết (Multi-Step)",
        "query": "Tìm cho tôi chuyến bay từ HAN đi SGN dưới 2 triệu, rồi cho biết thời tiết SGN nên mặc gì?",
        "icon": "✈️"
    },
    {
        "id": "flight_only",
        "title": "Chỉ tìm chuyến bay (Single-Step Flight)",
        "query": "Có chuyến bay nào từ HAN đi DAD giá dưới 1.5 triệu không?",
        "icon": "🛫"
    },
    {
        "id": "weather_only",
        "title": "Chỉ xem thời tiết (Single-Step Weather)",
        "query": "Thời tiết ở Đà Nẵng DAD hiện tại thế nào?",
        "icon": "⛅"
    },
    {
        "id": "faq",
        "title": "Hỏi đáp chính sách FAQ (No Tool Call)",
        "query": "Chính sách đổi trả vé máy bay Vinpearl như thế nào?",
        "icon": "📋"
    }
]

@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")

@app.route("/api/sample-queries", methods=["GET"])
def get_sample_queries():
    return jsonify(SAMPLE_QUERIES)

@app.route("/api/query", methods=["POST"])
def process_query():
    data = request.get_json() or {}
    user_query = data.get("query", "").strip()
    mode = data.get("mode", "both")

    if not user_query:
        return jsonify({"error": "Vui lòng nhập câu hỏi khách hàng."}), 400

    response_payload = {
        "query": user_query,
        "mode": mode,
        "baseline": None,
        "react": None
    }

    # Execute Baseline
    if mode in ["both", "baseline"]:
        start_time = time.time()
        try:
            baseline_result = chatbot_baseline.query(user_query)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            response_payload["baseline"] = {
                **baseline_result,
                "execution_time_ms": elapsed_ms
            }
        except Exception as e:
            response_payload["baseline"] = {
                "answer": f"Lỗi thực thi Baseline: {str(e)}",
                "tool_calls": [],
                "status": "error",
                "mode": "error",
                "execution_time_ms": 0
            }

    # Execute ReAct Agent
    if mode in ["both", "react"]:
        start_time = time.time()
        try:
            react_result = react_agent.run(user_query)
            elapsed_ms = round((time.time() - start_time) * 1000, 2)
            response_payload["react"] = {
                **react_result,
                "execution_time_ms": elapsed_ms
            }
        except Exception as e:
            response_payload["react"] = {
                "answer": f"Lỗi thực thi ReAct Agent: {str(e)}",
                "trace": [],
                "iterations": 0,
                "status": "error",
                "execution_time_ms": 0
            }

    return jsonify(response_payload)

if __name__ == "__main__":
    print("Starting VinUni ReAct Agent Web Server on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
