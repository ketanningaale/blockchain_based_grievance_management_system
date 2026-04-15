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

const STUDENT_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("STUDENT_ROLE"));
const COMMITTEE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMMITTEE_ROLE"));
const HOD_ROLE       = ethers.keccak256(ethers.toUtf8Bytes("HOD_ROLE"));
const PRINCIPAL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PRINCIPAL_ROLE"));

// ── Fixture ──────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [
    admin,
    student1, student2,
    committee1, committee2, committee3,
    hod,
    principal,
    stranger,
  ] = await ethers.getSigners();

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

  // Assign roles
  await roleManager.connect(admin).grantUserRole(STUDENT_ROLE,   student1.address);
  await roleManager.connect(admin).grantUserRole(STUDENT_ROLE,   student2.address);
  await roleManager.connect(admin).grantUserRole(COMMITTEE_ROLE, committee1.address);
  await roleManager.connect(admin).grantUserRole(COMMITTEE_ROLE, committee2.address);
  await roleManager.connect(admin).grantUserRole(COMMITTEE_ROLE, committee3.address);
  await roleManager.connect(admin).grantUserRole(HOD_ROLE,       hod.address);
  await roleManager.connect(admin).grantUserRole(PRINCIPAL_ROLE, principal.address);

  // Set committee size to 3 (matches the 3 committee accounts above)
  await gs.connect(admin).setCommitteeSize(3);

  return { gs, roleManager, admin, student1, student2, committee1, committee2, committee3, hod, principal, stranger };
}

// ── Helper: submit a grievance and return its ID ─────────────────────────────

