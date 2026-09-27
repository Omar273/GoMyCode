"""
Client for the GroqCloud Llama 3.1 8B chat-completions API
(OpenAI-compatible).

Design notes:
- The API key is read from os.environ at call time. Never hardcoded.
- The model is instructed to return ONLY JSON, but real LLMs often wrap
  output in ```json fences anyway — hence the multi-layer fallback parser.
- If the first response fails validation we retry once with a correction
  nudge instead of giving up immediately.
"""

import json
import os
import re
from typing import Optional

from openai import APIError, APITimeoutError, OpenAI, RateLimitError


# GroqCloud OpenAI-compatible API
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# Groq model
DEFAULT_MODEL = "openai/gpt-oss-20b"

MAX_RETRIES = 1  # one retry after the first malformed response


class GroqAPIError(Exception):
    """Raised for any Groq API failure or unusable quiz JSON."""


# Lazy singleton: don't construct a client at import time.
_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client

    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")

        if not api_key:
            raise GroqAPIError(
                "GROQ_API_KEY is not set on the server."
            )

        _client = OpenAI(
            api_key=api_key,
            base_url=GROQ_BASE_URL,
            timeout=60.0,
        )

    return _client


def _build_prompt(source_text: str, num_questions: int) -> str:
    return f"""You are a quiz generator. Read the source material below and create exactly {num_questions} multiple-choice questions.

RULES:
1. Return ONLY a JSON object. No markdown, no prose, no code fences.
2. The JSON must match this exact schema:
{{
  "questions": [
    {{
      "question": "string",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": 0,
      "explanation": "string"
    }}
  ]
}}
3. "options" must contain exactly 4 non-empty strings.
4. "correctAnswer" is the ZERO-BASED index of the correct option (an integer 0-3).
5. "explanation" must justify the answer using the source material.
6. Questions must be answerable from the source material only — do not use outside knowledge.

SOURCE MATERIAL:
\"\"\"{source_text}\"\"\"
"""


def _validate_schema(data) -> dict:
    """Ensure the parsed JSON matches the contract promised to the frontend."""

    if not isinstance(data, dict) or not isinstance(
        data.get("questions"), list
    ):
        raise GroqAPIError(
            "JSON is missing the 'questions' list."
        )

    if not data["questions"]:
        raise GroqAPIError("'questions' is empty.")

    for i, q in enumerate(data["questions"]):

        if not isinstance(q, dict):
            raise GroqAPIError(
                f"Question {i} is not an object."
            )

        if not isinstance(q.get("question"), str) or not q["question"].strip():
            raise GroqAPIError(
                f"Question {i} has an empty 'question'."
            )

        options = q.get("options")

        if (
            not isinstance(options, list)
            or len(options) != 4
            or not all(
                isinstance(o, str) and o.strip()
                for o in options
            )
        ):
            raise GroqAPIError(
                f"Question {i} must have exactly 4 non-empty options."
            )

        answer = q.get("correctAnswer")

        if not isinstance(answer, int) or not 0 <= answer < 4:
            raise GroqAPIError(
                f"Question {i} has an invalid 'correctAnswer'."
            )

    return data


def _parse_quiz_json(raw: str) -> dict:
    """Parse model output with layered fallbacks before giving up.

    Layer 1: parse the string directly.
    Layer 2: strip ```json ... ``` fences and parse.
    Layer 3: slice from the first '{' to the last '}' and parse.
    """

    raw = raw.strip()

    # Layer 1: direct JSON
    try:
        return _validate_schema(json.loads(raw))
    except (json.JSONDecodeError, GroqAPIError):
        pass

    # Layer 2: fenced JSON
    fenced = re.search(
        r"```(?:json)?\s*(.*?)```",
        raw,
        re.DOTALL,
    )

    if fenced:
        try:
            return _validate_schema(
                json.loads(fenced.group(1))
            )
        except (json.JSONDecodeError, GroqAPIError):
            pass

    # Layer 3: extract JSON object
    start = raw.find("{")
    end = raw.rfind("}")

    if start != -1 and end > start:
        try:
            return _validate_schema(
                json.loads(raw[start:end + 1])
            )
        except (json.JSONDecodeError, GroqAPIError):
            pass

    raise GroqAPIError(
        "The model returned malformed JSON."
    )


def generate_quiz(
    source_text: str,
    num_questions: int = 10,
) -> dict:
    """Send text to GroqCloud and return a schema-validated quiz dict."""

    client = _get_client()

    model = os.environ.get(
        "GROQ_MODEL",
        DEFAULT_MODEL,
    )

    prompt = _build_prompt(
        source_text,
        num_questions,
    )

    last_error: Optional[GroqAPIError] = None

    for _attempt in range(MAX_RETRIES + 1):

        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a quiz generator "
                            "that outputs only valid JSON."
                        ),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=0.3,
            )

        except RateLimitError as exc:
            raise GroqAPIError(
                "Groq API rate limit hit — wait a moment and retry."
            ) from exc

        except APITimeoutError as exc:
            raise GroqAPIError(
                "Groq API request timed out."
            ) from exc

        except APIError as exc:
            raise GroqAPIError(
                f"Groq API error: {exc}"
            ) from exc

        except Exception as exc:
            raise GroqAPIError(
                "Could not reach the Groq API."
            ) from exc

        raw = (
            response.choices[0].message.content or ""
        ).strip()

        try:
            return _parse_quiz_json(raw)

        except GroqAPIError as exc:
            last_error = exc

            # Retry once with an explicit correction instruction.
            prompt = (
                f"Your previous response failed validation: {exc}\n\n"
                "Return ONLY the corrected JSON object.\n\n"
                + prompt
            )

    raise GroqAPIError(
        f"Groq returned unusable JSON after retries "
        f"({last_error})."
    )