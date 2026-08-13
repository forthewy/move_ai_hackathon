import os
import logging
from typing import Optional

logger = logging.getLogger("gemini_service")

def generate_text_with_gemini(prompt: str, system_instruction: Optional[str] = None) -> Optional[str]:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or "MY_GEMINI_API_KEY" in api_key or "YOUR_API_KEY" in api_key:
        logger.info("GEMINI_API_KEY not set or placeholder. Using fallback mode.")
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(
            api_key=api_key,
            http_options={'headers': {'User-Agent': 'aistudio-build'}, 'timeout': 4.0}
        )
        
        config = types.GenerateContentConfig()
        if system_instruction:
            config.system_instruction = system_instruction

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=config,
        )
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}. Falling back to default output.")
        return None
