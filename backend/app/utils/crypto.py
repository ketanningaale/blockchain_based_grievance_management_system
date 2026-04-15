from web3 import Web3


def hash_student_id(uid: str) -> bytes:
    """
    Compute keccak256(abi.encodePacked(uid)) — mirrors the on-chain
    studentIdentifier calculation in GrievanceSystem.sol.

    The contract stores keccak256(abi.encodePacked(msg.sender)) where
    msg.sender is the relay wallet. Since the relay wallet submits on
    behalf of the student, we hash the Firebase UID instead to get a
    stable, unique identifier per student that matches the Firestore record.

    Note: the relay wallet address is the same for all students, so we
    cannot use msg.sender alone. The Firebase UID is hashed off-chain
    and stored alongside the on-chain record in Firestore for lookups.
    """
    return Web3.keccak(text=uid)


def hash_student_id_hex(uid: str) -> str:
    """Return the hex string form of the student ID hash (with 0x prefix)."""
    return hash_student_id(uid).hex()
