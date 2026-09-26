CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"slot_start" timestamp with time zone,
	"local_date" text NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"note" text,
	CONSTRAINT "attendance_kind" CHECK ("attendance"."kind" in ('scheduled', 'makeup')),
	CONSTRAINT "attendance_status" CHECK ("attendance"."status" in ('present', 'late', 'makeup')),
	CONSTRAINT "attendance_slot_matches_kind" CHECK (("attendance"."kind" = 'scheduled') = ("attendance"."slot_start" is not null))
);
--> statement-breakpoint
CREATE TABLE "checklist_checks" (
	"project_slug" text NOT NULL,
	"item_id" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_checks_project_slug_item_id_pk" PRIMARY KEY("project_slug","item_id")
);
--> statement-breakpoint
CREATE TABLE "project_reviews" (
	"project_slug" text NOT NULL,
	"subject" text NOT NULL,
	"answers" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_reviews_project_slug_subject_pk" PRIMARY KEY("project_slug","subject")
);
--> statement-breakpoint
CREATE TABLE "task_progress" (
	"project_slug" text NOT NULL,
	"task_id" text NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"minutes" integer,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_progress_project_slug_task_id_pk" PRIMARY KEY("project_slug","task_id"),
	CONSTRAINT "task_progress_status" CHECK ("task_progress"."status" in ('not_started', 'in_progress', 'stuck', 'done')),
	CONSTRAINT "task_progress_minutes" CHECK ("task_progress"."minutes" is null or "task_progress"."minutes" between 0 and 1440)
);
--> statement-breakpoint
CREATE TABLE "weekly_reflections" (
	"project_slug" text NOT NULL,
	"week" integer NOT NULL,
	"answers" jsonb NOT NULL,
	"confidence" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reflections_project_slug_week_pk" PRIMARY KEY("project_slug","week"),
	CONSTRAINT "weekly_reflections_confidence" CHECK ("weekly_reflections"."confidence" is null or "weekly_reflections"."confidence" between 1 and 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_slot_start" ON "attendance" USING btree ("slot_start");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_makeup_day" ON "attendance" USING btree ("local_date") WHERE "attendance"."kind" = 'makeup';