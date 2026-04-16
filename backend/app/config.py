from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    All configuration loaded from environment variables (or .env file).
    Pydantic validates types on startup — the app will refuse to start if a
    required variable is missing or has the wrong type.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    secret_key: str = "change-me"
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    # ── Blockchain ────────────────────────────────────────────────────────────
    besu_rpc_url: str = "http://127.0.0.1:8545"
    relay_wallet_private_key: str
    contract_role_manager: str
    contract_grievance_system: str
    # Set to 0 for private Besu/Hardhat (free gas).
    # Leave at -1 (default) to auto-detect from the network (required for testnets).
    relay_gas_price: int = -1

    # ── Firebase ──────────────────────────────────────────────────────────────
    firebase_project_id: str
    firebase_private_key_id: str = ""
    firebase_private_key: str = ""
    firebase_client_email: str = ""
    firebase_client_id: str = ""
    firebase_client_cert_url: str = ""

    # Institute settings stored in Firebase but also needed at startup
    institute_email_domain: str = "institute.edu.in"
    institute_id: str = "institute_001"

    # ── Pinata (IPFS) ─────────────────────────────────────────────────────────
    pinata_api_key: str = ""
    pinata_secret_key: str = ""
    pinata_gateway: str = "https://gateway.pinata.cloud"

    # ── SendGrid ──────────────────────────────────────────────────────────────
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "grievance@institute.edu.in"
    sendgrid_from_name: str = "Grievance Portal"

    # ── APScheduler ───────────────────────────────────────────────────────────
    threshold_check_interval_minutes: int = 30

    @property
    def firebase_credentials_dict(self) -> dict:
        """
        Build the Firebase service account dict from individual env vars.
        This avoids needing to put a JSON file on the server.
        """
        return {
            "type": "service_account",
            "project_id": self.firebase_project_id,
            "private_key_id": self.firebase_private_key_id,
            # .env stores \n as literal \n — replace back to real newlines
            "private_key": self.firebase_private_key.replace("\\n", "\n"),
            "client_email": self.firebase_client_email,
            "client_id": self.firebase_client_id,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_x509_cert_url": self.firebase_client_cert_url,
        }


@lru_cache
def get_settings() -> Settings:
    """
    Returns a cached Settings instance.
    Use as a FastAPI dependency: settings = Depends(get_settings)
    Or import directly: from app.config import get_settings; s = get_settings()
    """
    return Settings()
