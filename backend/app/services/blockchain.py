import asyncio
import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from web3 import Web3
from web3.contract import Contract
from web3.types import TxReceipt

from app.config import get_settings

logger   = logging.getLogger(__name__)
ABIS_DIR = Path(__file__).parent / "abis"

# ── Enum mirrors (must match GrievanceSystem.sol) ────────────────────────────

class GrievanceStatus:
    SUBMITTED          = 0
    AT_COMMITTEE       = 1
    AT_HOD             = 2
    AT_PRINCIPAL       = 3
    AWAITING_FEEDBACK  = 4
    CLOSED             = 5
    DEBARRED           = 6

    _NAMES = {
        0: "Submitted",
        1: "AtCommittee",
        2: "AtHoD",
        3: "AtPrincipal",
        4: "AwaitingFeedback",
        5: "Closed",
        6: "Debarred",
    }

    @classmethod
    def name(cls, value: int) -> str:
        return cls._NAMES.get(value, "Unknown")


class ActionType:
    SUBMIT               = 0
    FORWARD              = 1
    REVERT               = 2
    RESOLVE              = 3
    DEBAR                = 4
    AUTO_FORWARD         = 5
    FEEDBACK_SATISFIED   = 6
    FEEDBACK_UNSATISFIED = 7

    _NAMES = {
        0: "Submit",
        1: "Forward",
        2: "Revert",
        3: "Resolve",
        4: "Debar",
        5: "AutoForward",
        6: "FeedbackSatisfied",
        7: "FeedbackUnsatisfied",
    }

    @classmethod
    def name(cls, value: int) -> str:
        return cls._NAMES.get(value, "Unknown")

    @classmethod
    def from_string(cls, s: str) -> int:
        mapping = {v.lower(): k for k, v in cls._NAMES.items()}
        result = mapping.get(s.lower())
        if result is None:
            raise ValueError(f"Unknown action type: {s}")
        return result


# ── ABI loader ───────────────────────────────────────────────────────────────

def _load_abi(contract_name: str) -> list:
    path = ABIS_DIR / f"{contract_name}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"ABI not found: {path}\n"
            f"Run: cd blockchain && npm run compile && npm run export-abis"
        )
    with open(path) as f:
        return json.load(f)


# ── BlockchainService ────────────────────────────────────────────────────────

