#!/usr/bin/env bash
set -e

echo "=== Sepolia Deployment Script ==="

# Check Node
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VERSION=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "ERROR: Node.js 18+ required (you have v$NODE_VERSION)"
  exit 1
fi

# Write .env
cat > .env << 'EOF'
DEPLOYER_PRIVATE_KEY=0x84d44d49d0e37e748f1eaece1a42509f4b00573d07908fe3c61a725188eb6ef7
ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/qGDGHOjRoKT9q3SR_4wSl
EOF

echo "✓ .env written"
echo "Installing dependencies..."
npm install --silent

echo "Compiling contracts..."
npx hardhat compile

echo "Deploying to Sepolia (this may take ~30s)..."
npx hardhat run scripts/deploy.ts --network sepolia

echo ""
echo "=== DONE ==="
echo "Copy the two addresses above into backend/.env:"
echo "  CONTRACT_ROLE_MANAGER=0x..."
echo "  CONTRACT_GRIEVANCE_SYSTEM=0x..."
echo ""
echo "Then run: npm run export-abis"
