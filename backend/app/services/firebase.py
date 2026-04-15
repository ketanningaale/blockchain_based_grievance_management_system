# Stub — full implementation in Step 7 (Firebase service)
from functools import lru_cache


class FirebaseService:
    def verify_token(self, token: str) -> dict | None:
        raise NotImplementedError("FirebaseService not yet implemented")


@lru_cache
def get_firebase_service() -> FirebaseService:
    return FirebaseService()
