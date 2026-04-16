import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY =
  process.env.DEPLOYER_PRIVATE_KEY ||
  // Default Hardhat account #0 — safe to commit, only used on local node
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // ── Local Hardhat node (default for development) ──────────────────────
    hardhat: {
      chainId: 1337,
    },

    // ── Local Hardhat node when running as a persistent daemon ─────────────
    // Start with: npx hardhat node
    // Deploy with: npm run deploy:local
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 1337,
    },

    // ── Hyperledger Besu private network ──────────────────────────────────
    // Set BESU_RPC_URL in .env to your Besu node's HTTP RPC endpoint
    // e.g. BESU_RPC_URL=http://192.168.1.10:8545
    besu: {
      url: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      chainId: Number(process.env.BESU_CHAIN_ID) || 1337,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 0,
    },

    // ── Sepolia testnet (hosted demo via Alchemy) ──────────────────────────
    // 1. Sign up at alchemy.com → create app → Ethereum → Sepolia
    // 2. Set ALCHEMY_SEPOLIA_URL in blockchain/.env
    // 3. Set DEPLOYER_PRIVATE_KEY to a wallet that has Sepolia ETH
    //    (get free ETH from sepoliafaucet.com)
    // Deploy: npx hardhat run scripts/deploy.ts --network sepolia
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      chainId: 11155111,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },

  // Path config — keep defaults, explicit for clarity
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Generates TypeChain types into typechain-types/
  // Import them in tests + scripts for full type safety
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
