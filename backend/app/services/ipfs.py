import logging
from functools import lru_cache
from typing import IO

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

PINATA_PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"
PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"

# Supported MIME types for grievance attachments
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024   # 10 MB per file
MAX_FILES_PER_GRIEVANCE = 5


class IPFSService:
    """
    Wraps the Pinata API for decentralised file storage on IPFS.

    Two upload paths:
      1. Grievance content — title, description, metadata bundled as JSON
         and pinned as a single CID.  This CID is stored on-chain.
      2. Remark / resolution documents — same pattern, called when an
         authority attaches a document to their action.

    Retrieval is via the Pinata public gateway (free).
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._headers = {
            "pinata_api_key":        settings.pinata_api_key,
            "pinata_secret_api_key": settings.pinata_secret_key,
        }
        self._gateway = settings.pinata_gateway.rstrip("/")

    # ── Upload helpers ────────────────────────────────────────────────────────

    async def _pin_json(self, payload: dict, pin_name: str) -> str:
        """
        Pin a JSON payload to IPFS via Pinata.
        Returns the IPFS CID (content identifier) string.
        """
        body = {
            "pinataContent":  payload,
            "pinataMetadata": {"name": pin_name},
            "pinataOptions":  {"cidVersion": 1},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                PINATA_PIN_JSON_URL,
                json=body,
                headers=self._headers,
            )
            resp.raise_for_status()
            cid = resp.json()["IpfsHash"]
            logger.info("Pinned JSON to IPFS: %s (%s)", cid, pin_name)
            return cid

    async def _pin_file(self, file_bytes: bytes, filename: str, mime_type: str) -> str:
        """
        Pin a single file to IPFS via Pinata.
        Returns the IPFS CID.
        """
        files   = {"file": (filename, file_bytes, mime_type)}
        metadata = {"name": filename}

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                PINATA_PIN_FILE_URL,
                files=files,
                data={"pinataMetadata": str(metadata)},
                headers=self._headers,
            )
            resp.raise_for_status()
            cid = resp.json()["IpfsHash"]
            logger.info("Pinned file to IPFS: %s (%s)", cid, filename)
            return cid

    # ── Validation ────────────────────────────────────────────────────────────

    @staticmethod
    def validate_files(
        files: list[tuple[str, bytes, str]],
    ) -> None:
        """
        Validate a list of (filename, content_bytes, mime_type) tuples.
        Raises ValueError with a clear message on any violation.
        """
        if len(files) > MAX_FILES_PER_GRIEVANCE:
            raise ValueError(
                f"Too many attachments: max {MAX_FILES_PER_GRIEVANCE}, got {len(files)}."
            )
        for filename, content, mime_type in files:
            if mime_type not in ALLOWED_MIME_TYPES:
                raise ValueError(
                    f"File '{filename}' has unsupported type '{mime_type}'. "
                    f"Allowed: PDF, JPG, PNG, WEBP, DOCX."
                )
            if len(content) > MAX_FILE_SIZE_BYTES:
                raise ValueError(
                    f"File '{filename}' exceeds 10 MB limit "
                    f"({len(content) / 1_048_576:.1f} MB)."
                )

    # ── Public API ────────────────────────────────────────────────────────────

    async def upload_grievance_content(
        self,
        title: str,
        description: str,
        category: str,
        sub_category: str,
        department: str,
        student_uid_hash: str,
        attachments: list[tuple[str, bytes, str]] | None = None,
    ) -> str:
        """
        Package grievance content + attachments into a single IPFS object.

        Steps:
          1. Upload each attachment file and collect its CID.
          2. Bundle everything into a metadata JSON and pin it.
          3. Return the metadata CID — this is what goes on-chain.

        Parameters:
          attachments: list of (filename, file_bytes, mime_type) tuples.

        Returns:
          IPFS CID string for the grievance content bundle.
        """
        attachment_cids: list[dict] = []

        if attachments:
            self.validate_files(attachments)
            for filename, content, mime_type in attachments:
                cid = await self._pin_file(content, filename, mime_type)
                attachment_cids.append({
                    "filename": filename,
                    "mimeType": mime_type,
                    "cid":      cid,
                    "url":      f"{self._gateway}/ipfs/{cid}",
                })

        payload = {
            "title":          title,
            "description":    description,
            "category":       category,
            "subCategory":    sub_category,
            "department":     department,
            "studentUidHash": student_uid_hash,   # hashed — not raw UID
            "attachments":    attachment_cids,
        }

        return await self._pin_json(payload, pin_name=f"grievance-{title[:40]}")

    async def upload_remark(
        self,
        remarks_text: str,
        actor_role: str,
        grievance_id: int,
        attachments: list[tuple[str, bytes, str]] | None = None,
    ) -> str:
        """
        Upload an authority's remark / resolution document to IPFS.
        Returns the CID stored as remarksIpfsCid in the on-chain action log.
        """
        attachment_cids: list[dict] = []

        if attachments:
            self.validate_files(attachments)
            for filename, content, mime_type in attachments:
                cid = await self._pin_file(content, filename, mime_type)
                attachment_cids.append({
                    "filename": filename,
                    "mimeType": mime_type,
                    "cid":      cid,
                    "url":      f"{self._gateway}/ipfs/{cid}",
                })

        payload = {
            "grievanceId": grievance_id,
            "actorRole":   actor_role,
            "remarks":     remarks_text,
            "attachments": attachment_cids,
        }

        return await self._pin_json(
            payload,
            pin_name=f"remark-grievance-{grievance_id}-{actor_role}",
        )

    async def retrieve(self, cid: str) -> dict:
        """
        Fetch a previously pinned JSON object from IPFS via the Pinata gateway.
        Returns the parsed dict.
        Raises httpx.HTTPStatusError if the CID is not found.
        """
        url = f"{self._gateway}/ipfs/{cid}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    def attachment_url(self, cid: str) -> str:
        """Return the public gateway URL for a file CID."""
        return f"{self._gateway}/ipfs/{cid}"


# ── Singleton accessor ────────────────────────────────────────────────────────

@lru_cache
def get_ipfs_service() -> IPFSService:
    """
    Returns a cached IPFSService instance.
    Use as a FastAPI dependency: ipfs = Depends(get_ipfs_service)
    """
    return IPFSService()
