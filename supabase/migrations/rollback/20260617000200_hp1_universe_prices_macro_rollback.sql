-- Rollback for 20260617000200_hp1_universe_prices_macro.sql
-- Drops hp1.universe / hp1.prices / hp1.macro_gauges (and their policies).
-- CASCADE handles prices' FK to universe. DESTRUCTIVE: removes all loaded price
-- + macro history and the universe seed.

BEGIN;
DROP TABLE IF EXISTS hp1.prices       CASCADE;
DROP TABLE IF EXISTS hp1.macro_gauges CASCADE;
DROP TABLE IF EXISTS hp1.universe     CASCADE;
COMMIT;
