-- Admin usage dashboards aggregate usage_logs by time across all users; the
-- existing (user_id, created_at) index can't serve a range scan without user_id.
CREATE INDEX IF NOT EXISTS "usage_logs_created_idx" ON "usage_logs" USING btree ("created_at");
