import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { RoleManager, GrievanceSystem } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// ── Enums mirrored from the contract ────────────────────────────────────────

enum GrievanceStatus {
  Submitted          = 0,
  AtCommittee        = 1,
  AtHoD              = 2,
  AtPrincipal        = 3,
  AwaitingFeedback   = 4,
  Closed             = 5,
  Debarred           = 6,
}

enum ActionType {
  Submit             = 0,
  Forward            = 1,
  Revert             = 2,
  Resolve            = 3,
  Debar              = 4,
  AutoForward        = 5,
  FeedbackSatisfied  = 6,
  FeedbackUnsatisfied = 7,
}

// ── Shared constants ─────────────────────────────────────────────────────────

const SAMPLE_CID  = "QmSampleIpfsCid123";
const REMARK_CID  = "QmRemarkIpfsCid456";
const SEVEN_DAYS  = 7 * 24 * 60 * 60;
const FIVE_DAYS   = 5 * 24 * 60 * 60;
const THREE_DAYS  = 3 * 24 * 60 * 60;

// Simulated Firebase UID hashes (relay wallet passes these on behalf of users)
const STUDENT1_ID   = ethers.keccak256(ethers.toUtf8Bytes("firebase-uid-student1"));
const STUDENT2_ID   = ethers.keccak256(ethers.toUtf8Bytes("firebase-uid-student2"));
const COMMITTEE1_ID = ethers.keccak256(ethers.toUtf8Bytes("firebase-uid-committee1"));
const COMMITTEE2_ID = ethers.keccak256(ethers.toUtf8Bytes("firebase-uid-committee2"));
const COMMITTEE3_ID = ethers.keccak256(ethers.toUtf8Bytes("firebase-uid-committee3"));

// ── Fixture ──────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, stranger] = await ethers.getSigners();

  // Deploy RoleManager
  const RMFactory = await ethers.getContractFactory("RoleManager");
  const roleManager: RoleManager = await RMFactory.deploy(admin.address);
  await roleManager.waitForDeployment();

  // Deploy GrievanceSystem
  const GSFactory = await ethers.getContractFactory("GrievanceSystem");
  const gs: GrievanceSystem = await GSFactory.deploy(
    await roleManager.getAddress(),
    admin.address
  );
  await gs.waitForDeployment();

  // Set committee size to 3
  await gs.connect(admin).setCommitteeSize(3);

  return { gs, roleManager, admin, stranger };
}

// ── Helper: submit a grievance as relay wallet and return its ID ─────────────

async function submitGrievance(
  gs: GrievanceSystem,
  admin: SignerWithAddress,
  studentId: string = STUDENT1_ID,
): Promise<bigint> {
  const tx = await gs.connect(admin).submitGrievance(
    "Academic", "Exam Related", "Computer Engineering", SAMPLE_CID, false, studentId
  );
  const receipt = await tx.wait();
  const iface = gs.interface;
  for (const log of receipt!.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "GrievanceSubmitted") return parsed.args.id as bigint;
    } catch { /* skip */ }
  }
  throw new Error("GrievanceSubmitted event not found");
}

// ── Helper: reach majority committee vote ────────────────────────────────────

async function reachCommitteeVote(
  gs: GrievanceSystem,
  admin: SignerWithAddress,
  grievanceId: bigint,
  action: ActionType,
  memberIds: string[] = [COMMITTEE1_ID, COMMITTEE2_ID],
) {
  for (const memberId of memberIds) {
    await gs.connect(admin).committeePropose(grievanceId, action, REMARK_CID, memberId);
  }
}

// ════════════════════════════════════════════════════════════════════════════

