/**
 * Shared purchase recording core (RP6 B-13).
 *
 * `POST /api/v1/knowledge/[id]/purchase` (API route) and the Server Action
 * `recordPurchase()` used to each carry their own copy of the "idempotency
 * check → wallet lookup → on-chain verification → DB insert → RPC confirm"
 * pipeline. Divergence between the two copies caused real production bugs
 * (different error codes for the same state). This module is the single
 * source of truth for that flow.
 *
 * Design principles:
 *  - Pure I/O core: the caller owns email/notification/audit side effects.
 *  - Returns a discriminated union (`{ ok: true | false }`), not `Response`,
 *    so API routes and Server Actions can map to their own error surfaces.
 *  - Accepts an injected `SupabaseClient` so unit tests can mock the
 *    service-role client without touching `getAdminClient()` globals.
 *  - Uses the canonical helpers in `@/lib/solana/{canonical,fees}` so any
 *    future change to wallet canonicalization or fee math stays in one place.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";
import {
  isValidSolanaTxHash,
  verifySolanaPurchaseTransaction,
} from "@/lib/solana/verify-transaction";
import { computeProtocolFee } from "@/lib/solana/fees";
import { getProgramId, getFeeVault } from "@/lib/solana/program";
import type { Chain, Database, Token, Transaction } from "@/types/database.types";

// Typed Supabase client. `any` bypasses the strict generated row types that
// some downstream callers pass but do not want to propagate.
type Admin = SupabaseClient<Database>;

export type PurchaseErrorCode =
  | "bad_request"
  | "not_found"
  | "conflict"
  | "verification_failed"
  | "internal";

export interface PurchaseCoreInput {
  admin: Admin;
  userId: string;
  knowledgeId: string;
  txHash: string;
  token: Token;
  chain: Chain;
}

export type PurchaseCoreItem = {
  id: string;
  seller_id: string;
  status: string;
  listing_type: string;
  price_sol: number | null;
  price_usdc: number | null;
  title: string | null;
};

export type PurchaseCoreWalletProfile = {
  id: string;
  wallet_address: string | null;
  display_name: string | null;
};

export type PurchaseCoreSuccess = {
  ok: true;
  /** Fully-hydrated confirmed transaction row. */
  transaction: Transaction;
  /**
   * `true` when this call inserted the row, `false` on idempotent replay.
   * Idempotent replays skip downstream side effects (email, audit) so they
   * return only `transaction` and omit the ancillary item/profile data.
   */
  created: boolean;
  /** Present only when `created === true` (newly inserted row). */
  item?: PurchaseCoreItem;
  buyerProfile?: PurchaseCoreWalletProfile;
  sellerProfile?: PurchaseCoreWalletProfile;
};

export type PurchaseCoreFailure = {
  ok: false;
  code: PurchaseErrorCode;
  /** Stable string key for callers to map to i18n messages. */
  reason: string;
};

export type PurchaseCoreResult = PurchaseCoreSuccess | PurchaseCoreFailure;

const TX_SELECT_COLUMNS =
  "id, buyer_id, seller_id, knowledge_item_id, amount, token, chain, tx_hash, status, protocol_fee, fee_vault_address, created_at, updated_at" as const;

function fail(code: PurchaseErrorCode, reason: string): PurchaseCoreFailure {
  return { ok: false, code, reason };
}

function canonicalizeWallet(raw: string): string | null {
  try {
    return new PublicKey(raw).toBase58();
  } catch {
    return null;
  }
}

/**
 * Run the shared purchase recording pipeline.
 *
 * Callers must already have authenticated the `userId`. This function does
 * NOT authorize — it trusts that the request was gated upstream. It only
 * guards business invariants (ownership, status, price, canonical wallets,
 * on-chain verification, idempotency).
 */
