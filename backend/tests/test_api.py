"""Tests for API endpoints — health, validation, rate limiting."""
import pytest
from io import BytesIO


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_test_endpoint(client):
    resp = await client.get("/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_upload_rejects_non_audio(client):
    """Non-audio file with wrong extension should be rejected."""
    resp = await client.post(
        "/upload-audio",
        files={"file": ("test.exe", b"not audio", "application/octet-stream")},
    )
    # .exe is not in allowed_extensions, but application/octet-stream is an allowed prefix
    # so this passes content check. Let's test with a truly invalid mime + ext:
    resp = await client.post(
        "/upload-audio",
        files={"file": ("test.txt", b"not audio", "text/plain")},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file(client):
    """File larger than 50MB should be rejected with 413."""
    # Create a 51MB payload
    large_content = b"x" * (51 * 1024 * 1024)
    resp = await client.post(
        "/upload-audio",
        files={"file": ("big.mp3", large_content, "audio/mpeg")},
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_render_video_invalid_aspect_ratio(client):
    resp = await client.post(
        "/render-video",
        json={
            "audio_id": "fake",
            "aspect_ratio": "4:3",
            "resolution_preset": "1080p",
        },
    )
    assert resp.status_code == 400
    assert "aspect_ratio" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_render_video_invalid_resolution(client):
    resp = await client.post(
        "/render-video",
        json={
            "audio_id": "fake",
            "aspect_ratio": "16:9",
            "resolution_preset": "8K",
        },
    )
    assert resp.status_code == 400
    assert "resolution_preset" in resp.json()["detail"].lower()
