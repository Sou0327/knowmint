use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as SplTransfer};

// TODO(deploy): `anchor deploy` 後に実際のプログラム ID で更新すること
declare_id!("B4Jh6N5ftNZimEu3aWR7JiYu4yhPWN5mpds68E6gWRMb");

/// Fee Vault の公開鍵 (scripts/generate-fee-vault.mjs で生成)
/// devnet: GdK2gyBLaoB9PxTLfUesaUn1qsNaKjaux9PzfHKt4ihc
const FEE_VAULT_PUBKEY: Pubkey = Pubkey::new_from_array([
    232, 44, 153, 62, 229, 51, 95, 195, 187, 7, 242, 198, 227, 179, 144, 22, 69, 42, 25, 238, 22, 196, 15, 99, 204, 19, 22, 177, 113, 201, 113, 223,
]);

/// プレースホルダー検出用の定数（FEE_VAULT_PUBKEY と同一値）
const FEE_VAULT_PLACEHOLDER: Pubkey = Pubkey::new_from_array([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 1,
]);

/// Protocol fee in basis points (5%)
const PROTOCOL_FEE_BPS: u64 = 500;
const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod knowledge_market {
    use super::*;

    /// Execute a SOL purchase with automatic 95/5 split between seller and protocol fee vault.
    pub fn execute_purchase(ctx: Context<ExecutePurchase>, amount: u64) -> Result<()> {
        // デプロイ前チェック: FEE_VAULT_PUBKEY がプレースホルダーのままでないことを確認
        require!(
            ctx.accounts.fee_vault.key() != FEE_VAULT_PLACEHOLDER,
            MarketError::InvalidFeeVault
        );
        require!(amount > 0, MarketError::ZeroAmount);

        let seller_share = amount
            .checked_mul(BPS_DENOMINATOR - PROTOCOL_FEE_BPS)
            .ok_or(MarketError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(MarketError::Overflow)?;
        // fee_share = amount - seller_share で二重 floor を防ぎ合計が amount と一致することを保証
        let fee_share = amount.checked_sub(seller_share).ok_or(MarketError::Overflow)?;

        // Transfer seller_share to seller
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.seller.to_account_info(),
                },
            ),
            seller_share,
        )?;

        // Transfer fee_share to fee_vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
            ),
            fee_share,
        )?;

        Ok(())
    }

    /// Execute an SPL token purchase with automatic 95/5 split between seller and protocol fee vault.
    pub fn execute_purchase_spl(ctx: Context<ExecutePurchaseSpl>, amount: u64) -> Result<()> {
        // SOL 側と同じプレースホルダー検出を使用 (Pubkey::default() では不十分)
        require!(
            ctx.accounts.fee_vault.key() != FEE_VAULT_PLACEHOLDER,
            MarketError::InvalidFeeVault
        );
        require!(amount > 0, MarketError::ZeroAmount);

        let seller_share = amount
            .checked_mul(BPS_DENOMINATOR - PROTOCOL_FEE_BPS)
            .ok_or(MarketError::Overflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(MarketError::Overflow)?;
        // fee_share = amount - seller_share で二重 floor を防ぎ合計が amount と一致することを保証
        let fee_share = amount.checked_sub(seller_share).ok_or(MarketError::Overflow)?;

        // Transfer seller_share to seller_ata
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.seller_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_share,
        )?;

        // Transfer fee_share to fee_vault_ata
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.buyer_ata.to_account_info(),
                    to: ctx.accounts.fee_vault_ata.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            fee_share,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecutePurchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Seller receives SOL, no further validation needed.
    #[account(mut)]
    pub seller: SystemAccount<'info>,

    /// CHECK: Fee vault must match the hardcoded protocol fee vault address.
    #[account(mut, address = FEE_VAULT_PUBKEY @ MarketError::InvalidFeeVault)]
    pub fee_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecutePurchaseSpl<'info> {
    pub buyer: Signer<'info>,

    #[account(mut, constraint = buyer_ata.owner == buyer.key())]
    pub buyer_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_ata: Account<'info, TokenAccount>,

    /// CHECK: Fee vault must match the hardcoded protocol fee vault address.
    #[account(address = FEE_VAULT_PUBKEY @ MarketError::InvalidFeeVault)]
    pub fee_vault: SystemAccount<'info>,

    #[account(mut, constraint = fee_vault_ata.owner == fee_vault.key() @ MarketError::InvalidFeeVault)]
    pub fee_vault_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum MarketError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Fee vault address does not match the protocol fee vault")]
    InvalidFeeVault,
}