async function submitGrievance(gs: GrievanceSystem, student: SignerWithAddress): Promise<bigint> {
  const tx = await gs.connect(student).submitGrievance(
    "Academic", "Exam Related", "Computer Engineering", SAMPLE_CID, false
  );
  const receipt = await tx.wait();
  // Parse GrievanceSubmitted event to get the ID
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
  grievanceId: bigint,
  action: ActionType,
  members: SignerWithAddress[]
) {
  for (const member of members) {
    await gs.connect(member).committeePropose(grievanceId, action, REMARK_CID);
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
    it("student can submit a grievance", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await expect(
        gs.connect(student1).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false)
      ).to.not.be.reverted;
    });

    it("increments totalGrievances", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await submitGrievance(gs, student1);
      expect(await gs.totalGrievances()).to.equal(1);
    });

    it("status is AtCommittee immediately after submit", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("sets thresholdDeadline ~7 days from now", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(SEVEN_DAYS), 5n);
    });

    it("emits GrievanceSubmitted event", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await expect(
        gs.connect(student1).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false)
      ).to.emit(gs, "GrievanceSubmitted");
    });

    it("first action in history is Submit", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(1);
      expect(history[0].action).to.equal(ActionType.Submit);
    });

    it("non-student cannot submit", async () => {
      const { gs, stranger } = await loadFixture(deployFixture);
      await expect(
        gs.connect(stranger).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, false)
      ).to.be.revertedWith("GS: caller is not a student");
    });

    it("reverts if category is empty", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await expect(
        gs.connect(student1).submitGrievance("", "Exam", "CS", SAMPLE_CID, false)
      ).to.be.revertedWith("GS: category required");
    });

    it("reverts if IPFS CID is empty", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await expect(
        gs.connect(student1).submitGrievance("Academic", "Exam", "CS", "", false)
      ).to.be.revertedWith("GS: IPFS CID required");
    });

    it("stores isAnonymous=true correctly", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      await gs.connect(student1).submitGrievance("Academic", "Exam", "CS", SAMPLE_CID, true);
      const g = await gs.getGrievance(1n);
      expect(g.isAnonymous).to.be.true;
    });
  });

  // ── castVote (upvote/downvote) ────────────────────────────────────────────

  describe("castVote", () => {
    it("student can upvote a grievance", async () => {
      const { gs, student1, student2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(student2).castVote(id, true);
      const g = await gs.getGrievance(id);
      expect(g.upvotes).to.equal(1);
    });

    it("student can downvote a grievance", async () => {
      const { gs, student1, student2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(student2).castVote(id, false);
      const g = await gs.getGrievance(id);
      expect(g.downvotes).to.equal(1);
    });

    it("prevents voting twice on the same grievance", async () => {
      const { gs, student1, student2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(student2).castVote(id, true);
      await expect(
        gs.connect(student2).castVote(id, true)
      ).to.be.revertedWith("GS: already voted");
    });

    it("non-student cannot vote", async () => {
      const { gs, student1, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await expect(
        gs.connect(stranger).castVote(id, true)
      ).to.be.revertedWith("GS: caller is not a student");
    });
  });

  // ── Committee voting ───────────────────────────────────────────────────────

  describe("Committee — Forward", () => {
    it("majority vote forwards grievance to HoD", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);

      // 2 of 3 votes = majority (>50%)
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.AtHoD);
    });

    it("sets new threshold deadline after forward", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(FIVE_DAYS), 5n);
    });

    it("single vote is not enough to execute (no majority)", async () => {
      const { gs, student1, committee1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await expect(gs.executeCommitteeAction(id)).to.be.revertedWith("GS: majority not reached");
    });

    it("committee member cannot vote twice", async () => {
      const { gs, student1, committee1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await expect(
        gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID)
      ).to.be.revertedWith("GS: already voted on this proposal");
    });

    it("logs Forward action in history", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const history = await gs.getActionHistory(id);
      const forwardAction = history[history.length - 1];
      expect(forwardAction.action).to.equal(ActionType.Forward);
      expect(forwardAction.fromStatus).to.equal(GrievanceStatus.AtCommittee);
      expect(forwardAction.toStatus).to.equal(GrievanceStatus.AtHoD);
    });
  });

  describe("Committee — Resolve", () => {
    it("majority vote resolves grievance → AwaitingFeedback", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.AwaitingFeedback);
    });
  });

  describe("Committee — Debar", () => {
    it("majority vote debars grievance → Debarred", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const g = await gs.getGrievance(id);
      expect(g.status).to.equal(GrievanceStatus.Debarred);
    });

    it("removes debarred grievance from active list", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.executeCommitteeAction(id);

      const active = await gs.getActiveGrievanceIds();
      expect(active).to.not.include(id);
    });

    it("reverts if already executed", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Debar, REMARK_CID);
      await gs.executeCommitteeAction(id);
      await expect(gs.executeCommitteeAction(id)).to.be.revertedWith("GS: action already executed");
    });

    it("non-committee member cannot propose", async () => {
      const { gs, student1, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await expect(
        gs.connect(stranger).committeePropose(id, ActionType.Debar, REMARK_CID)
      ).to.be.revertedWith("GS: caller is not committee member");
    });
  });

  // ── HoD actions ───────────────────────────────────────────────────────────

  describe("HoD actions", () => {
    async function setupAtHoD(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { gs, student1, committee1, committee2 } = fixture;
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);
      return id;
    }

    it("HoD can forward to Principal", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtHoD(fixture);
      await fixture.gs.connect(fixture.hod).hodAction(id, ActionType.Forward, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtPrincipal);
    });

    it("HoD forward sets correct threshold deadline", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtHoD(fixture);
      await fixture.gs.connect(fixture.hod).hodAction(id, ActionType.Forward, REMARK_CID);
      const g = await fixture.gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(THREE_DAYS), 5n);
    });

    it("HoD can revert to Committee", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtHoD(fixture);
      await fixture.gs.connect(fixture.hod).hodAction(id, ActionType.Revert, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("HoD can resolve → AwaitingFeedback", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtHoD(fixture);
      await fixture.gs.connect(fixture.hod).hodAction(id, ActionType.Resolve, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);
    });

    it("HoD cannot act when grievance is not AtHoD", async () => {
      const { gs, student1, hod } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1); // AtCommittee, not AtHoD
      await expect(
        gs.connect(hod).hodAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: grievance not at HoD level");
    });

    it("non-HoD cannot act", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtHoD(fixture);
      await expect(
        fixture.gs.connect(fixture.stranger).hodAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: caller is not HoD");
    });
  });

  // ── Principal actions ─────────────────────────────────────────────────────

  describe("Principal actions", () => {
    async function setupAtPrincipal(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { gs, student1, committee1, committee2, hod } = fixture;
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);
      await gs.connect(hod).hodAction(id, ActionType.Forward, REMARK_CID);
      return id;
    }

    it("Principal can resolve → AwaitingFeedback", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(fixture);
      await fixture.gs.connect(fixture.principal).principalAction(id, ActionType.Resolve, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);
    });

    it("Principal can revert to HoD", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(fixture);
      await fixture.gs.connect(fixture.principal).principalAction(id, ActionType.Revert, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);
    });

    it("Principal cannot act when grievance is not AtPrincipal", async () => {
      const { gs, student1, principal } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await expect(
        gs.connect(principal).principalAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: grievance not at Principal level");
    });

    it("non-Principal cannot act", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAtPrincipal(fixture);
      await expect(
        fixture.gs.connect(fixture.stranger).principalAction(id, ActionType.Resolve, REMARK_CID)
      ).to.be.revertedWith("GS: caller is not Principal");
    });
  });

  // ── Student feedback ──────────────────────────────────────────────────────

  describe("submitFeedback", () => {
    async function setupAwaitingFeedback(fixture: Awaited<ReturnType<typeof deployFixture>>) {
      const { gs, student1, committee1, committee2 } = fixture;
      const id = await submitGrievance(gs, student1);
      await gs.connect(committee1).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.executeCommitteeAction(id);
      return id;
    }

    it("satisfied feedback closes the grievance", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(fixture);
      await fixture.gs.connect(fixture.student1).submitFeedback(id, true, "");
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);
    });

    it("satisfied feedback removes from active list", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(fixture);
      await fixture.gs.connect(fixture.student1).submitFeedback(id, true, "");
      const active = await fixture.gs.getActiveGrievanceIds();
      expect(active).to.not.include(id);
    });

    it("unsatisfied feedback re-escalates to Committee", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(fixture);
      await fixture.gs.connect(fixture.student1).submitFeedback(id, false, REMARK_CID);
      expect((await fixture.gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);
    });

    it("unsatisfied feedback resets threshold deadline", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(fixture);
      await fixture.gs.connect(fixture.student1).submitFeedback(id, false, REMARK_CID);
      const g = await fixture.gs.getGrievance(id);
      const now = BigInt(await time.latest());
      expect(g.thresholdDeadline).to.be.closeTo(now + BigInt(SEVEN_DAYS), 5n);
    });

    it("wrong student cannot submit feedback", async () => {
      const fixture = await loadFixture(deployFixture);
      const id = await setupAwaitingFeedback(fixture);
      await expect(
        fixture.gs.connect(fixture.student2).submitFeedback(id, true, "")
      ).to.be.revertedWith("GS: not the grievance owner");
    });

    it("reverts if grievance is not AwaitingFeedback", async () => {
      const { gs, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await expect(
        gs.connect(student1).submitFeedback(id, true, "")
      ).to.be.revertedWith("GS: not awaiting feedback");
    });
  });

  // ── Auto-forward (threshold) ──────────────────────────────────────────────

  describe("adminAutoForward", () => {
    it("admin can auto-forward after threshold exceeded at Committee level", async () => {
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);

      // Fast-forward time past 7-day committee threshold
      await time.increase(SEVEN_DAYS + 1);

      await gs.connect(admin).adminAutoForward(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);
    });

    it("auto-forward logs ActionType.AutoForward in history", async () => {
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await time.increase(SEVEN_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id);

      const history = await gs.getActionHistory(id);
      const last = history[history.length - 1];
      expect(last.action).to.equal(ActionType.AutoForward);
    });

    it("reverts if threshold has not passed yet", async () => {
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      // Only 1 day has passed — not enough
      await time.increase(60 * 60 * 24);
      await expect(
        gs.connect(admin).adminAutoForward(id)
      ).to.be.revertedWith("GS: threshold not exceeded");
    });

    it("non-admin cannot call adminAutoForward", async () => {
      const { gs, student1, stranger } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await time.increase(SEVEN_DAYS + 1);
      await expect(
        gs.connect(stranger).adminAutoForward(id)
      ).to.be.revertedWith("GS: caller is not admin");
    });

    it("cannot auto-forward a Closed grievance", async () => {
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      const id = await submitGrievance(gs, student1);
      await time.increase(SEVEN_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id); // AtHoD now
      await time.increase(FIVE_DAYS + 1);
      await gs.connect(admin).adminAutoForward(id); // AtPrincipal now

      // Now at Principal — cannot auto-forward further
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
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      await gs.connect(admin).pause();
      await expect(
        gs.connect(student1).submitGrievance("A", "B", "CS", SAMPLE_CID, false)
      ).to.be.reverted; // EnforcedPause from OpenZeppelin Pausable
    });

    it("admin can unpause after pausing", async () => {
      const { gs, admin, student1 } = await loadFixture(deployFixture);
      await gs.connect(admin).pause();
      await gs.connect(admin).unpause();
      await expect(
        gs.connect(student1).submitGrievance("A", "B", "CS", SAMPLE_CID, false)
      ).to.not.be.reverted;
    });

    it("non-admin cannot pause", async () => {
      const { gs, stranger } = await loadFixture(deployFixture);
      await expect(gs.connect(stranger).pause()).to.be.revertedWith("GS: caller is not admin");
    });
  });

  // ── Full end-to-end happy path ────────────────────────────────────────────

  describe("Full lifecycle — satisfied resolution", () => {
    it("Student → Committee resolve → Student satisfied → Closed", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);

      // Submit
      const id = await submitGrievance(gs, student1);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);

      // Committee resolves
      await gs.connect(committee1).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.executeCommitteeAction(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);

      // Student satisfied
      await gs.connect(student1).submitFeedback(id, true, "");
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);

      // Audit trail has 3 entries: Submit, Resolve, FeedbackSatisfied
      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(3);
      expect(history[0].action).to.equal(ActionType.Submit);
      expect(history[1].action).to.equal(ActionType.Resolve);
      expect(history[2].action).to.equal(ActionType.FeedbackSatisfied);
    });
  });

  describe("Full lifecycle — full escalation path", () => {
    it("Student → Committee forward → HoD forward → Principal resolve → Satisfied → Closed", async () => {
      const { gs, student1, committee1, committee2, hod, principal } = await loadFixture(deployFixture);

      const id = await submitGrievance(gs, student1);

      // Committee forwards
      await gs.connect(committee1).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Forward, REMARK_CID);
      await gs.executeCommitteeAction(id);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtHoD);

      // HoD forwards
      await gs.connect(hod).hodAction(id, ActionType.Forward, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtPrincipal);

      // Principal resolves
      await gs.connect(principal).principalAction(id, ActionType.Resolve, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AwaitingFeedback);

      // Student satisfied
      await gs.connect(student1).submitFeedback(id, true, "");
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);

      // Full audit trail: Submit, Forward, Forward, Resolve, FeedbackSatisfied
      const history = await gs.getActionHistory(id);
      expect(history.length).to.equal(5);
    });
  });

  describe("Full lifecycle — unsatisfied then satisfied", () => {
    it("Student unsatisfied → re-escalated to Committee → resolved → satisfied → Closed", async () => {
      const { gs, student1, committee1, committee2 } = await loadFixture(deployFixture);

      const id = await submitGrievance(gs, student1);

      // First resolution attempt
      await gs.connect(committee1).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.executeCommitteeAction(id);

      // Student not satisfied — goes back to Committee
      await gs.connect(student1).submitFeedback(id, false, REMARK_CID);
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.AtCommittee);

      // Second resolution
      await gs.connect(committee1).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.connect(committee2).committeePropose(id, ActionType.Resolve, REMARK_CID);
      await gs.executeCommitteeAction(id);

      // Student satisfied this time
      await gs.connect(student1).submitFeedback(id, true, "");
      expect((await gs.getGrievance(id)).status).to.equal(GrievanceStatus.Closed);
    });
  });
});
