import * as fs from "fs";
import * as path from "path";

/**
 * Copies the compiled contract ABIs from Hardhat artifacts into
 * backend/app/services/abis/ so the Python backend can load them.
 *
 * Run after every `npm run compile`:
 *   npm run export-abis
 */

const CONTRACTS = ["GrievanceSystem", "RoleManager", "GrievanceFactory"];

const ARTIFACTS_DIR = path.join(__dirname, "..", "artifacts", "contracts");
const OUTPUT_DIR    = path.join(__dirname, "..", "..", "backend", "app", "services", "abis");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

for (const name of CONTRACTS) {
  const src = path.join(ARTIFACTS_DIR, `${name}.sol`, `${name}.json`);

  if (!fs.existsSync(src)) {
    console.error(`[export-abis] Artifact not found: ${src}`);
    console.error(`  Run "npm run compile" first.`);
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(src, "utf-8"));
  const out = path.join(OUTPUT_DIR, `${name}.json`);

  // Write only the ABI array — backend doesn't need bytecode
  fs.writeFileSync(out, JSON.stringify(artifact.abi, null, 2));
  console.log(`[export-abis] ${name}.json → ${out}`);
}

console.log("[export-abis] Done.");