describe("GrievanceSystem", () => {

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("sets the correct RoleManager address", async () => {
      const { gs, roleManager } = await loadFixture(deployFixture);
      expect(await gs.roleManager()).to.equal(await roleManager.getAddress());
    });

    it("sets default thresholds: committee=7d, hod=5d, principal=3d", async () => {
      const { gs } = await loadFixture(deployFixture);
      expect(await gs.thresholdDuration(GrievanceStatus.AtCommittee)).to.equal(SEVEN_DAYS);
      expect(await gs.thresholdDuration(GrievanceStatus.AtHoD)).to.equal(FIVE_DAYS);
      expect(await gs.thresholdDuration(GrievanceStatus.AtPrincipal)).to.equal(THREE_DAYS);
    });

    it("sets default committee size to 3", async () => {
      const { gs } = await loadFixture(deployFixture);
      expect(await gs.committeeSize()).to.equal(3);
    });

    it("starts with zero grievances", async () => {
      const { gs } = await loadFixture(deployFixture);
      expect(await gs.totalGrievances()).to.equal(0);
    });
  });

  // ── submitGrievance ────────────────────────────────────────────────────────

  describe("submitGrievance", () => {
    it("relay wallet (admin) can submit a grievance", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await expect(
        gs.connect(admin).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false, STUDENT1_ID)
      ).to.not.be.reverted;
    });

    it("increments totalGrievances", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await submitGrievance(gs, admin);
      expect(await gs.totalGrievances()).to.equal(1);
    });

    it("status is AtCommittee immediately after submit", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("stores the correct studentIdentifier", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      const g = await gs.getGrievance(id);
      expect(g.studentIdentifier).to.equal(STUDENT1_ID);
    });

    it("sets thresholdDeadline ~7 days from now", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(SEVEN_DAYS), 5n);
    });

    it("emits GrievanceSubmitted event with thresholdDeadline", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const tx = await gs.connect(admin).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false, STUDENT1_ID);
      await expect(tx).to.emit(gs, "GrievanceSubmitted");
    });

    it("first action in history is Submit", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(1);
      expect(history[0].action).to.equal(ActionType.Submit);
    });

    it("non-admin cannot submit", async () => {
      const { gs, stranger } = await loadFixture(deployFixture);
      await expect(
        gs.connect(stranger).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false, STUDENT1_ID)
      ).to.be.revertedWith("GS: caller is not admin");
    });

    it("reverts if category is empty", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await expect(
        gs.connect(admin).submitGrievance("", "Exam", "CS", SAMPLE_CID, false, STUDENT1_ID)
      ).to.be.revertedWith("GS: category required");
    });

    it("reverts if IPFS CID is empty", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await expect(
        gs.connect(admin).submitGrievance("Academic", "Exam", "CS", "", false, STUDENT1_ID)
      ).to.be.revertedWith("GS: IPFS CID required");
    });

    it("reverts if studentId is zero", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await expect(
        gs.connect(admin).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false, ethers.ZeroHash)
      ).to.be.revertedWith("GS: student ID required");
    });

    it("stores isAnonymous=true correctly", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await gs.connect(admin).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, true, STUDENT1_ID);
      const g = await gs.getGrievance(1n);
      expect(g.isAnonymous).to.be.true;
    });
  });

  // ── castVote ──────────────────────────────────────────────────────────────

  describe("castVote", () => {
    it("relay wallet can upvote on behalf of a student", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await gs.connect(admin).castVote(id, true, STUDENT2_ID);
      const g = await gs.getGrievance(id);
      expect(g.upvotes).to.equal(1);
    });

    it("relay wallet can downvote on behalf of a student", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await gs.connect(admin).castVote(id, false, STUDENT2_ID);
      const g = await gs.getGrievance(id);
      expect(g.downvotes).to.equal(1);
    });

    it("prevents the same student (by ID) from voting twice", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await gs.connect(admin).castVote(id, true, STUDENT2_ID);
      await expect(
        gs.connect(admin).castVote(id, true, STUDENT2_ID)
      ).to.be.revertedWith("GS: already voted");
    });

    it("two different students can both vote", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await gs.connect(admin).castVote(id, true, STUDENT1_ID);
      await gs.connect(admin).castVote(id, true, STUDENT2_ID);
      const g = await gs.getGrievance(id);
      expect(g.upvotes).to.equal(2);
    });

    it("non-admin cannot cast vote", async () => {
      const { gs, admin, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await expect(
        gs.connect(stranger).castVote(id, true, STUDENT2_ID)
      ).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Committee voting ───────────────────────────────────────────────────────

  describe("Committee — Forward", () => {
    it("majority vote forwards grievance to HoD", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.AtHoD);
    });

    it("sets new threshold deadline after forward", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(FIVE_DAYS), 5n);
    });

    it("single vote is not enough to execute (no majority)", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await gs.connect(admin).committeePropose(id, ActionType.Forward, REMARK_CID, COMMITTEE1_ID);
      await expect(gs.connect(admin).executeCommitteeAction(id)).to.be.revertedWith("GS: majority not reached");
    });

    it("same committee member (by ID) cannot vote twice in the same round", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await gs.connect(admin).committeePropose(id, ActionType.Forward, REMARK_CID, COMMITTEE1_ID);
      await expect(
        gs.connect(admin).committeePropose(id, ActionType.Forward, REMARK_CID, COMMITTEE1_ID)
      ).to.be.revertedWith("GS: already voted on this proposal");
    });

    it("logs Forward action in history", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);

      const history = await gs.getActionHistory(id);
      const forwardAction = history[history.length - 1];
      expect(forwardAction.action).to.equal(ActionType.Forward);
      expect(forwardAction.fromStatus).to.equal(GrievanceStatus.AtCommittee);
      expect(forwardAction.toStatus).to.equal(GrievanceStatus.AtHoD);
    });

    it("non-admin cannot propose", async () => {
      const { gs, admin, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await expect(
        gs.connect(stranger).committeePropose(id, ActionType.Forward, REMARK_CID, COMMITTEE1_ID)
      ).to.be.revertedWith("GS: caller is not admin");
    });
  });

  describe("Committee — Resolve", () => {
    it("majority vote resolves grievance → AwaitingFeedback", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Resolve);
      await gs.connect(admin).executeCommitteeAction(id);

      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);
    });
  });

  describe("Committee — Debar", () => {
    it("majority vote debars grievance → Debarred", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Debar);
      await gs.connect(admin).executeCommitteeAction(id);

      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Debarred);
    });

    it("removes debarred grievance from active list", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Debar);
      await gs.connect(admin).executeCommitteeAction(id);

      const active = await gs.getActiveGrievanceIds();
      expect(active).to.not.include(id);
    });

    it("reverts if already executed", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Debar);
      await gs.connect(admin).executeCommitteeAction(id);
      await expect(
        gs.connect(admin).executeCommitteeAction(id)
      ).to.be.revertedWith("GS: action already executed");
    });
  });

  // ── HoD actions ───────────────────────────────────────────────────────────

  describe("HoD actions", () => {
    async function setupAtHoD(gs: GrievanceSystem, admin: SignerWithAddress) {
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);
      return id;
    }

    it("relay wallet can forward to Principal on behalf of HoD", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtHoD(gs, admin);
      await gs.connect(admin).hodAction(id, ActionType.Forward, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtPrincipal);
    });

    it("HoD forward sets correct threshold deadline", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtHoD(gs, admin);
      await gs.connect(admin).hodAction(id, ActionType.Forward, REMARK_CID);
      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(THREE_DAYS), 5n);
    });

    it("relay wallet can revert to Committee on behalf of HoD", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtHoD(gs, admin);
      await gs.connect(admin).hodAction(id, ActionType.Revert, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("relay wallet can resolve → AwaitingFeedback on behalf of HoD", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtHoD(gs, admin);
      await gs.connect(admin).hodAction(id, ActionType.Resolve, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);
    });

    it("reverts if grievance is not AtHoD", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await expect(
        gs.connect(admin).hodAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: grievance not at HoD level");
    });

    it("non-admin cannot call hodAction", async () => {
      const { gs, admin, stranger } = await loadFixture(deployFixture);
      const id = await setupAtHoD(gs, admin);
      await expect(
        gs.connect(stranger).hodAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Principal actions ─────────────────────────────────────────────────────

  describe("Principal actions", () => {
    async function setupAtPrincipal(gs: GrievanceSystem, admin: SignerWithAddress) {
      const id = await submitGrievance(gs, admin);
      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);
      await gs.connect(admin).hodAction(id, ActionType.Forward, REMARK_CID);
      return id;
    }

    it("relay wallet can resolve → AwaitingFeedback on behalf of Principal", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(gs, admin);
      await gs.connect(admin).principalAction(id, ActionType.Resolve, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);
    });

    it("relay wallet can revert to HoD on behalf of Principal", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(gs, admin);
      await gs.connect(admin).principalAction(id, ActionType.Revert, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);
    });

    it("reverts if grievance is not AtPrincipal", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await expect(
        gs.connect(admin).principalAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: grievance not at Principal level");
    });

    it("non-admin cannot call principalAction", async () => {
      const { gs, admin, stranger } = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(gs, admin);
      await expect(
        gs.connect(stranger).principalAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Student feedback ──────────────────────────────────────────────────────

  describe("submitFeedback", () => {
    async function setupAwaitingFeedback(gs: GrievanceSystem, admin: SignerWithAddress) {
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await reachCommitteeVote(gs, admin, id, ActionType.Resolve);
      await gs.connect(admin).executeCommitteeAction(id);
      return id;
    }

    it("satisfied feedback closes the grievance", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(gs, admin);
      await gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);
    });

    it("satisfied feedback removes from active list", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(gs, admin);
      await gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID);
      const active = await gs.getActiveGrievanceIds();
      expect(active).to.not.include(id);
    });

    it("unsatisfied feedback re-escalates to Committee", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(gs, admin);
      await gs.connect(admin).submitFeedback(id, false, REMARK_CID, STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("unsatisfied feedback resets threshold deadline", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(gs, admin);
      await gs.connect(admin).submitFeedback(id, false, REMARK_CID, STUDENT1_ID);
      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(SEVEN_DAYS), 5n);
    });

    it("wrong student ID cannot submit feedback", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(gs, admin); // submitted by STUDENT1_ID
      await expect(
        gs.connect(admin).submitFeedback(id, true, "", STUDENT2_ID) // wrong student
      ).to.be.revertedWith("GS: not the grievance owner");
    });

    it("reverts if grievance is not AwaitingFeedback", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      await expect(
        gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID)
      ).to.be.revertedWith("GS: not awaiting feedback");
    });
  });

  // ── Auto-forward (threshold) ──────────────────────────────────────────────

  describe("adminAutoForward", () => {
    it("admin can auto-forward after threshold exceeded at Committee level", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await time.increase(SEVEN_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);
    });

    it("auto-forward logs ActionType.AutoForward in history", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await time.increase(SEVEN_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id);

      const history = await gs.getActionHistory(id);
      const last = history[history.length - 1];
      expect(last.action).to.equal(ActionType.AutoForward);
    });

    it("reverts if threshold has not passed yet", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await time.increase(60 * 60 * 24);
      await expect(
        gs.connect(admin).adminAutoForward(id)
      ).to.be.revertedWith("GS: threshold not exceeded");
    });

    it("non-admin cannot call adminAutoForward", async () => {
      const { gs, admin, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await time.increase(SEVEN_DAYS + 1);
      await expect(
        gs.connect(stranger).adminAutoForward(id)
      ).to.be.revertedWith("GS: caller is not admin");
    });

    it("cannot auto-forward past Principal level", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, admin);
      await time.increase(SEVEN_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id); // → AtHoD
      await time.increase(FIVE_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id); // → AtPrincipal
      await time.increase(THREE_DAYS + 1);
      await expect(
        gs.connect(admin).adminAutoForward(id)
      ).to.be.revertedWith("GS: cannot auto-forward from this status");
    });
  });

  // ── Admin configuration ───────────────────────────────────────────────────

  describe("Admin configuration", () => {
    it("admin can update threshold duration", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const TEN_DAYS = 10 * 24 * 60 * 60;
      await gs.connect(admin).setThreshold(GrievanceStatus.AtCommittee, TEN_DAYS);
      expect(await gs.thresholdDuration(GrievanceStatus.AtCommittee)).to.equal(TEN_DAYS);
    });

    it("emits ThresholdUpdated event", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      const TEN_DAYS = 10 * 24 * 60 * 60;
      await expect(gs.connect(admin).setThreshold(GrievanceStatus.AtCommittee, TEN_DAYS))
        .to.emit(gs, "ThresholdUpdated")
        .withArgs(GrievanceStatus.AtCommittee, TEN_DAYS);
    });

    it("reverts if threshold is less than 1 hour", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await expect(
        gs.connect(admin).setThreshold(GrievanceStatus.AtCommittee, 60)
      ).to.be.revertedWith("GS: threshold too short");
    });

    it("admin can update committee size", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await gs.connect(admin).setCommitteeSize(5);
      expect(await gs.committeeSize()).to.equal(5);
    });

    it("non-admin cannot update threshold", async () => {
      const { gs, stranger } = await loadFixture(deployFixture);
      await expect(
        gs.connect(stranger).setThreshold(GrievanceStatus.AtCommittee, SEVEN_DAYS)
      ).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Pause / Unpause ───────────────────────────────────────────────────────

  describe("Pause", () => {
    it("admin can pause the contract", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await gs.connect(admin).pause();
      await expect(
        gs.connect(admin).submitGrievance("A", "B", "CS", SAMPLE_CID, false, STUDENT1_ID)
      ).to.be.reverted;
    });

    it("admin can unpause after pausing", async () => {
      const { gs, admin } = await loadFixture(deployFixture);
      await gs.connect(admin).pause();
      await gs.connect(admin).unpause();
      await expect(
        gs.connect(admin).submitGrievance("A", "B", "CS", SAMPLE_CID, false, STUDENT1_ID)
      ).to.not.be.reverted;
    });

    it("non-admin cannot pause", async () => {
      const { gs, stranger } = await loadFixture(deployFixture);
      await expect(gs.connect(stranger).pause()).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Full end-to-end happy path ────────────────────────────────────────────

  describe("Full lifecycle — satisfied resolution", () => {
    it("Submit → Committee resolve → Student satisfied → Closed", async () => {
      const { gs, admin } = await loadFixture(deployFixture);

      const id = await submitGrievance(gs, admin, STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);

      await reachCommitteeVote(gs, admin, id, ActionType.Resolve);
      await gs.connect(admin).executeCommitteeAction(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);

      await gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);

      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(3);
      expect(history[0].action).to.equal(ActionType.Submit);
      expect(history[1].action).to.equal(ActionType.Resolve);
      expect(history[2].action).to.equal(ActionType.FeedbackSatisfied);
    });
  });

  describe("Full lifecycle — full escalation path", () => {
    it("Submit → Committee forward → HoD forward → Principal resolve → Satisfied → Closed", async () => {
      const { gs, admin } = await loadFixture(deployFixture);

      const id = await submitGrievance(gs, admin, STUDENT1_ID);

      await reachCommitteeVote(gs, admin, id, ActionType.Forward);
      await gs.connect(admin).executeCommitteeAction(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);

      await gs.connect(admin).hodAction(id, ActionType.Forward, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtPrincipal);

      await gs.connect(admin).principalAction(id, ActionType.Resolve, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);

      await gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);

      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(5);
    });
  });

  describe("Full lifecycle — unsatisfied then satisfied", () => {
    it("Student unsatisfied → re-escalated to Committee → resolved → satisfied → Closed", async () => {
      const { gs, admin } = await loadFixture(deployFixture);

      const id = await submitGrievance(gs, admin, STUDENT1_ID);

      await reachCommitteeVote(gs, admin, id, ActionType.Resolve);
      await gs.connect(admin).executeCommitteeAction(id);

      await gs.connect(admin).submitFeedback(id, false, REMARK_CID, STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);

      // New round — same member IDs can vote again
      await reachCommitteeVote(gs, admin, id, ActionType.Resolve);
      await gs.connect(admin).executeCommitteeAction(id);

      await gs.connect(admin).submitFeedback(id, true, "", STUDENT1_ID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);
    });
  });
});
