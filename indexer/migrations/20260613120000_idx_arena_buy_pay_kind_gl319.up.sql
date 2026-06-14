-- GitLab #319 — Kumbaya-routed buys annotate pay asset on idx_arena_buy.
ALTER TABLE idx_arena_buy
    ADD COLUMN IF NOT EXISTS pay_kind SMALLINT;
