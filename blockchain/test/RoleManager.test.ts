import { expect } from "chai";
import { ethers } from "hardhat";
import { RoleManager } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("RoleManager", () => {
  let roleManager: RoleManager;
  let admin: SignerWithAddress;
  let student: SignerWithAddress;
  let committee: SignerWithAddress;
  let hod: SignerWithAddress;
  let principal: SignerWithAddress;
  let stranger: SignerWithAddress;

  // Role constants — must match the contract
  const STUDENT_ROLE   = ethers.keccak256(ethers.toUtf8Bytes("STUDENT_ROLE"));
  const COMMITTEE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("COMMITTEE_ROLE"));
  const HOD_ROLE       = ethers.keccak256(ethers.toUtf8Bytes("HOD_ROLE"));
  const PRINCIPAL_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PRINCIPAL_ROLE"));
  const ADMIN_ROLE     = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

  beforeEach(async () => {
    [admin, student, committee, hod, principal, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RoleManager");
    roleManager   = await Factory.deploy(admin.address);
    await roleManager.waitForDeployment();
  });

  // ── Deployment ─────────────────────────────────────────────────────────────

  describe("Deployment", () => {
    it("grants DEFAULT_ADMIN_ROLE and ADMIN_ROLE to the deployer", async () => {
      const DEFAULT_ADMIN = await roleManager.DEFAULT_ADMIN_ROLE();
      expect(await roleManager.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
      expect(await roleManager.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("does not grant any role to other accounts", async () => {
      expect(await roleManager.hasRole(STUDENT_ROLE,   stranger.address)).to.be.false;
      expect(await roleManager.hasRole(COMMITTEE_ROLE, stranger.address)).to.be.false;
      expect(await roleManager.hasRole(HOD_ROLE,       stranger.address)).to.be.false;
      expect(await roleManager.hasRole(PRINCIPAL_ROLE, stranger.address)).to.be.false;
    });
  });

  // ── Granting roles ─────────────────────────────────────────────────────────

  describe("grantUserRole", () => {
    it("admin can grant STUDENT_ROLE", async () => {
      await roleManager.connect(admin).grantUserRole(STUDENT_ROLE, student.address);
      expect(await roleManager.isStudent(student.address)).to.be.true;
    });

    it("admin can grant COMMITTEE_ROLE", async () => {
      await roleManager.connect(admin).grantUserRole(COMMITTEE_ROLE, committee.address);
      expect(await roleManager.isCommitteeMember(committee.address)).to.be.true;
    });

    it("admin can grant HOD_ROLE", async () => {
      await roleManager.connect(admin).grantUserRole(HOD_ROLE, hod.address);
      expect(await roleManager.isHoD(hod.address)).to.be.true;
    });

    it("admin can grant PRINCIPAL_ROLE", async () => {
      await roleManager.connect(admin).grantUserRole(PRINCIPAL_ROLE, principal.address);
      expect(await roleManager.isPrincipal(principal.address)).to.be.true;
    });

    it("emits RoleGrantedToUser event", async () => {
      await expect(
        roleManager.connect(admin).grantUserRole(STUDENT_ROLE, student.address)
      )
        .to.emit(roleManager, "RoleGrantedToUser")
        .withArgs(STUDENT_ROLE, student.address, admin.address);
    });

    it("reverts when a non-admin tries to grant a role", async () => {
      await expect(
        roleManager.connect(stranger).grantUserRole(STUDENT_ROLE, student.address)
      ).to.be.reverted;
    });
  });

  // ── Revoking roles ─────────────────────────────────────────────────────────

  describe("revokeUserRole", () => {
    beforeEach(async () => {
      // Grant the role first
      await roleManager.connect(admin).grantUserRole(STUDENT_ROLE, student.address);
    });

    it("admin can revoke a role", async () => {
      await roleManager.connect(admin).revokeUserRole(STUDENT_ROLE, student.address);
      expect(await roleManager.isStudent(student.address)).to.be.false;
    });

    it("emits RoleRevokedFromUser event", async () => {
      await expect(
        roleManager.connect(admin).revokeUserRole(STUDENT_ROLE, student.address)
      )
        .to.emit(roleManager, "RoleRevokedFromUser")
        .withArgs(STUDENT_ROLE, student.address, admin.address);
    });

    it("reverts when a non-admin tries to revoke a role", async () => {
      await expect(
        roleManager.connect(stranger).revokeUserRole(STUDENT_ROLE, student.address)
      ).to.be.reverted;
    });
  });

  // ── View helpers ───────────────────────────────────────────────────────────

  describe("View helpers", () => {
    it("isAdmin returns true for admin, false for others", async () => {
      expect(await roleManager.isAdmin(admin.address)).to.be.true;
      expect(await roleManager.isAdmin(stranger.address)).to.be.false;
    });

    it("isStudent is false before grant, true after", async () => {
      expect(await roleManager.isStudent(student.address)).to.be.false;
      await roleManager.connect(admin).grantUserRole(STUDENT_ROLE, student.address);
      expect(await roleManager.isStudent(student.address)).to.be.true;
    });

    it("an account can hold multiple roles simultaneously", async () => {
      // Edge case: an admin who is also on the committee
      await roleManager.connect(admin).grantUserRole(COMMITTEE_ROLE, admin.address);
      expect(await roleManager.isAdmin(admin.address)).to.be.true;
      expect(await roleManager.isCommitteeMember(admin.address)).to.be.true;
    });
  });
});
