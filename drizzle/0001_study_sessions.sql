CREATE TABLE "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_slug" text NOT NULL,
	"task_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"running_since" timestamp with time zone DEFAULT now(),
	"banked_ms" integer DEFAULT 0 NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp with time zone,
	"minutes" integer,
	"outcome" text,
	CONSTRAINT "study_sessions_banked_ms" CHECK ("study_sessions"."banked_ms" >= 0),
	CONSTRAINT "study_sessions_step" CHECK ("study_sessions"."step" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "study_sessions_one_active" ON "study_sessions" USING btree (("ended_at" is null)) WHERE "study_sessions"."ended_at" is null;