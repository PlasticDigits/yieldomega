-- Revert TimeCurve unredeemed launched-token sweep tables (GitLab #128); paired down for GitLab #152.

DROP INDEX IF EXISTS idx_timecurve_unredeemed_launched_token_swept_block;
DROP TABLE IF EXISTS idx_timecurve_unredeemed_launched_token_swept;

DROP INDEX IF EXISTS idx_timecurve_unredeemed_launched_token_recipient_set_block;
DROP TABLE IF EXISTS idx_timecurve_unredeemed_launched_token_recipient_set;
