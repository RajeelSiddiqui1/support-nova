import sys
import os
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
import pytest

# Ensure server module is in sys.path
SERVER_DIR = Path(__file__).resolve().parent.parent / "server"
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from services.config_service import ConfigService


@pytest.fixture
def mock_db():
    """Provides an AsyncMock MongoDB database with pre-configured collections."""
    db = MagicMock()
    
    # Mock find_one, find, aggregate, count_documents, insert_one, update_one
    db.tickets = MagicMock()
    db.tickets.find_one = AsyncMock(return_value=None)
    db.tickets.count_documents = AsyncMock(return_value=0)
    db.tickets.insert_one = AsyncMock()
    db.tickets.update_one = AsyncMock()
    
    cursor_mock = MagicMock()
    cursor_mock.to_list = AsyncMock(return_value=[])
    cursor_mock.sort = MagicMock(return_value=cursor_mock)
    cursor_mock.limit = MagicMock(return_value=cursor_mock)
    cursor_mock.skip = MagicMock(return_value=cursor_mock)
    
    db.tickets.find = MagicMock(return_value=cursor_mock)
    db.tickets.aggregate = MagicMock(return_value=cursor_mock)
    
    db.app_configs = MagicMock()
    db.app_configs.find_one = AsyncMock(return_value=None)
    db.app_configs.update_one = AsyncMock()
    
    db.system_audit_logs = MagicMock()
    db.system_audit_logs.insert_one = AsyncMock()
    db.system_audit_logs.find = MagicMock(return_value=cursor_mock)
    db.system_audit_logs.count_documents = AsyncMock(return_value=0)
    
    db.knowledge_base = MagicMock()
    db.knowledge_base.find_one = AsyncMock(return_value=None)
    db.knowledge_base.find = MagicMock(return_value=cursor_mock)
    
    db.genai_failures = MagicMock()
    db.genai_failures.insert_one = AsyncMock()
    
    return db


@pytest.fixture
def mock_groq_client(monkeypatch):
    """Mocks GroqClient to prevent any external LLM network calls."""
    from ai.groq_client import GroqClient
    
    mock_analyze = AsyncMock()
    monkeypatch.setattr(GroqClient, "analyze_complaint", mock_analyze)
    return mock_analyze


@pytest.fixture
def default_configs():
    """Provides baseline application configurations from ConfigService."""
    return {
        "adversarial_rules": ConfigService.DEFAULT_ADVERSARIAL_RULES,
        "escalation_rules": ConfigService.DEFAULT_ESCALATION_RULES,
        "verification_weights": ConfigService.DEFAULT_VERIFICATION_WEIGHTS,
        "category_required_fields": ConfigService.DEFAULT_REQUIRED_FIELDS
    }
