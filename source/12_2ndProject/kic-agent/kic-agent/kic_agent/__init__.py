"""KIC AI Agent: 애널리스트 보조(전문가 모드) + 입문자 가이드(가이드 모드) 리서치 Agent."""
from .agent import CompanyNotFound, ResearchAgent
from .modes import Mode

__all__ = ["ResearchAgent", "Mode", "CompanyNotFound"]
__version__ = "0.1.0"
