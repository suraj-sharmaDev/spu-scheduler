import { sql } from "drizzle-orm";
import {
	check,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

export const TASK_STATUSES = [
	"not_started",
	"in_progress",
	"stuck",
	"done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["present", "late", "makeup"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const taskProgress = pgTable(
	"task_progress",
	{
		projectSlug: text("project_slug").notNull(),
		taskId: text("task_id").notNull(),
		status: text("status").$type<TaskStatus>().notNull().default("not_started"),
		minutes: integer("minutes"),
		notes: text("notes").notNull().default(""),
		updatedAt: updatedAt(),
	},
	(t) => [
		primaryKey({ columns: [t.projectSlug, t.taskId] }),
		check(
			"task_progress_status",
			sql`${t.status} in ('not_started', 'in_progress', 'stuck', 'done')`,
		),
		check(
			"task_progress_minutes",
			sql`${t.minutes} is null or ${t.minutes} between 0 and 1440`,
		),
	],
);

/** A row means the checklist item is ticked. */
export const checklistChecks = pgTable(
	"checklist_checks",
	{
		projectSlug: text("project_slug").notNull(),
		itemId: text("item_id").notNull(),
		checkedAt: timestamp("checked_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [primaryKey({ columns: [t.projectSlug, t.itemId] })],
);

/**
 * One row per attended session. Missed slots are not stored; they are the
 * scheduled slots with no row (see schedule.ts).
 */
export const attendance = pgTable(
	"attendance",
	{
		id: serial("id").primaryKey(),
		kind: text("kind").$type<"scheduled" | "makeup">().notNull(),
		/** Start of the scheduled slot; null for make-ups. */
		slotStart: timestamp("slot_start", { withTimezone: true }),
		/** Pacific calendar date of the session, "YYYY-MM-DD". */
		localDate: text("local_date").notNull(),
		checkedInAt: timestamp("checked_in_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		status: text("status").$type<AttendanceStatus>().notNull(),
		note: text("note"),
	},
	(t) => [
		// Unique slot per check-in; NULLs (make-ups) don't collide.
		uniqueIndex("attendance_slot_start").on(t.slotStart),
		// At most one make-up per day, enforced even under double-submits.
		uniqueIndex("attendance_makeup_day")
			.on(t.localDate)
			.where(sql`${t.kind} = 'makeup'`),
		check("attendance_kind", sql`${t.kind} in ('scheduled', 'makeup')`),
		check(
			"attendance_status",
			sql`${t.status} in ('present', 'late', 'makeup')`,
		),
		check(
			"attendance_slot_matches_kind",
			sql`(${t.kind} = 'scheduled') = (${t.slotStart} is not null)`,
		),
	],
);

export const weeklyReflections = pgTable(
	"weekly_reflections",
	{
		projectSlug: text("project_slug").notNull(),
		week: integer("week").notNull(),
		/** Answers keyed by question text. */
		answers: jsonb("answers").$type<Record<string, string>>().notNull(),
		confidence: integer("confidence"),
		updatedAt: updatedAt(),
	},
	(t) => [
		primaryKey({ columns: [t.projectSlug, t.week] }),
		check(
			"weekly_reflections_confidence",
			sql`${t.confidence} is null or ${t.confidence} between 1 and 5`,
		),
	],
);

export const projectReviews = pgTable(
	"project_reviews",
	{
		projectSlug: text("project_slug").notNull(),
		subject: text("subject").notNull(),
		answers: jsonb("answers").$type<Record<string, string>>().notNull(),
		updatedAt: updatedAt(),
	},
	(t) => [primaryKey({ columns: [t.projectSlug, t.subject] })],
);
