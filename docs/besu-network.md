# Hyperledger Besu — Private Network Setup

This guide sets up a 3-node IBFT 2.0 private network (zero gas cost) for the Grievance Portal.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Java | 21+ | `apt install openjdk-21-jre` / Homebrew |
| Hyperledger Besu | 24.x | https://github.com/hyperledger/besu/releases |
| Node.js | 20+ | https://nodejs.org |

Verify: `besu --version`

---

## 1. Generate Validator Keys

Create a working directory and generate keys for 3 validators:

```bash
mkdir -p besu-network/{node1,node2,node3}/data
cd besu-network

# Generate a key pair for each node
besu --data-path=node1/data public-key export-address --to=node1/address
besu --data-path=node node1/data public-key export --to=node1/pubkey

besu --data-path=node2/data public-key export-address --to=node2/address
besu --data-path=node2/data public-key export --to=node2/pubkey

besu --data-path=node3/data public-key export-address --to=node3/address
besu --data-path=node3/data public-key export --to=node3/pubkey
```

Each `data/` directory now contains a `key` file (private key). **Back these up.**

---

## 2. Generate IBFT 2.0 Genesis File

Use the IBFT extra-data encoder. Replace the addresses below with the output of step 1:

```bash
besu operator generate-blockchain-config \
  --config-file=ibft2-config.json \
  --to=network-files \
  --private-key-file-name=key
```

Create `ibft2-config.json`:

```json
{
  "genesis": {
    "config": {
      "chainId": 1337,
      "berlinBlock": 0,
      "ibft2": {
        "blockperiodseconds": 2,
        "epochlength": 30000,
        "requesttimeoutseconds": 4
      }
    },
    "nonce": "0x0",
    "timestamp": "0x58ee40ba",
    "gasLimit": "0x1fffffffffffff",
    "difficulty": "0x1",
    "mixHash": "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    "alloc": {
      "RELAY_WALLET_ADDRESS": {
        "balance": "0xad78ebc5ac6200000"
      }
    }
  },
  "blockchain": {
    "nodes": {
      "generate": true,
      "count": 3
    }
  }
}
```

Replace `RELAY_WALLET_ADDRESS` with the address corresponding to `RELAY_WALLET_PRIVATE_KEY` in your backend `.env`.

---

## 3. Configure Each Node

### `node1/config.toml`

```toml
data-path = "data"
genesis-file = "../genesis.json"

p2p-port = 30303
rpc-http-enabled = true
rpc-http-port    = 8545
rpc-http-api     = ["ETH","NET","IBFT","WEB3","DEBUG"]
rpc-http-cors-origins = ["*"]

# Allow connections from the backend container
host-allowlist = ["*"]

# No gas price on private network
min-gas-price = 0

# Logging
logging = "INFO"
```

Copy this config to `node2/config.toml` (change `p2p-port=30304`, `rpc-http-port=8546`) and `node3/config.toml` (`p2p-port=30305`, `rpc-http-port=8547`).

---

## 4. Start the Network

Open three separate terminals:

```bash
# Terminal 1 — bootnode (node1)
cd besu-network
besu --config-file=node1/config.toml

# Terminal 2 — node2 (add node1's enode URL from its startup output)
besu --config-file=node2/config.toml \
  --bootnodes=enode://NODE1_PUBKEY@127.0.0.1:30303

# Terminal 3 — node3
besu --config-file=node3/config.toml \
  --bootnodes=enode://NODE1_PUBKEY@127.0.0.1:30303
```

Confirm consensus is running:

```bash
curl -s http://127.0.0.1:8545 \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"ibft_getValidatorsByBlockNumber","params":["latest"],"id":1}'
```

You should see 3 validator addresses.

---

## 5. Deploy Contracts

With the network running, set `BESU_RPC_URL=http://127.0.0.1:8545` in the blockchain `.env` (or `hardhat.config.ts`), then:

```bash
cd blockchain
npm install
npm run compile
npm run export-abis        # copies ABIs to backend/app/services/abis/
npx hardhat run scripts/deploy.ts --network besu
```

The deploy script prints the `RoleManager` and `GrievanceSystem` addresses. Copy them to `backend/.env`:

```
CONTRACT_ROLE_MANAGER=0x...
CONTRACT_GRIEVANCE_SYSTEM=0x...
```

---

## 6. Verify the Relay Wallet

The relay wallet must have enough ETH to sign transactions. Because `gasPrice=0`, no real cost is incurred, but the balance must be non-zero for Web3 to accept the transaction.

The genesis file above pre-funds the relay wallet address with 200 ETH. Confirm:

```bash
curl -s http://127.0.0.1:8545 \
  -X POST -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$RELAY_WALLET_ADDRESS\",\"latest\"],\"id\":1}"
```

---

## 7. Production: Running Besu as a Service

For a persistent deployment, use `systemd`:

```ini
# /etc/systemd/system/besu-node1.service
[Unit]
Description=Hyperledger Besu Node 1
After=network.target

[Service]
User=besu
WorkingDirectory=/opt/besu-network
ExecStart=/usr/local/bin/besu --config-file=node1/config.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable besu-node1 && sudo systemctl start besu-node1
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `HH502` during `hardhat compile` | Sandbox blocks outbound. Run compile on your local machine (not the server). |
| `ConnectionRefusedError` from backend | Check `BESU_RPC_URL` and that node1 RPC port is reachable. |
| Blocks not finalising | Ensure at least 2 of 3 validators are running (IBFT needs ⌊2/3⌋+1 = 2). |
| `nonce too low` transaction errors | Relay wallet nonce is tracked by the node; restart the backend to reset the nonce cache. |
