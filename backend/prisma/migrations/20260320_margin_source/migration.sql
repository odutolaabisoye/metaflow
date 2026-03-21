-- marginSource: distinguish real synced margin from the 0.35 placeholder default.
-- "synced"  = at least one DailyMetric row with real margin data has been aggregated.
-- "default" = no real margin data yet; the 0.35 value is a placeholder.
ALTER TABLE "ProductMeta" ADD COLUMN "marginSource" TEXT NOT NULL DEFAULT 'default';
