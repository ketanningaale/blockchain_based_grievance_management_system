// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./RoleManager.sol";

/**
 * @title GrievanceSystem
 * @notice Core contract for the blockchain-based grievance redressal system.
 *
 * Flow:
 *   Student submits → Committee votes (resolve / forward / debar)
 *   → HoD acts (resolve / forward / revert)
 *   → Principal acts (resolve / revert)
 *   → Student gives feedback (satisfied → CLOSED | unsatisfied → back to Committee)
 *
 * Every state change is recorded as an immutable GrievanceAction on-chain.
 * The APScheduler watchdog in the backend calls adminAutoForward() when a
 * grievance exceeds its threshold deadline without action.
 */
contract GrievanceSystem is ReentrancyGuard, Pausable {

    // ── References ───────────────────────────────────────────────────────────

    RoleManager public immutable roleManager;

    // ── Enums ────────────────────────────────────────────────────────────────

    enum GrievanceStatus {
        Submitted,          // 0  Just created, entering the system
        AtCommittee,        // 1  Under committee review
        AtHoD,              // 2  Escalated to Head of Department
        AtPrincipal,        // 3  Escalated to Principal
        AwaitingFeedback,   // 4  Resolved — waiting for student satisfaction response
        Closed,             // 5  Student satisfied — final closed state
        Debarred            // 6  Rejected by committee — final rejected state
    }

    enum ActionType {
        Submit,
        Forward,
        Revert,
        Resolve,
        Debar,
        AutoForward,        // Triggered by backend watchdog when threshold exceeded
        FeedbackSatisfied,
        FeedbackUnsatisfied
    }

    // ── Structs ──────────────────────────────────────────────────────────────

    struct Grievance {
        uint256 id;
        bytes32 studentIdentifier;  // keccak256(studentUID) — keeps identity off-chain
        bool    isAnonymous;        // if true, frontend shows "Anonymous User"
        string  category;
        string  subCategory;
        string  department;         // routes grievance to the correct HoD
        string  ipfsCid;            // IPFS CID pointing to title + description + attachments
        GrievanceStatus status;
        uint256 createdAt;
        uint256 updatedAt;
        uint256 thresholdDeadline;  // unix timestamp — watchdog fires after this
        uint256 upvotes;
        uint256 downvotes;
    }

    struct GrievanceAction {
        uint256         grievanceId;
        address         actor;
        ActionType      action;
        string          remarksIpfsCid; // IPFS CID of the remark / resolution document
        uint256         timestamp;
        GrievanceStatus fromStatus;
        GrievanceStatus toStatus;
    }

    // Tracks committee votes for a pending action on a specific grievance
    struct CommitteeVote {
        ActionType          proposedAction;
        string              remarksIpfsCid;
        uint256             yesCount;
        uint256             noCount;
        bool                executed;
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    uint256 private _grievanceCounter;

    // grievanceId → Grievance
    mapping(uint256 => Grievance) private _grievances;

    // grievanceId → list of actions (audit trail)
    mapping(uint256 => GrievanceAction[]) private _actionHistory;

    // grievanceId → CommitteeVote (only one pending vote per grievance at a time)
    mapping(uint256 => CommitteeVote) private _committeeVotes;

    // grievanceId → round counter; incremented each time a proposal is reset
    // so old hasVoted entries become unreachable without needing to delete mappings
    mapping(uint256 => uint256) private _voteRound;

    // grievanceId → round → voter → hasVoted
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) private _hasVotedInRound;

    // grievanceId → voter address → voted (prevents double voting on upvote/downvote)
    mapping(uint256 => mapping(address => bool)) private _hasVotedOnGrievance;

    // Active grievance IDs — used by the backend watchdog to check deadlines
    uint256[] private _activeGrievanceIds;
    mapping(uint256 => uint256) private _activeIndex; // id → index in _activeGrievanceIds

    // Threshold durations per status level (seconds). Configurable by admin.
    mapping(GrievanceStatus => uint256) public thresholdDuration;

    // Total committee members count — used to compute majority
    // Updated by admin whenever committee membership changes
    uint256 public committeeSize;

    // ── Events ───────────────────────────────────────────────────────────────

    event GrievanceSubmitted(
        uint256 indexed id,
        bytes32 indexed studentIdentifier,
        string department,
        string ipfsCid,
        uint256 thresholdDeadline
    );

    event GrievanceActionLogged(
        uint256 indexed grievanceId,
        address indexed actor,
        ActionType action,
        GrievanceStatus fromStatus,
        GrievanceStatus toStatus,
        uint256 timestamp
    );

    event CommitteeVoteCast(
        uint256 indexed grievanceId,
        address indexed voter,
        ActionType proposedAction,
        bool inFavor,
        uint256 yesCount,
        uint256 noCount
    );

    event ThresholdUpdated(GrievanceStatus indexed level, uint256 newDuration);
    event CommitteeSizeUpdated(uint256 newSize);

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(roleManager.isAdmin(msg.sender), "GS: caller is not admin");
        _;
    }

    modifier onlyStudent() {
        require(roleManager.isStudent(msg.sender), "GS: caller is not a student");
        _;
    }

    modifier onlyCommittee() {
        require(roleManager.isCommitteeMember(msg.sender), "GS: caller is not committee member");
        _;
    }

    modifier onlyHoD() {
        require(roleManager.isHoD(msg.sender), "GS: caller is not HoD");
        _;
    }

    modifier onlyPrincipal() {
        require(roleManager.isPrincipal(msg.sender), "GS: caller is not Principal");
        _;
    }

    modifier grievanceExists(uint256 id) {
        require(id > 0 && id <= _grievanceCounter, "GS: grievance does not exist");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _roleManager  Address of the deployed RoleManager contract.
     * @param _adminAddress Address of the institute admin (for initial threshold setup).
     */
    constructor(address _roleManager, address _adminAddress) {
        roleManager   = RoleManager(_roleManager);

        // Default threshold durations
        thresholdDuration[GrievanceStatus.AtCommittee]  = 7 days;
        thresholdDuration[GrievanceStatus.AtHoD]        = 5 days;
        thresholdDuration[GrievanceStatus.AtPrincipal]  = 3 days;

        // Default committee size — admin should update this to the real number
        committeeSize = 3;

        // Silence unused variable warning; admin is managed via RoleManager
        _adminAddress;
    }

    // ── Student functions ────────────────────────────────────────────────────

    /**
     * @notice Submit a new grievance. Immediately moves to AtCommittee.
     * @param category    Top-level category (e.g. "Academic").
     * @param subCategory Sub-category (e.g. "Exam Related").
     * @param department  Department name — routes to the correct HoD.
     * @param ipfsCid     IPFS CID of the grievance content JSON.
     * @param isAnonymous If true, identity is hidden from authority dashboards.
     * @return id         The new grievance's on-chain ID.
     */
    function submitGrievance(
        string calldata category,
        string calldata subCategory,
        string calldata department,
        string calldata ipfsCid,
        bool isAnonymous
    )
        external
        onlyStudent
        whenNotPaused
        nonReentrant
        returns (uint256 id)
    {
        require(bytes(category).length > 0,   "GS: category required");
        require(bytes(department).length > 0, "GS: department required");
        require(bytes(ipfsCid).length > 0,    "GS: IPFS CID required");

        _grievanceCounter++;
        id = _grievanceCounter;

        uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtCommittee];

        _grievances[id] = Grievance({
            id:                 id,
            studentIdentifier:  keccak256(abi.encodePacked(msg.sender)),
            isAnonymous:        isAnonymous,
            category:           category,
            subCategory:        subCategory,
            department:         department,
            ipfsCid:            ipfsCid,
            status:             GrievanceStatus.AtCommittee,
            createdAt:          block.timestamp,
            updatedAt:          block.timestamp,
            thresholdDeadline:  deadline,
            upvotes:            0,
            downvotes:          0
        });

        // Track as active for the watchdog
        _activeIndex[id] = _activeGrievanceIds.length;
        _activeGrievanceIds.push(id);

        // Record submit action
        _logAction(id, msg.sender, ActionType.Submit, "", GrievanceStatus.Submitted, GrievanceStatus.AtCommittee);

        emit GrievanceSubmitted(id, keccak256(abi.encodePacked(msg.sender)), department, ipfsCid, deadline);
    }

    /**
     * @notice Cast an upvote or downvote on a grievance. One vote per student.
     */
    function castVote(uint256 id, bool isUpvote)
        external
        onlyStudent
        grievanceExists(id)
        whenNotPaused
    {
        require(!_hasVotedOnGrievance[id][msg.sender], "GS: already voted");
        _hasVotedOnGrievance[id][msg.sender] = true;

        if (isUpvote) {
            _grievances[id].upvotes++;
        } else {
            _grievances[id].downvotes++;
        }
    }

    /**
     * @notice Student submits satisfaction feedback after a Resolve action.
     * @param isSatisfied    true → CLOSED. false → re-escalates back to Committee.
     * @param remarksIpfsCid IPFS CID of the student's feedback text (optional).
     */
    function submitFeedback(
        uint256 id,
        bool isSatisfied,
        string calldata remarksIpfsCid
    )
        external
        onlyStudent
        grievanceExists(id)
        whenNotPaused
        nonReentrant
    {
        Grievance storage g = _grievances[id];
        require(g.status == GrievanceStatus.AwaitingFeedback, "GS: not awaiting feedback");
        require(g.studentIdentifier == keccak256(abi.encodePacked(msg.sender)), "GS: not the grievance owner");

        if (isSatisfied) {
            _transitionStatus(id, GrievanceStatus.Closed);
            _logAction(id, msg.sender, ActionType.FeedbackSatisfied, remarksIpfsCid,
                GrievanceStatus.AwaitingFeedback, GrievanceStatus.Closed);
            _removeFromActive(id);
        } else {
            // Not satisfied — re-escalate to Committee with a fresh threshold
            uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtCommittee];
            _grievances[id].thresholdDeadline = deadline;
            _transitionStatus(id, GrievanceStatus.AtCommittee);
            _logAction(id, msg.sender, ActionType.FeedbackUnsatisfied, remarksIpfsCid,
                GrievanceStatus.AwaitingFeedback, GrievanceStatus.AtCommittee);
        }
    }

    // ── Committee functions ──────────────────────────────────────────────────

    /**
     * @notice A committee member proposes an action (starts or adds to a vote).
     *         If this vote reaches majority, call executeCommitteeAction() to apply it.
     * @param proposedAction Must be Forward, Resolve, or Debar.
     * @param remarksIpfsCid IPFS CID of the remark (required for Debar, optional otherwise).
     */
    function committeePropose(
        uint256 id,
        ActionType proposedAction,
        string calldata remarksIpfsCid
    )
        external
        onlyCommittee
        grievanceExists(id)
        whenNotPaused
    {
        require(
            _grievances[id].status == GrievanceStatus.AtCommittee,
            "GS: grievance not at committee level"
        );
        require(
            proposedAction == ActionType.Forward ||
            proposedAction == ActionType.Resolve ||
            proposedAction == ActionType.Debar,
            "GS: invalid action for committee"
        );

        CommitteeVote storage cv = _committeeVotes[id];

        // If the previous proposal was executed or a different action is proposed, start a
        // new round. Incrementing the round makes all prior hasVoted entries unreachable
        // without relying on `delete` (which cannot clear nested mappings in Solidity).
        if (cv.executed || cv.proposedAction != proposedAction) {
            _voteRound[id]++;
            cv.proposedAction = proposedAction;
            cv.remarksIpfsCid = remarksIpfsCid;
            cv.yesCount       = 0;
            cv.noCount        = 0;
            cv.executed       = false;
        }

        uint256 round = _voteRound[id];
        require(!_hasVotedInRound[id][round][msg.sender], "GS: already voted on this proposal");

        _hasVotedInRound[id][round][msg.sender] = true;
        cv.yesCount++;

        emit CommitteeVoteCast(id, msg.sender, proposedAction, true, cv.yesCount, cv.noCount);
    }

    /**
     * @notice Execute the committee's pending action once majority is reached.
     *         Anyone can call this once yesCount > committeeSize / 2.
     */
    function executeCommitteeAction(uint256 id)
        external
        grievanceExists(id)
        whenNotPaused
        nonReentrant
    {
        CommitteeVote storage cv = _committeeVotes[id];
        require(!cv.executed, "GS: action already executed");
        require(cv.yesCount * 2 > committeeSize, "GS: majority not reached");

        cv.executed = true;
        GrievanceStatus from = GrievanceStatus.AtCommittee;

        if (cv.proposedAction == ActionType.Forward) {
            uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtHoD];
            _grievances[id].thresholdDeadline = deadline;
            _transitionStatus(id, GrievanceStatus.AtHoD);
            _logAction(id, msg.sender, ActionType.Forward, cv.remarksIpfsCid, from, GrievanceStatus.AtHoD);

        } else if (cv.proposedAction == ActionType.Resolve) {
            _transitionStatus(id, GrievanceStatus.AwaitingFeedback);
            _logAction(id, msg.sender, ActionType.Resolve, cv.remarksIpfsCid, from, GrievanceStatus.AwaitingFeedback);

        } else if (cv.proposedAction == ActionType.Debar) {
            _transitionStatus(id, GrievanceStatus.Debarred);
            _logAction(id, msg.sender, ActionType.Debar, cv.remarksIpfsCid, from, GrievanceStatus.Debarred);
            _removeFromActive(id);
        }
    }

    // ── HoD functions ────────────────────────────────────────────────────────

    /**
     * @notice HoD takes an action on a grievance at the HoD level.
     * @param action Must be Forward, Revert, or Resolve.
     */
    function hodAction(
        uint256 id,
        ActionType action,
        string calldata remarksIpfsCid
    )
        external
        onlyHoD
        grievanceExists(id)
        whenNotPaused
        nonReentrant
    {
        require(_grievances[id].status == GrievanceStatus.AtHoD, "GS: grievance not at HoD level");
        require(
            action == ActionType.Forward ||
            action == ActionType.Revert  ||
            action == ActionType.Resolve,
            "GS: invalid action for HoD"
        );

        GrievanceStatus from = GrievanceStatus.AtHoD;

        if (action == ActionType.Forward) {
            uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtPrincipal];
            _grievances[id].thresholdDeadline = deadline;
            _transitionStatus(id, GrievanceStatus.AtPrincipal);
            _logAction(id, msg.sender, action, remarksIpfsCid, from, GrievanceStatus.AtPrincipal);

        } else if (action == ActionType.Revert) {
            uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtCommittee];
            _grievances[id].thresholdDeadline = deadline;
            _transitionStatus(id, GrievanceStatus.AtCommittee);
            _logAction(id, msg.sender, action, remarksIpfsCid, from, GrievanceStatus.AtCommittee);

        } else if (action == ActionType.Resolve) {
            _transitionStatus(id, GrievanceStatus.AwaitingFeedback);
            _logAction(id, msg.sender, action, remarksIpfsCid, from, GrievanceStatus.AwaitingFeedback);
        }
    }

    // ── Principal functions ──────────────────────────────────────────────────

    /**
     * @notice Principal takes an action on a grievance at the Principal level.
     * @param action Must be Resolve or Revert.
     */
    function principalAction(
        uint256 id,
        ActionType action,
        string calldata remarksIpfsCid
    )
        external
        onlyPrincipal
        grievanceExists(id)
        whenNotPaused
        nonReentrant
    {
        require(_grievances[id].status == GrievanceStatus.AtPrincipal, "GS: grievance not at Principal level");
        require(
            action == ActionType.Resolve ||
            action == ActionType.Revert,
            "GS: invalid action for Principal"
        );

        GrievanceStatus from = GrievanceStatus.AtPrincipal;

        if (action == ActionType.Resolve) {
            _transitionStatus(id, GrievanceStatus.AwaitingFeedback);
            _logAction(id, msg.sender, action, remarksIpfsCid, from, GrievanceStatus.AwaitingFeedback);

        } else if (action == ActionType.Revert) {
            uint256 deadline = block.timestamp + thresholdDuration[GrievanceStatus.AtHoD];
            _grievances[id].thresholdDeadline = deadline;
            _transitionStatus(id, GrievanceStatus.AtHoD);
            _logAction(id, msg.sender, action, remarksIpfsCid, from, GrievanceStatus.AtHoD);
        }
    }

    // ── Admin / watchdog functions ───────────────────────────────────────────

    /**
     * @notice Called by the backend relay wallet when a grievance exceeds its
     *         threshold deadline without action (auto-forward).
     *         Only callable by admin role.
     */
    function adminAutoForward(uint256 id)
        external
        onlyAdmin
        grievanceExists(id)
        whenNotPaused
        nonReentrant
    {
        Grievance storage g = _grievances[id];
        require(block.timestamp > g.thresholdDeadline, "GS: threshold not exceeded");

        GrievanceStatus from   = g.status;
        GrievanceStatus to;

        if (from == GrievanceStatus.AtCommittee) {
            to = GrievanceStatus.AtHoD;
        } else if (from == GrievanceStatus.AtHoD) {
            to = GrievanceStatus.AtPrincipal;
        } else {
            revert("GS: cannot auto-forward from this status");
        }

        uint256 deadline = block.timestamp + thresholdDuration[to];
        _grievances[id].thresholdDeadline = deadline;
        _transitionStatus(id, to);
        _logAction(id, msg.sender, ActionType.AutoForward, "", from, to);
    }

    /**
     * @notice Update the threshold duration for a given level. Only admin.
     * @param level       The GrievanceStatus level (AtCommittee, AtHoD, AtPrincipal).
     * @param newDuration New duration in seconds.
     */
    function setThreshold(GrievanceStatus level, uint256 newDuration) external onlyAdmin {
        require(
            level == GrievanceStatus.AtCommittee ||
            level == GrievanceStatus.AtHoD       ||
            level == GrievanceStatus.AtPrincipal,
            "GS: invalid level for threshold"
        );
        require(newDuration >= 1 hours, "GS: threshold too short");
        thresholdDuration[level] = newDuration;
        emit ThresholdUpdated(level, newDuration);
    }

    /**
     * @notice Update the total number of committee members. Used for majority calculation.
     */
    function setCommitteeSize(uint256 size) external onlyAdmin {
        require(size >= 1, "GS: committee size must be at least 1");
        committeeSize = size;
        emit CommitteeSizeUpdated(size);
    }

    /**
     * @notice Pause all state-changing functions. Emergency use only.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @notice Resume operations after a pause.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    // ── View functions ───────────────────────────────────────────────────────

    /**
     * @notice Get full grievance data by ID.
     */
    function getGrievance(uint256 id)
        external
        view
        grievanceExists(id)
        returns (Grievance memory)
    {
        return _grievances[id];
    }

    /**
     * @notice Get the complete on-chain action history for a grievance.
     */
    function getActionHistory(uint256 id)
        external
        view
        grievanceExists(id)
        returns (GrievanceAction[] memory)
    {
        return _actionHistory[id];
    }

    /**
     * @notice Get current vote tally for a pending committee action.
     */
    function getCommitteeVoteTally(uint256 id)
        external
        view
        grievanceExists(id)
        returns (
            ActionType proposedAction,
            uint256    yesCount,
            uint256    noCount,
            bool       executed,
            uint256    majorityNeeded
        )
    {
        CommitteeVote storage cv = _committeeVotes[id];
        return (
            cv.proposedAction,
            cv.yesCount,
            cv.noCount,
            cv.executed,
            committeeSize / 2 + 1
        );
    }

    /**
     * @notice Get all active (non-closed, non-debarred) grievance IDs.
     *         Used by the backend watchdog to check thresholds.
     */
    function getActiveGrievanceIds() external view returns (uint256[] memory) {
        return _activeGrievanceIds;
    }

    /**
     * @notice Total number of grievances ever submitted.
     */
    function totalGrievances() external view returns (uint256) {
        return _grievanceCounter;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _transitionStatus(uint256 id, GrievanceStatus newStatus) internal {
        _grievances[id].status    = newStatus;
        _grievances[id].updatedAt = block.timestamp;
    }

    function _logAction(
        uint256         id,
        address         actor,
        ActionType      action,
        string memory   remarksIpfsCid,
        GrievanceStatus from,
        GrievanceStatus to
    ) internal {
        _actionHistory[id].push(GrievanceAction({
            grievanceId:    id,
            actor:          actor,
            action:         action,
            remarksIpfsCid: remarksIpfsCid,
            timestamp:      block.timestamp,
            fromStatus:     from,
            toStatus:       to
        }));

        emit GrievanceActionLogged(id, actor, action, from, to, block.timestamp);
    }

    function _removeFromActive(uint256 id) internal {
        uint256 idx  = _activeIndex[id];
        uint256 last = _activeGrievanceIds[_activeGrievanceIds.length - 1];

        _activeGrievanceIds[idx] = last;
        _activeIndex[last]       = idx;
        _activeGrievanceIds.pop();

        delete _activeIndex[id];
    }
}
