import pytest
import sys
import os

# Add backend dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


@pytest.fixture
async def client():
    """Async test client for FastAPI app. Requires all backend dependencies."""
    from httpx import AsyncClient, ASGITransport
    from main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
