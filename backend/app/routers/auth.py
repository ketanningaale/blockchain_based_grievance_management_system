import logging

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as fb_auth

from app.config import Settings, get_settings
from app.dependencies import get_current_user
from app.models.user import AuthResponse, RegisterRequest, UpdateProfileRequest, UserProfile, VerifyTokenRequest
from app.services.firebase import FirebaseService, get_firebase_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_institute_email(email: str, settings: Settings) -> None:
    """
    Reject registrations from outside the institute's email domain.
    Raises HTTPException 400 if the domain does not match.
    """
    domain = email.split("@")[-1].lower()
    allowed = settings.institute_email_domain.lower()
    if domain != allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration is only open to @{allowed} email addresses.",
        )


def _build_profile(uid: str, decoded_token: dict, fb: FirebaseService) -> UserProfile:
    """
    Fetch the Firestore profile for a user and merge with token claims.
    Returns a UserProfile ready to send to the frontend.
    """
    profile = fb.get_user_profile(uid)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please contact the admin.",
        )
    return UserProfile(
        uid=uid,
        display_name=profile.get("displayName", ""),
        email=profile.get("email", ""),
        role=decoded_token.get("role", profile.get("role", "student")),
        department=profile.get("department", ""),
        institute_id=profile.get("instituteId", ""),
        wallet_address=profile.get("walletAddress", ""),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new student account",
)
async def register(
    body:     RegisterRequest,
    fb:       FirebaseService = Depends(get_firebase_service),
    settings: Settings        = Depends(get_settings),
) -> AuthResponse:
    """
    Create a new Firebase Auth user and Firestore profile.

    Rules:
    - Email must belong to the institute's configured domain.
    - Default role is 'student'. Admins upgrade roles separately.
    - If the email is already registered, returns 409.
    """
    _validate_institute_email(body.email, settings)

    # Check for existing account
    if fb.get_user_by_email(body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # Create Firebase Auth user
    try:
        user_record = fb_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.display_name,
        )
    except fb_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    except Exception as exc:
        logger.error("Firebase create_user failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create account. Please try again.",
        )

    uid = user_record.uid

    # Set default role claim
    fb.set_user_role(uid, role="student", institute_id=settings.institute_id)

    # Create Firestore profile
    fb.create_user_profile(
        uid=uid,
        display_name=body.display_name,
        email=body.email,
        role="student",
        department=body.department,
        institute_id=settings.institute_id,
    )

    logger.info("New student registered: %s (%s)", uid, body.email)

    return AuthResponse(
        user=UserProfile(
            uid=uid,
            display_name=body.display_name,
            email=body.email,
            role="student",
            department=body.department,
            institute_id=settings.institute_id,
        ),
        message="Account created. You can now log in.",
    )


@router.post(
    "/verify-token",
    response_model=AuthResponse,
    summary="Verify a Firebase ID token and return the user profile",
)
async def verify_token(
    body: VerifyTokenRequest,
    fb:   FirebaseService = Depends(get_firebase_service),
) -> AuthResponse:
    """
    Called by the frontend immediately after Firebase login.
    Validates the token and returns the full user profile + role.

    The frontend stores the role from this response to decide which
    dashboard to render (student / committee / hod / principal / admin).
    """
    decoded = fb.verify_token(body.id_token)
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    uid     = decoded["uid"]
    profile = _build_profile(uid, decoded, fb)

    return AuthResponse(user=profile, message="Token verified.")


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the current authenticated user's profile",
)
async def me(
    current_user: dict            = Depends(get_current_user),
    fb:           FirebaseService = Depends(get_firebase_service),
) -> UserProfile:
    """
    Returns the profile of the currently authenticated user.
    Requires a valid Bearer token in the Authorization header.
    """
    return _build_profile(current_user["uid"], current_user, fb)


@router.patch(
    "/me",
    response_model=UserProfile,
    summary="Update the current user's profile",
)
async def update_me(
    body:         UpdateProfileRequest,
    current_user: dict            = Depends(get_current_user),
    fb:           FirebaseService = Depends(get_firebase_service),
) -> UserProfile:
    """
    Allows a user to update their own display name, department, or
    wallet address. Role and institute_id cannot be changed by the user.
    """
    uid     = current_user["uid"]
    updates = {}

    if body.display_name is not None:
        if not body.display_name.strip():
            raise HTTPException(status_code=400, detail="display_name cannot be empty.")
        updates["displayName"] = body.display_name.strip()
        # Keep Firebase Auth display name in sync
        fb_auth.update_user(uid, display_name=body.display_name.strip())

    if body.department is not None:
        updates["department"] = body.department

    if body.wallet_address is not None:
        updates["walletAddress"] = body.wallet_address

    if updates:
        fb.update_user_profile(uid, updates)

    return _build_profile(uid, current_user, fb)
