"""LLM 연결. API 키가 없으면 None 을 돌려주고, Agent는 템플릿 작성기로 동작합니다."""
from __future__ import annotations

from typing import Any

from .config import Settings, get_settings


class AnthropicLLM:
    def __init__(self, settings: Settings | None = None):
        import anthropic  # 지연 import: 키가 없을 때도 패키지가 동작하도록

        self.s = settings or get_settings()
        self.client = anthropic.Anthropic(api_key=self.s.anthropic_api_key)

    def create(self, system: str, messages: list[dict], tools: list[dict] | None = None) -> Any:
        kwargs: dict[str, Any] = dict(model=self.s.llm_model, max_tokens=self.s.llm_max_tokens, system=system, messages=messages)
        if tools:
            kwargs["tools"] = tools
        return self.client.messages.create(**kwargs)

    def complete(self, system: str, prompt: str) -> str:
        resp = self.create(system, [{"role": "user", "content": prompt}])
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def get_llm(settings: Settings | None = None):
    s = settings or get_settings()
    if not s.anthropic_api_key:
        return None
    try:
        return AnthropicLLM(s)
    except ImportError:
        return None
