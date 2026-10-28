"""음성 브리핑. 기본은 무료 edge-tts (pip install edge-tts). 본선에서 상용 TTS로 바꿀 수 있습니다."""
from __future__ import annotations

import asyncio

VOICE = "ko-KR-SunHiNeural"


def synthesize(text: str, path: str = "briefing.mp3", voice: str = VOICE) -> str:
    try:
        import edge_tts  # type: ignore
    except ImportError as e:
        raise RuntimeError("음성 브리핑에는 edge-tts 가 필요합니다: pip install edge-tts") from e

    async def _run():
        await edge_tts.Communicate(text, voice).save(path)

    asyncio.run(_run())
    return path
