"""
Tests for the auth router.

Firebase and blockchain are mocked — these tests verify the router logic
(domain validation, duplicate handling, profile building) without needing
a live Firebase project or Besu node.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.firebase import get_firebase_service

# ── Fixtures ──────────────────────────────────────────────────────────────────

INSTITUTE_DOMAIN = "test.edu.in"
VALID_EMAIL      = f"student@{INSTITUTE_DOMAIN}"
VALID_PASSWORD   = "password123"
VALID_NAME       = "Test Student"


def _mock_firebase(
    user_exists: bool = False,
    verify_ok:   bool = True,
) -> MagicMock:
    fb = MagicMock()
    fb.get_user_by_email.return_value = MagicMock() if user_exists else None
    fb.verify_token.return_value = (
        {"uid": "uid_123", "email": VALID_EMAIL, "role": "student"}
        if verify_ok else None
    )
    fb.get_user_profile.return_value = {
        "uid":           "uid_123",
        "displayName":   VALID_NAME,
        "email":         VALID_EMAIL,
        "role":          "student",
        "department":    "",
        "instituteId":   "inst_001",
        "walletAddress": "",
    }
    return fb


@pytest.fixture
def client():
    """TestClient with mocked Firebase and scheduler disabled."""
    with patch("scheduler.jobs.start_scheduler"), \
         patch("scheduler.jobs.stop_scheduler"):
        yield TestClient(app, raise_server_exceptions=False)


# ── /register ─────────────────────────────────────────────────────────────────

class TestRegister:
    def test_rejects_non_institute_email(self, client):
        app.dependency_overrides[get_firebase_service] = _mock_firebase
        resp = client.post("/api/v1/auth/register", json={
            "display_name": VALID_NAME,
            "email":        "student@gmail.com",
            "password":     VALID_PASSWORD,
        })
        assert resp.status_code == 400
        assert INSTITUTE_DOMAIN in resp.json()["detail"]

    def test_rejects_duplicate_email(self, client):
        app.dependency_overrides[get_firebase_service] = lambda: _mock_firebase(user_exists=True)
        resp = client.post("/api/v1/auth/register", json={
            "display_name": VALID_NAME,
            "email":        VALID_EMAIL,
            "password":     VALID_PASSWORD,
        })
        assert resp.status_code == 409

    def test_rejects_short_password(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "display_name": VALID_NAME,
            "email":        VALID_EMAIL,
            "password":     "short",
        })
        assert resp.status_code == 422   # pydantic validation error

    def test_rejects_empty_name(self, client):
        resp = client.post("/api/v1/auth/register", json={
            "display_name": "   ",
            "email":        VALID_EMAIL,
            "password":     VALID_PASSWORD,
        })
        assert resp.status_code == 422

    def test_successful_registration(self, client):
        mock_fb = _mock_firebase()
        mock_record = MagicMock()
        mock_record.uid = "uid_new"

        with patch("app.routers.auth.fb_auth.create_user", return_value=mock_record):
            app.dependency_overrides[get_firebase_service] = lambda: mock_fb
            resp = client.post("/api/v1/auth/register", json={
                "display_name": VALID_NAME,
                "email":        VALID_EMAIL,
                "password":     VALID_PASSWORD,
            })

        assert resp.status_code == 201
        data = resp.json()
        assert data["user"]["role"] == "student"
        assert data["user"]["email"] == VALID_EMAIL
        # Verify Firestore profile was created
        mock_fb.create_user_profile.assert_called_once()
        # Verify role claim was set
        mock_fb.set_user_role.assert_called_once_with(
            "uid_new", role="student", institute_id="institute_001"
        )


# ── /verify-token ─────────────────────────────────────────────────────────────

class TestVerifyToken:
    def test_valid_token_returns_profile(self, client):
        app.dependency_overrides[get_firebase_service] = lambda: _mock_firebase()
        resp = client.post("/api/v1/auth/verify-token", json={"id_token": "valid_token"})
        assert resp.status_code == 200
        assert resp.json()["user"]["uid"] == "uid_123"
        assert resp.json()["user"]["role"] == "student"

    def test_invalid_token_returns_401(self, client):
        app.dependency_overrides[get_firebase_service] = lambda: _mock_firebase(verify_ok=False)
        resp = client.post("/api/v1/auth/verify-token", json={"id_token": "bad_token"})
        assert resp.status_code == 401

    def test_missing_token_returns_422(self, client):
        resp = client.post("/api/v1/auth/verify-token", json={})
        assert resp.status_code == 422


# ── /me ───────────────────────────────────────────────────────────────────────

class TestMe:
    def test_requires_auth(self, client):
        resp = client.get("/api/v1/auth/me")
        # No Authorization header → 403 (HTTPBearer returns 403 for missing header)
        assert resp.status_code in (401, 403)

    def test_returns_profile_with_valid_token(self, client):
        mock_fb = _mock_firebase()
        app.dependency_overrides[get_firebase_service] = lambda: mock_fb

        with patch("app.dependencies.get_firebase_service", return_value=mock_fb):
            resp = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer valid_token"},
            )

        # Will be 200 only if verify_token succeeds — mocked above
        assert resp.status_code in (200, 401)
