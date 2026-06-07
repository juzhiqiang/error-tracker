CREATE TABLE "issue_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_hash" text NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "issue_users_issue_user_unique" UNIQUE("issue_id","user_hash")
);
--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "user_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "issue_users" ADD CONSTRAINT "issue_users_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_users_issue_id_idx" ON "issue_users" USING btree ("issue_id");--> statement-breakpoint
WITH event_user_keys AS (
	SELECT issue_id, user_key, MIN(timestamp) AS first_seen
	FROM (
		SELECT
			e."issue_id" AS issue_id,
			e."timestamp" AS timestamp,
			CASE
				WHEN NULLIF(btrim(e."user"->>'id'), '') IS NOT NULL THEN 'id:' || btrim(e."user"->>'id')
				WHEN NULLIF(btrim(e."user"->>'userId'), '') IS NOT NULL THEN 'id:' || btrim(e."user"->>'userId')
				WHEN NULLIF(btrim(e."user"->>'email'), '') IS NOT NULL THEN 'email:' || lower(btrim(e."user"->>'email'))
				WHEN NULLIF(btrim(e."user"->>'username'), '') IS NOT NULL THEN 'username:' || lower(btrim(e."user"->>'username'))
				WHEN NULLIF(btrim(e."user"->>'anonymousId'), '') IS NOT NULL THEN 'anonymousId:' || btrim(e."user"->>'anonymousId')
				ELSE NULL
			END AS user_key
		FROM "events" e
		WHERE e."issue_id" IS NOT NULL AND e."user" IS NOT NULL
	) keyed
	WHERE user_key IS NOT NULL
	GROUP BY issue_id, user_key
)
INSERT INTO "issue_users" ("issue_id", "user_hash", "first_seen")
SELECT issue_id, md5(issue_id::text || ':' || user_key), first_seen
FROM event_user_keys
ON CONFLICT ("issue_id", "user_hash") DO NOTHING;--> statement-breakpoint
UPDATE "issues" i
SET "user_count" = (
	SELECT COUNT(*)::int
	FROM "issue_users" iu
	WHERE iu."issue_id" = i."id"
);
