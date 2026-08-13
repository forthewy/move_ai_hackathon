import logging
import os
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

logger = logging.getLogger("gemini_service")

T = TypeVar("T", bound=BaseModel)


class GeminiServiceError(RuntimeError):
    """Gemini 설정 또는 호출 실패를 사용자에게 명확히 전달하기 위한 예외."""


def _get_api_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or "MY_GEMINI_API_KEY" in api_key or "YOUR_API_KEY" in api_key:
        raise GeminiServiceError(
            "GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 실제 Gemini API 키를 입력하세요."
        )
    return api_key


def _get_model_name() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip() or "gemini-3.6-flash"


def generate_structured_with_gemini(
    prompt: str,
    response_model: Type[T],
    system_instruction: Optional[str] = None,
) -> T:
    """Gemini Structured Output을 Pydantic 모델로 검증해 반환한다."""

    api_key = _get_api_key()

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=response_model,
        )

        response = client.models.generate_content(
            model=_get_model_name(),
            contents=prompt,
            config=config,
        )

        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, response_model):
            return parsed
        if isinstance(parsed, dict):
            return response_model.model_validate(parsed)
        if response and response.text:
            return response_model.model_validate_json(response.text)

        raise GeminiServiceError("Gemini가 비어 있는 분석 결과를 반환했습니다.")
    except GeminiServiceError:
        raise
    except Exception as exc:
        logger.exception("Gemini structured output failed")
        raise GeminiServiceError(f"Gemini 분석 호출에 실패했습니다: {exc}") from exc


def generate_text_with_gemini(prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
    """사용자가 결과 해설을 요청했을 때만 자유 텍스트를 생성한다."""

    try:
        api_key = _get_api_key()
    except GeminiServiceError:
        logger.info("GEMINI_API_KEY not set. Using existing fallback mode.")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(system_instruction=system_instruction)
        response = client.models.generate_content(
            model=_get_model_name(),
            contents=prompt,
            config=config,
        )
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as exc:
        logger.warning("Gemini text call failed: %s. Falling back to default output.", exc)
        return None
