// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RoleManager
 * @notice Manages role-based access control for the grievance system.
 *         Every participant (student, committee member, HoD, principal, admin)
 *         must be granted a role here before they can interact with GrievanceSystem.
 *
 * Roles:
 *   ADMIN_ROLE       — Institute admin. Can grant/revoke all other roles.
 *   STUDENT_ROLE     — Can submit grievances, vote, give feedback.
 *   COMMITTEE_ROLE   — Can propose and vote on committee actions.
 *   HOD_ROLE         — Can forward, revert, or resolve grievances at HoD level.
 *   PRINCIPAL_ROLE   — Can resolve or revert grievances at Principal level.
 *
 * Deployment:
 *   The deployer is automatically granted ADMIN_ROLE and DEFAULT_ADMIN_ROLE.
 *   The deployer then grants roles to real users via grantRole().
 */
contract RoleManager is AccessControl {
    // ── Role identifiers ────────────────────────────────────────────────────

    bytes32 public constant STUDENT_ROLE   = keccak256("STUDENT_ROLE");
    bytes32 public constant COMMITTEE_ROLE = keccak256("COMMITTEE_ROLE");
    bytes32 public constant HOD_ROLE       = keccak256("HOD_ROLE");
    bytes32 public constant PRINCIPAL_ROLE = keccak256("PRINCIPAL_ROLE");
    bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");

    // ── Events ───────────────────────────────────────────────────────────────

    event RoleGrantedToUser(bytes32 indexed role, address indexed account, address indexed grantor);
    event RoleRevokedFromUser(bytes32 indexed role, address indexed account, address indexed revoker);

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param admin The wallet address of the institute admin (deployer).
     */
    constructor(address admin) {
        // DEFAULT_ADMIN_ROLE can manage all other roles in OpenZeppelin AccessControl
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ── Admin functions ──────────────────────────────────────────────────────

    /**
     * @notice Grant a role to an account. Only callable by DEFAULT_ADMIN_ROLE.
     * @param role    One of the role constants defined above.
     * @param account Wallet address of the user to grant the role to.
     */
    function grantUserRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
        emit RoleGrantedToUser(role, account, msg.sender);
    }

    /**
     * @notice Revoke a role from an account. Only callable by DEFAULT_ADMIN_ROLE.
     * @param role    Role to revoke.
     * @param account Wallet address to revoke from.
     */
    function revokeUserRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(role, account);
        emit RoleRevokedFromUser(role, account, msg.sender);
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns true if the account holds STUDENT_ROLE.
     */
    function isStudent(address account) external view returns (bool) {
        return hasRole(STUDENT_ROLE, account);
    }

    /**
     * @notice Returns true if the account holds COMMITTEE_ROLE.
     */
    function isCommitteeMember(address account) external view returns (bool) {
        return hasRole(COMMITTEE_ROLE, account);
    }

    /**
     * @notice Returns true if the account holds HOD_ROLE.
     */
    function isHoD(address account) external view returns (bool) {
        return hasRole(HOD_ROLE, account);
    }

    /**
     * @notice Returns true if the account holds PRINCIPAL_ROLE.
     */
    function isPrincipal(address account) external view returns (bool) {
        return hasRole(PRINCIPAL_ROLE, account);
    }

    /**
     * @notice Returns true if the account holds ADMIN_ROLE.
     */
    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
}
