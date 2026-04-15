from pydantic import BaseModel, field_validator

VALID_COMMITTEE_ACTIONS  = {"forward", "resolve", "debar"}
VALID_HOD_ACTIONS        = {"forward", "revert", "resolve"}
VALID_PRINCIPAL_ACTIONS  = {"resolve", "revert"}


class AuthorityActionRequest(BaseModel):
    """Shared request model for committee propose, HoD action, Principal action."""
    action:  str
    remarks: str = ""

    @field_validator("action")
    @classmethod
    def lowercase_action(cls, v: str) -> str:
        return v.strip().lower()


class ActionResponse(BaseModel):
    tx_hash:    str
    new_status: str
    message:    str


# ── Admin models ──────────────────────────────────────────────────────────────

VALID_ROLES = {"student", "committee", "hod", "principal", "admin"}


class AssignRoleRequest(BaseModel):
    role:       str
    department: str = ""

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of: {', '.join(VALID_ROLES)}")
        return v


class ThresholdUpdateRequest(BaseModel):
    committee_days:  int | None = None
    hod_days:        int | None = None
    principal_days:  int | None = None

    @field_validator("committee_days", "hod_days", "principal_days", mode="before")
    @classmethod
    def positive(cls, v):
        if v is not None and v < 1:
            raise ValueError("Threshold must be at least 1 day")
        return v


class AddDepartmentRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Department name cannot be empty")
        return v.strip()
