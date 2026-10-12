CREATE TABLE "recall_reviews" (
	"project_slug" text NOT NULL,
	"card_id" text NOT NULL,
	"box" integer NOT NULL,
	"reviewed_at" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recall_reviews_project_slug_card_id_pk" PRIMARY KEY("project_slug","card_id"),
	CONSTRAINT "recall_reviews_box" CHECK ("recall_reviews"."box" between 0 and 4),
	CONSTRAINT "recall_reviews_reviewed_at" CHECK ("recall_reviews"."reviewed_at" >= 0)
);
--> statement-breakpoint
ALTER TABLE "study_sessions" ADD COLUMN "takeaway" text;