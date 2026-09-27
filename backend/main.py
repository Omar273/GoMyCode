"""
Flask API for the PDF -> Quiz hackathon app.

Endpoints:
    POST /api/generate-quiz   multipart form: file (PDF) + optional num_questions
    GET  /api/health          liveness probe
"""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

from groq_client import GroqAPIError, generate_quiz
from pdf_utils import PDFExtractionError, extract_text_from_pdf

load_dotenv()  # reads .env in this folder; real values never live in git

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB guard against abuse

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # lock this down in prod


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({"error": "File too large. Maximum size is 10 MB."}), 413


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/generate-quiz")
def generate_quiz_route():
    # ---- 1. Validate the upload ------------------------------------------
    if "file" not in request.files:
        return jsonify({"error": "No file provided. Attach the PDF as 'file'."}), 400

    uploaded = request.files["file"]
    if not uploaded.filename:
        return jsonify({"error": "Empty filename."}), 400

    looks_like_pdf = (
        uploaded.mimetype == "application/pdf"
        or uploaded.filename.lower().endswith(".pdf")
    )
    if not looks_like_pdf:
        return jsonify({"error": "Unsupported file type. Only PDF is accepted."}), 400

    # Optional knob: how many questions (clamped to a sane range)
    try:
        num_questions = int(request.form.get("num_questions", 10))
    except (TypeError, ValueError):
        return jsonify({"error": "num_questions must be an integer."}), 400
    num_questions = max(1, min(num_questions, 30))

    # ---- 2. Extract text --------------------------------------------------
    try:
        text = extract_text_from_pdf(uploaded.stream)
    except PDFExtractionError as exc:
        # 422 = "I understood your request but the content is unusable"
        return jsonify({"error": str(exc)}), 422
    except Exception:
        app.logger.exception("Unexpected PDF parsing failure")
        return jsonify({"error": "Failed to parse the uploaded PDF."}), 422

    # ---- 3. Call Grok -----------------------------------------------------
    try:
        quiz = generate_quiz(text, num_questions=num_questions)
    except GrokAPIError as exc:
        return jsonify({"error": str(exc)}), 502  # upstream dependency failed
    except Exception:
        app.logger.exception("Unexpected quiz generation failure")
        return jsonify({"error": "Quiz generation failed unexpectedly."}), 500

    # ---- 4. Respond --------------------------------------------------------
    return jsonify({"quiz": quiz})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
