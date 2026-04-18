from pydantic import BaseModel, field_validator


# ── Request models ────────────────────────────────────────────────────────────

class SubmitGrievanceRequest(BaseModel):
    title:        str
    category:     str
    sub_category: str = ""
    department:   str
    description:  str
    is_anonymous: bool = False

    @field_validator("title", "category", "department", "description")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        if len(v) > 120:
            raise ValueError("Title must be 120 characters or fewer")
        return v

    @field_validator("description")
    @classmethod
    def description_length(cls, v: str) -> str:
        if len(v) > 5000:
            raise ValueError("Description must be 5000 characters or fewer")
        return v


class VoteRequest(BaseModel):
    is_upvote: bool


class FeedbackRequest(BaseModel):
    is_satisfied:  bool
    remarks:       str = ""


# ── Response models ───────────────────────────────────────────────────────────

class ActionHistoryItem(BaseModel):
    grievance_id:     int
    actor:            str
    action:           str
    remarks_ipfs_cid: str
    timestamp:        int
    from_status:      str
    to_status:        str


class GrievanceDetail(BaseModel):
    # On-chain fields
    id:                 int
    student_identifier: str
    is_anonymous:       bool
    category:           str
    sub_category:       str
    department:         str
    ipfs_cid:           str
    status:             str
    created_at:         int
    updated_at:         int
    threshold_deadline: int
    upvotes:            int
    downvotes:          int
    # Off-chain fields (from Firestore cache + IPFS)
    title:              str = ""
    student_name:       str = ""   # empty if anonymous
    action_history:     list[ActionHistoryItem] = []
    tx_hash:            str = ""


class GrievanceListItem(BaseModel):
    """Lightweight version for list views — no action history."""
    id:                 int
    title:              str
    category:           str
    department:         str
    status:             str
    is_anonymous:       bool
    upvotes:            int
    downvotes:          int
    created_at:         int
    threshold_deadline: int
    student_name:       str = ""


class SubmitGrievanceResponse(BaseModel):
    ipfs_cid:     str
    message:      str = "Grievance accepted and queued for blockchain submission."
    grievance_id: int | None = None
    tx_hash:      str | None = None
