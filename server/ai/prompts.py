"""
NovaWear SupportNova — Versioned Prompt Templates Store.
Centralized storage for all GenAI prompt templates with backwards-compatibility aliases.
"""

from ai.prompt_service import PromptService, DEFAULT_PROMPT_TEMPLATES

# Backwards-compatible constants pulling from versioned store
PROMPT_SYSTEM_MAIN_V1 = DEFAULT_PROMPT_TEMPLATES["complaint_extraction_main"]["text"]
PROMPT_GENERATE_FOLLOW_UP_V1 = DEFAULT_PROMPT_TEMPLATES["follow_up_generator"]["text"]
PROMPT_GENERATE_CLARIFICATION_QUESTIONS_V1 = DEFAULT_PROMPT_TEMPLATES["clarification_generator"]["text"]
PROMPT_GENERATE_COMPLAINT_SUMMARY_V1 = DEFAULT_PROMPT_TEMPLATES["complaint_summary_generator"]["text"]
PROMPT_GENERATE_ESCALATION_NOTES_V1 = DEFAULT_PROMPT_TEMPLATES["escalation_notes_generator"]["text"]

__all__ = [
    "PromptService",
    "DEFAULT_PROMPT_TEMPLATES",
    "PROMPT_SYSTEM_MAIN_V1",
    "PROMPT_GENERATE_FOLLOW_UP_V1",
    "PROMPT_GENERATE_CLARIFICATION_QUESTIONS_V1",
    "PROMPT_GENERATE_COMPLAINT_SUMMARY_V1",
    "PROMPT_GENERATE_ESCALATION_NOTES_V1"
]
