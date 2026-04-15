// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RoleManager.sol";
import "./GrievanceSystem.sol";

/**
 * @title GrievanceFactory
 * @notice Deploys a fresh RoleManager + GrievanceSystem pair for each institute.
 *         The deployer of this factory can onboard multiple institutes from one
 *         contract without redeploying the core logic.
 *
 * Usage:
 *   1. Deploy GrievanceFactory once.
 *   2. For each institute, call createInstitute(adminAddress, instituteName).
 *   3. The factory emits InstituteCreated with the two new contract addresses.
 *   4. Store these addresses in Firebase and the backend .env for that institute.
 */
contract GrievanceFactory {

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Institute {
        string          name;
        address         admin;
        address         roleManager;
        address         grievanceSystem;
        uint256         createdAt;
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    address public immutable factoryOwner;

    // Sequential institute IDs starting from 1
    uint256 private _instituteCounter;

    // instituteId → Institute
    mapping(uint256 => Institute) private _institutes;

    // admin address → instituteId (for quick lookup)
    mapping(address => uint256) public adminToInstituteId;

    // ── Events ───────────────────────────────────────────────────────────────

    event InstituteCreated(
        uint256 indexed instituteId,
        string  name,
        address indexed admin,
        address roleManager,
        address grievanceSystem
    );

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        factoryOwner = msg.sender;
    }

    // ── External functions ───────────────────────────────────────────────────

    /**
     * @notice Deploy a new RoleManager + GrievanceSystem for an institute.
     * @param admin         Wallet address of the institute's admin.
     * @param instituteName Human-readable name (stored for reference).
     * @return instituteId  Sequential ID of the new institute.
     */
    function createInstitute(address admin, string calldata instituteName)
        external
        returns (uint256 instituteId)
    {
        require(msg.sender == factoryOwner, "Factory: only owner can create institutes");
        require(admin != address(0), "Factory: invalid admin address");
        require(bytes(instituteName).length > 0, "Factory: name required");
        require(adminToInstituteId[admin] == 0, "Factory: admin already has an institute");

        // Deploy RoleManager — admin gets DEFAULT_ADMIN_ROLE + ADMIN_ROLE
        RoleManager rm = new RoleManager(admin);

        // Deploy GrievanceSystem — references the RoleManager
        GrievanceSystem gs = new GrievanceSystem(address(rm), admin);

        _instituteCounter++;
        instituteId = _instituteCounter;

        _institutes[instituteId] = Institute({
            name:            instituteName,
            admin:           admin,
            roleManager:     address(rm),
            grievanceSystem: address(gs),
            createdAt:       block.timestamp
        });

        adminToInstituteId[admin] = instituteId;

        emit InstituteCreated(instituteId, instituteName, admin, address(rm), address(gs));
    }

    // ── View functions ───────────────────────────────────────────────────────

    /**
     * @notice Get institute details by ID.
     */
    function getInstitute(uint256 instituteId) external view returns (Institute memory) {
        require(instituteId > 0 && instituteId <= _instituteCounter, "Factory: institute not found");
        return _institutes[instituteId];
    }

    /**
     * @notice Total number of institutes registered.
     */
    function totalInstitutes() external view returns (uint256) {
        return _instituteCounter;
    }
}
