-- Phase MPP-1: Extend tx_hash CHECK constraint for Tempo (Step 2/2)
-- Must be in a separate migration from ADD VALUE to avoid "unsafe use of new value" error.

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_tx_hash_format;
ALTER TABLE transactions ADD CONSTRAINT chk_tx_hash_format CHECK (
  (chain = 'solana' AND tx_hash ~ '^[A-Za-z0-9]{87,88}$')
  OR (chain IN ('base', 'ethereum', 'tempo') AND tx_hash ~ '^0x[a-fA-F0-9]{64}$')
);