export async function recordPurchaseCore(
  input: PurchaseCoreInput,
): Promise<PurchaseCoreResult> {
  const { admin, userId, knowledgeId, token, chain } = input;
  const txHash = input.txHash.trim();

  if (!txHash) return fail("bad_request", "tx_hash_required");
  if (chain !== "solana")
    return fail("bad_request", "chain_not_supported");
  if (token !== "SOL" && token !== "USDC")
    return fail("bad_request", "token_not_supported");

  // Fast-path: buyer already has a confirmed purchase for this item.
  const { data: confirmedTx, error: confirmedErr } = await admin
    .from("transactions")
    .select(TX_SELECT_COLUMNS)
    .eq("buyer_id", userId)
    .eq("knowledge_item_id", knowledgeId)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();
  if (confirmedErr) {
    console.error("[purchase-core] confirmed lookup failed", {
      userId,
      knowledgeId,
      error: confirmedErr,
    });
    return fail("internal", "database_error");
  }
  if (confirmedTx) {
    // Idempotent replay: downstream side effects (email/audit) are gated on
    // `created === true`, so we do not need to rehydrate item/wallet rows.
    return {
      ok: true,
      created: false,
      transaction: confirmedTx as Transaction,
    };
  }

  // Idempotency by tx_hash (same buyer/item may be pending/failed from a
  // previous attempt). Other buyers/items with the same hash are a hard
  // conflict.
  const { data: existingByHash, error: existingByHashErr } = await admin
    .from("transactions")
    .select(TX_SELECT_COLUMNS)
    .eq("tx_hash", txHash)
    .maybeSingle();
  if (existingByHashErr) {
    console.error("[purchase-core] tx_hash lookup failed", {
      userId,
      knowledgeId,
      error: existingByHashErr,
    });
    return fail("internal", "database_error");
  }

  if (existingByHash) {
    const matchesBuyer =
      existingByHash.buyer_id === userId &&
      existingByHash.knowledge_item_id === knowledgeId;
    if (!matchesBuyer) {
      return fail("conflict", "tx_hash_already_used");
    }
    if (existingByHash.status === "confirmed") {
      return {
        ok: true,
        created: false,
        transaction: existingByHash as Transaction,
      };
    }
    if (existingByHash.status === "pending") {
      const retried = await retryConfirm(
        admin,
        existingByHash as Transaction,
      );
      if (retried.ok) {
        return {
          ok: true,
          created: false,
          transaction: retried.tx,
        };
      }
      return retried.result;
    }
    // failed / refunded — do not silently re-enable.
    return fail("conflict", "tx_hash_already_used");
  }

  // Upfront hash format guard — avoids unnecessary profile / on-chain
  // lookups for obviously malformed input.
  if (!isValidSolanaTxHash(txHash)) {
    return fail("bad_request", "invalid_tx_hash_format");
  }

  // Load item and authorize.
  const { data: item, error: itemErr } = await admin
    .from("knowledge_items")
    .select("id, seller_id, status, listing_type, price_sol, price_usdc, title")
    .eq("id", knowledgeId)
    .single();
  if (itemErr || !item) return fail("not_found", "item_not_found");
  if (item.status !== "published")
    return fail("bad_request", "item_not_published");
  if (item.listing_type === "request")
    return fail("bad_request", "request_listing_not_purchasable");
  if (item.seller_id === userId)
    return fail("bad_request", "self_purchase_forbidden");

  const expectedAmount = token === "USDC" ? item.price_usdc : item.price_sol;
  if (
    expectedAmount === null ||
    expectedAmount === undefined ||
    expectedAmount <= 0
  ) {
    return fail("bad_request", "price_not_set_for_token");
  }

  const { data: walletProfiles, error: walletErr } = await admin
    .from("profiles")
    .select("id, wallet_address, display_name")
    .in("id", [item.seller_id, userId]);
  if (walletErr || !walletProfiles || walletProfiles.length < 2) {
    console.error("[purchase-core] wallet profile lookup failed", {
      userId,
      knowledgeId,
      error: walletErr,
    });
    return fail("internal", "wallet_lookup_failed");
  }

  const sellerProfile = walletProfiles.find(
    (p) => p.id === item.seller_id,
  ) as PurchaseCoreWalletProfile | undefined;
  const buyerProfile = walletProfiles.find(
    (p) => p.id === userId,
  ) as PurchaseCoreWalletProfile | undefined;

  if (!sellerProfile?.wallet_address || !buyerProfile?.wallet_address) {
    return fail("bad_request", "wallet_not_configured");
  }

  const sellerWallet = canonicalizeWallet(sellerProfile.wallet_address);
  const buyerWallet = canonicalizeWallet(buyerProfile.wallet_address);
  if (!sellerWallet || !buyerWallet) {
    return fail("internal", "invalid_wallet_format");
  }

  // Smart-contract split is gated on BOTH env vars being parseable. We go
  // through program.ts so server-only `KM_*` secrets take precedence over
  // the build-time `NEXT_PUBLIC_*` fallbacks (RP6 B-9).
  const programIdKey = getProgramId();
  const feeVaultKey = getFeeVault();
  const smartContractEnabled = programIdKey !== null && feeVaultKey !== null;
  const programId = smartContractEnabled
    ? programIdKey!.toBase58()
    : undefined;
  const feeVaultAddress = smartContractEnabled
    ? feeVaultKey!.toBase58()
    : undefined;

  const verification = await verifySolanaPurchaseTransaction({
    txHash,
    token,
    expectedRecipient: sellerWallet,
    expectedAmount,
    expectedSender: buyerWallet,
    feeVaultAddress,
    programId,
  });
  if (!verification.valid) {
    console.error("[purchase-core] verification failed", {
      userId,
      knowledgeId,
      error: verification.error,
    });
    return fail("verification_failed", "verification_failed");
  }

  // Insert pending row and then atomically confirm via RPC.
  const protocolFee = computeProtocolFee(
    expectedAmount,
    token,
    Boolean(feeVaultAddress),
  );
  const { data: transaction, error: insertErr } = await admin
    .from("transactions")
    .insert({
      buyer_id: userId,
      seller_id: item.seller_id,
      knowledge_item_id: knowledgeId,
      amount: expectedAmount,
      token,
      chain,
      tx_hash: txHash,
      status: "pending",
      protocol_fee: protocolFee,
      fee_vault_address: feeVaultAddress ?? null,
    })
    .select(TX_SELECT_COLUMNS)
    .single();

  if (insertErr || !transaction) {
    if (insertErr?.code === "23505") {
      // Concurrent insert: re-read and accept iff it matches us + confirmed.
      const { data: race } = await admin
        .from("transactions")
        .select(TX_SELECT_COLUMNS)
        .eq("tx_hash", txHash)
        .maybeSingle();
      if (
        race &&
        race.buyer_id === userId &&
        race.knowledge_item_id === knowledgeId &&
        race.status === "confirmed"
      ) {
        return {
          ok: true,
          created: false,
          transaction: race as Transaction,
          item,
          buyerProfile,
          sellerProfile,
        };
      }
      return fail("conflict", "tx_hash_already_used");
    }
    console.error("[purchase-core] insert failed", {
      userId,
      knowledgeId,
      error: insertErr,
    });
    return fail("internal", "insert_failed");
  }

  const { data: confirmCount, error: confirmErr } = await admin.rpc(
    "confirm_transaction",
    { tx_id: transaction.id as string },
  );
  if (confirmErr) {
    console.error("[purchase-core] confirm_transaction rpc failed", {
      userId,
      knowledgeId,
      error: confirmErr,
    });
    return fail("verification_failed", "confirm_failed");
  }

  if (confirmCount === 1) {
    const confirmedRow = { ...(transaction as Transaction), status: "confirmed" as const };
    return {
      ok: true,
      created: true,
      transaction: confirmedRow,
      item,
      buyerProfile,
      sellerProfile,
    };
  }

  // RPC returned 0 — a concurrent request beat us. Re-read to verify.
  const { data: recheckTx, error: recheckErr } = await admin
    .from("transactions")
    .select(TX_SELECT_COLUMNS)
    .eq("id", transaction.id as string)
    .single();
  if (recheckErr || !recheckTx) {
    console.error("[purchase-core] confirm recheck failed", {
      userId,
      knowledgeId,
      txId: transaction.id,
      error: recheckErr,
    });
    return fail("internal", "recheck_failed");
  }
  if (recheckTx.status !== "confirmed") {
    return fail("verification_failed", "confirm_failed");
  }
  return {
    ok: true,
    created: false,
    transaction: recheckTx as Transaction,
    item,
    buyerProfile,
    sellerProfile,
  };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

async function retryConfirm(
  admin: Admin,
  existingTx: Transaction,
): Promise<
  | { ok: true; tx: Transaction }
  | { ok: false; result: PurchaseCoreFailure }
> {
  const txId = existingTx.id as string;
  const { data: retryCount, error: retryErr } = await admin.rpc(
    "confirm_transaction",
    { tx_id: txId },
  );
  if (retryErr) {
    console.error("[purchase-core] retry confirm failed", { txId, error: retryErr });
    return { ok: false, result: fail("verification_failed", "confirm_retry_failed") };
  }
  if (retryCount === 1) {
    // Confirmed by this retry. Reuse the pending row with patched status —
    // avoids an extra SELECT that the call sites do not need.
    return {
      ok: true,
      tx: { ...existingTx, status: "confirmed" as const },
    };
  }
  // RPC returned 0 — another worker already confirmed or the tx is no longer
  // eligible. Re-read to decide which.
  const { data: recheck } = await admin
    .from("transactions")
    .select(TX_SELECT_COLUMNS)
    .eq("id", txId)
    .single();
  if (recheck && recheck.status === "confirmed") {
    return { ok: true, tx: recheck as Transaction };
  }
  return { ok: false, result: fail("verification_failed", "confirm_retry_failed") };
}

async function loadAncillary(
  admin: Admin,
  knowledgeId: string,
  userId: string,
): Promise<
  | {
      ok: true;
      item: PurchaseCoreItem;
      buyerProfile: PurchaseCoreWalletProfile;
      sellerProfile: PurchaseCoreWalletProfile;
    }
  | { ok: false; result: PurchaseCoreFailure }
> {
  const { data: item, error: itemErr } = await admin
    .from("knowledge_items")
    .select("id, seller_id, status, listing_type, price_sol, price_usdc, title")
    .eq("id", knowledgeId)
    .single();
  if (itemErr || !item) return { ok: false, result: fail("not_found", "item_not_found") };

  const { data: walletProfiles, error: walletErr } = await admin
    .from("profiles")
    .select("id, wallet_address, display_name")
    .in("id", [item.seller_id, userId]);
  if (walletErr || !walletProfiles) {
    return { ok: false, result: fail("internal", "wallet_lookup_failed") };
  }
  const buyerProfile = (walletProfiles.find((p) => p.id === userId) ?? {
    id: userId,
    wallet_address: null,
    display_name: null,
  }) as PurchaseCoreWalletProfile;
  const sellerProfile = (walletProfiles.find(
    (p) => p.id === item.seller_id,
  ) ?? {
    id: item.seller_id,
    wallet_address: null,
    display_name: null,
  }) as PurchaseCoreWalletProfile;
  return { ok: true, item, buyerProfile, sellerProfile };
}
