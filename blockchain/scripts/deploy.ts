import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deployment script for the Grievance Redressal System.
 *
 * What it does:
 *   1. Deploys GrievanceFactory
 *   2. Calls factory.createInstitute() to deploy RoleManager + GrievanceSystem
 *      for the institute configured in environment variables
 *   3. Writes all deployed addresses to deployments/<network>.json
 *      so the backend .env can be updated easily
 *
 * Usage:
 *   npm run deploy:local    (Hardhat local node)
 *   npm run deploy:besu     (Hyperledger Besu private network)
 *
 * Required env vars:
 *   INSTITUTE_ADMIN_ADDRESS   Wallet address of the institute admin
 *   INSTITUTE_NAME            Human-readable institute name
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("Deploying Grievance Redressal System");
  console.log("=".repeat(60));
  console.log(`Network:   ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("-".repeat(60));

  // ── 1. Deploy GrievanceFactory ───────────────────────────────────────────

  console.log("Deploying GrievanceFactory...");
  const Factory = await ethers.getContractFactory("GrievanceFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`GrievanceFactory deployed at: ${factoryAddress}`);

  // ── 2. Create an institute via the factory ───────────────────────────────

  const adminAddress   = process.env.INSTITUTE_ADMIN_ADDRESS || deployer.address;
  const instituteName  = process.env.INSTITUTE_NAME          || "Demo Institute";

  console.log(`\nCreating institute: "${instituteName}"`);
  console.log(`Institute admin:    ${adminAddress}`);

  const tx = await factory.createInstitute(adminAddress, instituteName);
  const receipt = await tx.wait();

  // Parse the InstituteCreated event to get the deployed contract addresses
  const iface = factory.interface;
  let roleManagerAddress   = "";
  let grievanceSystemAddress = "";
  let instituteId = 0;

  if (receipt && receipt.logs) {
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === "InstituteCreated") {
          instituteId            = Number(parsed.args.instituteId);
          roleManagerAddress     = parsed.args.roleManager;
          grievanceSystemAddress = parsed.args.grievanceSystem;
        }
      } catch {
        // Skip logs that don't match
      }
    }
  }

  console.log(`\nInstitute ID:      ${instituteId}`);
  console.log(`RoleManager:       ${roleManagerAddress}`);
  console.log(`GrievanceSystem:   ${grievanceSystemAddress}`);

  // ── 3. Write deployment addresses to file ────────────────────────────────

  const deploymentData = {
    network:          network.name,
    chainId:          Number(network.chainId),
    deployedAt:       new Date().toISOString(),
    deployer:         deployer.address,
    factory:          factoryAddress,
    institute: {
      id:               instituteId,
      name:             instituteName,
      admin:            adminAddress,
      roleManager:      roleManagerAddress,
      grievanceSystem:  grievanceSystemAddress,
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deploymentData, null, 2));

  console.log(`\nDeployment info saved to: deployments/${network.name}.json`);
  console.log("=".repeat(60));
  console.log("Add these to your backend .env:");
  console.log(`CONTRACT_ROLE_MANAGER=${roleManagerAddress}`);
  console.log(`CONTRACT_GRIEVANCE_SYSTEM=${grievanceSystemAddress}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
