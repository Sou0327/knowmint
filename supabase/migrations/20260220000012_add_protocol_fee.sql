-- Phase 6: スマートコントラクト決済 — protocol_fee カラム追加
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS protocol_fee DECIMAL(18, 9) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_vault_address TEXT;
