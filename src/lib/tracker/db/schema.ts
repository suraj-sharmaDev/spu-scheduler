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
import type { AttendanceStatus, TaskStatus } from "../status";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

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

/**
 * Guided study sessions. At most one may be active (ended_at is null) at a
 * time, enforced by a partial unique index so two devices can't both start one.
 * Timer: elapsed = banked_ms + (now - running_since) while running.
 */
export const studySessions = pgTable(
	"study_sessions",
	{
		id: serial("id").primaryKey(),
		projectSlug: text("project_slug").notNull(),
		taskId: text("task_id").notNull(),
		startedAt: timestamptz("started_at").notNull().defaultNow(),
		/** Null while paused. */
		runningSince: timestamptz("running_since").defaultNow(),
		bankedMs: integer("banked_ms").notNull().default(0),
		step: integer("step").notNull().default(0),
		endedAt: timestamptz("ended_at"),
		/** Minutes logged and the outcome chosen at wrap-up. */
		minutes: integer("minutes"),
		outcome: text("outcome").$type<TaskStatus>(),
	},
	(t) => [
		uniqueIndex("study_sessions_one_active")
			.on(sql`(${t.endedAt} is null)`)
			.where(sql`${t.endedAt} is null`),
		check("study_sessions_banked_ms", sql`${t.bankedMs} >= 0`),
		check("study_sessions_step", sql`${t.step} >= 0`),
	],
);
