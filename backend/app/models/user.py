from pydantic import BaseModel, EmailStr, field_validator


# ── Request models ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    display_name: str
    email:        EmailStr
    password:     str
    department:   str = ""   # required for committee/HoD — optional for students at signup

    @field_validator("display_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("display_name cannot be empty")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class VerifyTokenRequest(BaseModel):
    id_token: str


class UpdateProfileRequest(BaseModel):
    display_name:   str | None = None
    department:     str | None = None
    wallet_address: str | None = None


# ── Response models ───────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    uid:            str
    display_name:   str
    email:          str
    role:           str
    department:     str
    institute_id:   str
    wallet_address: str = ""


class AuthResponse(BaseModel):
    user:    UserProfile
    message: str = "Success"
