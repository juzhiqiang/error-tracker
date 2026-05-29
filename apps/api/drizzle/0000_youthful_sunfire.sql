CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"issue_id" uuid,
	"project_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"stacktrace" jsonb,
	"breadcrumbs" jsonb,
	"request" jsonb,
	"user" jsonb,
	"tags" jsonb,
	"environment" text,
	"release" text
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"level" text DEFAULT 'error' NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"user_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "issues_project_fingerprint_unique" UNIQUE("project_id","fingerprint")
);
--> statement-breakpoint
CREATE TABLE "performance_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" integer NOT NULL,
	"rating" text NOT NULL,
	"url" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"dsn_token" text NOT NULL,
	"webhook_url" text,
	"alert_threshold" integer DEFAULT 50,
	"retention_days" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_dsn_token_unique" UNIQUE("dsn_token")
);
--> statement-breakpoint
CREATE TABLE "replays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text,
	"storage_url" text NOT NULL,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"release" text NOT NULL,
	"filename" text NOT NULL,
	"storage_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replays" ADD CONSTRAINT "replays_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_maps" ADD CONSTRAINT "source_maps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;