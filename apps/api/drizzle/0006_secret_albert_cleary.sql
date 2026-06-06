CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_user_unique" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_projects_team_project_unique" UNIQUE("team_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
WITH legacy_projects AS (
	SELECT
		p.id AS project_id,
		p.name AS project_name,
		('legacy-project-' || p.id::text) AS organization_slug,
		COALESCE(
			(
				SELECT pm.user_id
				FROM project_members pm
				WHERE pm.project_id = p.id
					AND pm.role = 'owner'
				ORDER BY pm.created_at
				LIMIT 1
			),
			(
				SELECT pm.user_id
				FROM project_members pm
				WHERE pm.project_id = p.id
				ORDER BY pm.created_at
				LIMIT 1
			)
		) AS owner_user_id
	FROM projects p
	WHERE p.organization_id IS NULL
),
created_organizations AS (
	INSERT INTO organizations (name, slug)
	SELECT project_name || ' Organization', organization_slug
	FROM legacy_projects
	ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
	RETURNING id, slug
),
updated_projects AS (
	UPDATE projects p
	SET organization_id = o.id
	FROM legacy_projects lp
	JOIN created_organizations o ON o.slug = lp.organization_slug
	WHERE p.id = lp.project_id
	RETURNING p.id, o.id AS organization_id, lp.owner_user_id
)
INSERT INTO organization_members (organization_id, user_id, role)
SELECT organization_id, owner_user_id, 'owner'
FROM updated_projects
WHERE owner_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_projects" ADD CONSTRAINT "team_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_projects" ADD CONSTRAINT "team_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
