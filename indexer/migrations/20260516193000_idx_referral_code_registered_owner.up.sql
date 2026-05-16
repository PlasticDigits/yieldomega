-- Speed up wallet-scoped registration lookups (referrals code recovery API).
CREATE INDEX IF NOT EXISTS idx_referral_code_registered_owner_address
    ON idx_referral_code_registered (owner_address);
