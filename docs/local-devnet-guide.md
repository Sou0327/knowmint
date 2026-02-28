# Local Devnet Testing Guide

End-to-end purchase flow using a local Solana validator and local Supabase.

## Prerequisites

- Node.js 22.6+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase`)
- [Solana CLI](https://docs.solanalabs.com/cli/install) (`solana`, `solana-test-validator`)
- [Phantom Wallet](https://phantom.app/) browser extension (for browser testing)

## Step 1: Start Local Supabase

```bash
npx supabase start
```

Note the `API URL`, `anon key`, and `service_role key` from the output.

## Step 2: Start Local Solana Validator

```bash
# In a separate terminal
solana-test-validator --reset --quiet
```

RPC endpoint: `http://127.0.0.1:8899`

## Step 3: Configure Environment Variables

Create `.env.local` with the following (back up any existing file):

```bash
# Supabase (local — use values from supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>

# Solana (local validator)
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899

# P2P direct transfer mode (smart contract disabled)
NEXT_PUBLIC_KM_PROGRAM_ID=
NEXT_PUBLIC_FEE_VAULT_ADDRESS=

# x402 network identifier for local/devnet testing
X402_NETWORK=solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1
```

## Step 4: Start Dev Server

```bash
npm run dev
```

## Step 5: Browser Testing

### 5a. Switch Phantom Wallet to Devnet

1. Phantom → Settings → Developer Settings
2. Enable Testnet Mode
3. Select Solana Devnet
4. Set Custom RPC to `http://127.0.0.1:8899` (for local validator)

### 5b. Create Test Accounts

1. Go to `http://localhost:3000/signup` and create a **seller account**
2. Connect Phantom wallet → wallet address is linked to the profile
3. Log out
4. Create a **buyer account** with a different email
5. Connect a different Phantom wallet (or switch accounts)

### 5c. Airdrop Test SOL

```bash
# Airdrop SOL to both seller and buyer Phantom addresses
solana airdrop 10 <seller-phantom-address> --url http://127.0.0.1:8899
solana airdrop 10 <buyer-phantom-address> --url http://127.0.0.1:8899
```

### 5d. List → Purchase Flow

1. **Seller**: Log in → list knowledge from `/list` (set SOL price, e.g., 0.01 SOL)
2. After listing → publish from dashboard
3. **Buyer**: Log in → open the listed knowledge detail page
4. Click "Purchase" → select token (SOL) → accept terms → sign with Phantom
5. Purchase complete → content appears in library

## Step 6: Script Testing (API)

Run the full flow via script without a browser.

**Prerequisites for script testing:**

1. Generate a buyer keypair:
   ```bash
   node scripts/e2e/devnet-setup.mjs
   ```
   > **Note**: The script also generates `devnet-seller-keypair.json`, but this is **not** used for `TEST_SELLER_WALLET`. The seller's wallet address must match the one linked to the seller's profile (see step 4).
2. Create a buyer account via the web UI or API and link the generated buyer keypair's public key as the wallet address.
3. Create an API key for the buyer account at `/profile` → API Keys (or via `POST /api/v1/keys`). Use this as `TEST_API_KEY_BUYER`.
4. Set up the seller: create a seller account and connect a wallet (e.g., via Phantom in Step 5). The wallet address linked to the seller profile is your `TEST_SELLER_WALLET`.
5. List and publish a knowledge item as the seller. Copy the item UUID from the URL (`/knowledge/<uuid>`) for `KM_TEST_KNOWLEDGE_ID`.

```bash
# Airdrop test SOL
solana airdrop 10 <buyer-pubkey> --url http://127.0.0.1:8899

# Run E2E test
TEST_API_KEY_BUYER=km_xxx \
KM_TEST_KNOWLEDGE_ID=<listed item UUID> \
TEST_BUYER_KEYPAIR_PATH=./devnet-buyer-keypair.json \
TEST_SELLER_WALLET=<seller wallet address> \
KM_BASE_URL=http://127.0.0.1:3000 \
NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 \
node scripts/e2e/devnet-purchase-flow.mjs
```

Expected output on success:

```
[Step 1] PASS — price_sol = 0.01
[Step 2] PASS — no prior purchase detected
[Step 3] PASS — buyer balance = 10000000000 lamports
[Step 4] PASS — tx_hash = 5wH...abc
[Step 5] PASS — purchase confirmed (tx_id = xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
[Step 6] PASS — content fetched
PASS: devnet purchase flow completed successfully
```

## Notes

- When `NEXT_PUBLIC_KM_PROGRAM_ID` and `NEXT_PUBLIC_FEE_VAULT_ADDRESS` are empty, the system runs in **P2P direct transfer mode** (full amount sent to seller, no fee split).
- `verify-transaction.ts` performs on-chain verification, so **real transfer transactions are required** (fake tx hashes are rejected).
- Restarting the local validator with `--reset` clears all transaction history.
- Test keypair files (`devnet-*-keypair.json`) are in `.gitignore`.
