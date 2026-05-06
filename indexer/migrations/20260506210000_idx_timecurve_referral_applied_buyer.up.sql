-- ReferralApplied buyer-side lookups (wallet-charm-summary referee aggregates).
-- Stored addresses are lowercase hex from addr_hex(...); API binds lowercase params.
CREATE INDEX IF NOT EXISTS idx_timecurve_referral_applied_buyer
    ON idx_timecurve_referral_applied (buyer);
