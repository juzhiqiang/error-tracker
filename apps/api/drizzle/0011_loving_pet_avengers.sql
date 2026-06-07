CREATE TABLE "issue_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assignee_user_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assigned_at" timestamp;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assigned_by_user_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "fixed_in_release" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "regressed_at" timestamp;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "regressed_in_release" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "merged_into_issue_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "split_from_issue_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "alert_user_threshold" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_comments_issue_created_idx" ON "issue_comments" USING btree ("issue_id","created_at");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;