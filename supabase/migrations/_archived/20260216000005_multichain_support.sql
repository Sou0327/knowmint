-- EVM tx_hash format validation
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_tx_hash_format;

ALTER TABLE transactions
  ADD CONSTRAINT chk_tx_hash_format
  CHECK (
    (chain = 'solana' AND tx_hash ~ '^[A-Za-z0-9]{87,88}$')
    OR (chain IN ('base', 'ethereum') AND tx_hash ~ '^0x[a-fA-F0-9]{64}$')
    OR tx_hash IS NULL
  );