class BlockchainService:
    """
    Wraps all Web3.py interactions with the GrievanceSystem smart contract.

    Relay wallet pattern:
        All on-chain transactions are signed by a single backend wallet
        (RELAY_WALLET_PRIVATE_KEY). User identity is verified via Firebase
        token before the relay wallet signs. This means users never need
        MetaMask or any wallet — they just log in with email.

    Async pattern:
        Web3.py calls are synchronous. We wrap them with asyncio.to_thread()
        so they don't block FastAPI's event loop.
    """

    def __init__(self) -> None:
        settings = get_settings()

        self._w3 = Web3(Web3.HTTPProvider(settings.besu_rpc_url))
        if not self._w3.is_connected():
            logger.warning(
                "BlockchainService: cannot connect to node at %s — "
                "blockchain calls will fail until the node is reachable.",
                settings.besu_rpc_url,
            )

        # Relay wallet — signs all transactions
        self._relay_account = self._w3.eth.account.from_key(
            settings.relay_wallet_private_key
        )

        # Contract instances
        self._gs: Contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(settings.contract_grievance_system),
            abi=_load_abi("GrievanceSystem"),
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_and_send(self, fn) -> TxReceipt:
        """
        Build, sign, and broadcast a transaction; wait for the receipt.

        Gas pricing:
          relay_gas_price == 0  → private Besu/Hardhat (free gas)
          relay_gas_price == -1 → auto-detect from the network (testnets / mainnet)
          relay_gas_price >  0  → use the explicit value in wei
        """
        settings  = get_settings()
        gas_price = settings.relay_gas_price
        if gas_price < 0:
            gas_price = self._w3.eth.gas_price   # network estimate

        tx = fn.build_transaction({
            "from":     self._relay_account.address,
            "nonce":    self._w3.eth.get_transaction_count(self._relay_account.address),
            "gas":      500_000,
            "gasPrice": gas_price,
        })
        signed  = self._relay_account.sign_transaction(tx)
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt["status"] != 1:
            raise RuntimeError(f"Transaction failed: {tx_hash.hex()}")

        logger.info("TX %s confirmed (block %s)", tx_hash.hex(), receipt["blockNumber"])
        return receipt

    def _parse_grievance(self, raw: tuple) -> dict:
        """Convert the contract's Grievance struct tuple to a dict."""
        return {
            "id":                raw[0],
            "studentIdentifier": raw[1].hex(),
            "isAnonymous":       raw[2],
            "category":          raw[3],
            "subCategory":       raw[4],
            "department":        raw[5],
            "ipfsCid":           raw[6],
            "status":            GrievanceStatus.name(raw[7]),
            "statusCode":        raw[7],
            "createdAt":         raw[8],
            "updatedAt":         raw[9],
            "thresholdDeadline": raw[10],
            "upvotes":           raw[11],
            "downvotes":         raw[12],
        }

    def _parse_action(self, raw: tuple) -> dict:
        """Convert the contract's GrievanceAction struct tuple to a dict."""
        return {
            "grievanceId":    raw[0],
            "actor":          raw[1],
            "action":         ActionType.name(raw[2]),
            "actionCode":     raw[2],
            "remarksIpfsCid": raw[3],
            "timestamp":      raw[4],
            "fromStatus":     GrievanceStatus.name(raw[5]),
            "toStatus":       GrievanceStatus.name(raw[6]),
        }

    def _get_grievance_id_from_receipt(self, receipt: TxReceipt) -> tuple[int, int]:
        """Parse GrievanceSubmitted event → (grievanceId, thresholdDeadline)."""
        logs = self._gs.events.GrievanceSubmitted().process_receipt(receipt)
        if not logs:
            raise RuntimeError("GrievanceSubmitted event not found in receipt")
        args = logs[0]["args"]
        return int(args["id"]), int(args["thresholdDeadline"])

    # ── Student functions ─────────────────────────────────────────────────────

    async def submit_grievance(
        self,
        category: str,
        sub_category: str,
        department: str,
        ipfs_cid: str,
        is_anonymous: bool,
        student_id: bytes,
    ) -> dict:
        """
        Submit a new grievance on-chain.
        Returns {"grievanceId": int, "txHash": str, "thresholdDeadline": int}.
        """
        fn = self._gs.functions.submitGrievance(
            category, sub_category, department, ipfs_cid, is_anonymous, student_id
        )
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        grievance_id, threshold_deadline = self._get_grievance_id_from_receipt(receipt)
        return {
            "grievanceId":       grievance_id,
            "txHash":            receipt["transactionHash"].hex(),
            "thresholdDeadline": threshold_deadline,
        }

    async def cast_vote(self, grievance_id: int, is_upvote: bool, student_id: bytes) -> dict:
        """Upvote or downvote a grievance. student_id deduplicates per-student."""
        fn      = self._gs.functions.castVote(grievance_id, is_upvote, student_id)
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    async def submit_feedback(
        self,
        grievance_id: int,
        is_satisfied: bool,
        remarks_ipfs_cid: str,
        student_id: bytes,
    ) -> dict:
        """Student submits satisfaction feedback after a resolve action."""
        fn      = self._gs.functions.submitFeedback(
            grievance_id, is_satisfied, remarks_ipfs_cid, student_id
        )
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    # ── Committee functions ───────────────────────────────────────────────────

    async def committee_propose(
        self,
        grievance_id: int,
        action: str,
        remarks_ipfs_cid: str,
        member_id: bytes,
    ) -> dict:
        """
        Relay wallet proposes/votes an action on behalf of a committee member.
        member_id deduplicates per-member voting within the current round.
        """
        action_code = ActionType.from_string(action)
        fn          = self._gs.functions.committeePropose(
            grievance_id, action_code, remarks_ipfs_cid, member_id
        )
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    async def execute_committee_action(self, grievance_id: int) -> dict:
        """Execute the committee's pending action once majority is reached."""
        fn      = self._gs.functions.executeCommitteeAction(grievance_id)
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    # ── HoD functions ─────────────────────────────────────────────────────────

    async def hod_action(
        self,
        grievance_id: int,
        action: str,
        remarks_ipfs_cid: str,
    ) -> dict:
        """
        HoD takes an action: "forward", "revert", or "resolve".
        """
        action_code = ActionType.from_string(action)
        fn          = self._gs.functions.hodAction(grievance_id, action_code, remarks_ipfs_cid)
        receipt     = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    # ── Principal functions ───────────────────────────────────────────────────

    async def principal_action(
        self,
        grievance_id: int,
        action: str,
        remarks_ipfs_cid: str,
    ) -> dict:
        """
        Principal takes an action: "resolve" or "revert".
        """
        action_code = ActionType.from_string(action)
        fn          = self._gs.functions.principalAction(grievance_id, action_code, remarks_ipfs_cid)
        receipt     = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    # ── Admin functions ───────────────────────────────────────────────────────

    async def admin_auto_forward(self, grievance_id: int) -> dict:
        """
        Called by the APScheduler threshold watchdog when a grievance has
        exceeded its deadline without action.
        """
        fn      = self._gs.functions.adminAutoForward(grievance_id)
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    async def set_threshold(self, status_code: int, duration_seconds: int) -> dict:
        """Update the threshold duration for a given level."""
        fn      = self._gs.functions.setThreshold(status_code, duration_seconds)
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    async def set_committee_size(self, size: int) -> dict:
        """Update the committee size used for majority calculation."""
        fn      = self._gs.functions.setCommitteeSize(size)
        receipt = await asyncio.to_thread(self._build_and_send, fn)
        return {"txHash": receipt["transactionHash"].hex()}

    # ── View functions (free — no gas, no relay wallet needed) ───────────────

    async def get_grievance(self, grievance_id: int) -> dict:
        """Fetch grievance data from the contract."""
        def _call() -> dict:
            raw = self._gs.functions.getGrievance(grievance_id).call()
            return self._parse_grievance(raw)
        return await asyncio.to_thread(_call)

    async def get_action_history(self, grievance_id: int) -> list[dict]:
        """Fetch the full on-chain action history for a grievance."""
        def _call() -> list[dict]:
            raw_list = self._gs.functions.getActionHistory(grievance_id).call()
            return [self._parse_action(a) for a in raw_list]
        return await asyncio.to_thread(_call)

    async def get_committee_vote_tally(self, grievance_id: int) -> dict:
        """Get the current committee vote tally for a pending action."""
        def _call() -> dict:
            raw = self._gs.functions.getCommitteeVoteTally(grievance_id).call()
            return {
                "proposedAction": ActionType.name(raw[0]),
                "yesCount":       raw[1],
                "noCount":        raw[2],
                "executed":       raw[3],
                "majorityNeeded": raw[4],
            }
        return await asyncio.to_thread(_call)

    async def get_active_grievance_ids(self) -> list[int]:
        """Return IDs of all non-closed, non-debarred grievances."""
        def _call() -> list[int]:
            return list(self._gs.functions.getActiveGrievanceIds().call())
        return await asyncio.to_thread(_call)

    async def total_grievances(self) -> int:
        """Return the total number of grievances ever submitted."""
        def _call() -> int:
            return self._gs.functions.totalGrievances().call()
        return await asyncio.to_thread(_call)

    async def get_threshold_duration(self, status_code: int) -> int:
        """Return the threshold duration (seconds) for a given status level."""
        def _call() -> int:
            return self._gs.functions.thresholdDuration(status_code).call()
        return await asyncio.to_thread(_call)

    async def is_connected(self) -> bool:
        """Quick connectivity check — useful for the /health endpoint."""
        def _call() -> bool:
            return self._w3.is_connected()
        return await asyncio.to_thread(_call)


# ── Singleton accessor ────────────────────────────────────────────────────────

@lru_cache
def get_blockchain_service() -> BlockchainService:
    """
    Returns a cached BlockchainService instance.
    Use as a FastAPI dependency: bc = Depends(get_blockchain_service)
    """
    return BlockchainService()
