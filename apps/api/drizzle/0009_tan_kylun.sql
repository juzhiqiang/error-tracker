CREATE INDEX "events_issue_id_idx" ON "events" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "events_project_timestamp_idx" ON "events" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE INDEX "performance_metrics_project_name_timestamp_idx" ON "performance_metrics" USING btree ("project_id","name","timestamp");