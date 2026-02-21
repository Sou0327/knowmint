import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { KnowledgeMarket } from "../target/types/knowledge_market";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";

describe("knowledge-market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.KnowledgeMarket as Program<KnowledgeMarket>;

  // テストウォレット
  const buyer = provider.wallet as anchor.Wallet;
  const seller = anchor.web3.Keypair.generate();

  // devnet Fee Vault: GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc
  const FEE_VAULT_PUBKEY = new PublicKey("GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc");

  before(async () => {
    // seller と fee_vault に SOL を送金 (devnet airdrop はレート制限があるため buyer から直接送金)
    // fee_vault は rent-exempt 最低額が必要 (約 0.00089 SOL)
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: buyer.publicKey,
        toPubkey: seller.publicKey,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      }),
      SystemProgram.transfer({
        fromPubkey: buyer.publicKey,
        toPubkey: FEE_VAULT_PUBKEY,
        lamports: 0.01 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx);
  });

  it("SOL 95/5 分配が正確に行われること", async () => {
    const amount = new BN(1_000_000); // 0.001 SOL in lamports
    const sellerBefore = await provider.connection.getBalance(seller.publicKey);
    const feeVaultBefore = await provider.connection.getBalance(FEE_VAULT_PUBKEY);

    await program.methods
      .executePurchase(amount)
      .accounts({
        buyer: buyer.publicKey,
        seller: seller.publicKey,
      })
      .rpc();

    const sellerAfter = await provider.connection.getBalance(seller.publicKey);
    const feeVaultAfter = await provider.connection.getBalance(FEE_VAULT_PUBKEY);

    const sellerDiff = sellerAfter - sellerBefore;
    const feeVaultDiff = feeVaultAfter - feeVaultBefore;

    assert.equal(sellerDiff, 950_000, "Seller should receive 95%");
    assert.equal(feeVaultDiff, 50_000, "FeeVault should receive 5%");
  });

  it("amount=0 を拒否すること", async () => {
    try {
      await program.methods
        .executePurchase(new BN(0))
        .accounts({
          buyer: buyer.publicKey,
          seller: seller.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      assert.include(message, "ZeroAmount");
    }
  });

  // USDC テストは mint 作成が必要なため省略 (devnet での手動確認を推奨)
});
