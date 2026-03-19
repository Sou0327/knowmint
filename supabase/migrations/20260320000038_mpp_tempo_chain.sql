-- Phase MPP-1: Add Tempo chain support for Machine Payments Protocol (Step 1/2)
-- Tempo is an EVM-compatible L1 blockchain for payments (by Stripe + Paradigm)
-- NOTE: ADD VALUE must be in its own transaction; CHECK constraint is in the next migration.

ALTER TYPE chain_type ADD VALUE IF NOT EXISTS 'tempo';
