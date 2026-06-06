ALTER TABLE "source_maps" ADD COLUMN "checksum" text;--> statement-breakpoint
ALTER TABLE "source_maps" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "source_maps" ADD CONSTRAINT "source_maps_project_release_filename_unique" UNIQUE("project_id","release","filename");