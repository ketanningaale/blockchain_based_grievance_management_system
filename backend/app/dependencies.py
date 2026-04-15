from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import Settings, get_settings
from app.services.firebase import FirebaseService, get_firebase_service

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    firebase: FirebaseService = Depends(get_firebase_service),
) -> dict:
    """
    Dependency that:
      1. Extracts the Bearer token from the Authorization header
      2. Verifies it with Firebase Admin SDK
      3. Returns the decoded token dict (contains uid, email, custom claims)

    Usage in a router:
        @router.get("/me")
        async def me(user: dict = Depends(get_current_user)):
            return {"uid": user["uid"]}
    """
    token = credentials.credentials
    decoded = firebase.verify_token(token)
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    return decoded


def require_role(*roles: str):
    """
    Dependency factory that enforces one or more roles on a route.

    Usage:
        @router.post("/action")
        async def action(user: dict = Depends(require_role("committee", "admin"))):
            ...
    """
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "")
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}. Your role: {user_role}",
            )
        return user
    return _check
