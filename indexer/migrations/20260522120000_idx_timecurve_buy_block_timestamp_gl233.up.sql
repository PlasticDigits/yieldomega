-- GitLab #233 — platform-usage velocity filters on block_timestamp (1h / 24h / sale windows).
CREATE INDEX IF NOT EXISTS idx_timecurve_buy_block_timestamp
    ON idx_timecurve_buy (block_timestamp)
    WHERE block_timestamp IS NOT NULL;
