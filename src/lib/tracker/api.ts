import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import {
	endSession,
	type Role,
	readSession,
	requireRole,
	roleForPasscode,
	startSession,
} from "./auth.server";
import { getDb } from "./db/client.server";
import {
	attendance,
	checklistChecks,
	projectReviews,
	taskProgress,
	weeklyReflections,
} from "./db/schema";
import * as v from "./input";
import { getProject } from "./projects";
import { classifyCheckIn, localDate, openSlot } from "./schedule";
import { TASK_STATUSES, type TaskStatus } from "./status";
import type { Project } from "./types";

const MAX_NOTES = 20_000;
const MAX_ANSWER = 5_000;

// --- shapes sent to the client (dates as ISO strings) ------------------------

export interface TaskProgressRow {
	status: TaskStatus;
	minutes: number | null;
	notes: string;
	updatedAt: string;
}

export interface AttendanceRow {
	id: number;
	kind: "scheduled" | "makeup";
	slotStart: string | null;
	localDate: string;
	checkedInAt: string;
	status: "present" | "late" | "makeup";
	note: string | null;
}

export interface TrackerState {
	role: Role;
	progress: Record<string, TaskProgressRow>;
	checkedItems: string[];
	attendance: AttendanceRow[];
	reflections: Record<
		number,
		{
			answers: Record<string, string>;
			confidence: number | null;
			updatedAt: string;
		}
	>;
	reviews: Record<
		string,
		{ answers: Record<string, string>; updatedAt: string }
	>;
}

function projectFrom(value: unknown): Project {
	const slug = v.string(value, "project", 100);
	const project = getProject(slug);
	if (!project) throw new Error(`Unknown project "${slug}"`);
	return project;
}

function toAttendanceRow(r: typeof attendance.$inferSelect): AttendanceRow {
	return {
		id: r.id,
		kind: r.kind,
		slotStart: r.slotStart?.toISOString() ?? null,
		localDate: r.localDate,
		checkedInAt: r.checkedInAt.toISOString(),
		status: r.status,
		note: r.note,
	};
}

// --- session ------------------------------------------------------------------

export const getSession = createServerFn({ method: "GET" }).handler(async () =>
	readSession(),
);

export const login = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => ({
		passcode: v.string(v.object(input).passcode, "Passcode", 200),
	}))
	.handler(async ({ data }) => {
		const role = roleForPasscode(data.passcode);
		if (!role) {
			// Slow down guessing.
			await new Promise((resolve) => setTimeout(resolve, 800));
			throw new Error("That passcode isn't right.");
		}
		startSession(role);
		return { role };
	});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
	endSession();
});

// --- reads ----------------------------------------------------------------------

export const getTrackerState = createServerFn({ method: "GET" })
	.inputValidator((input: unknown) => ({
		project: projectFrom(v.object(input).project).slug,
	}))
	.handler(async ({ data }): Promise<TrackerState> => {
		const role = requireRole("learner", "admin");
		const db = getDb();
		const slug = data.project;
		const [progress, checks, rows, reflections, reviews] = await Promise.all([
			db.select().from(taskProgress).where(eq(taskProgress.projectSlug, slug)),
			db
				.select()
				.from(checklistChecks)
				.where(eq(checklistChecks.projectSlug, slug)),
			db.select().from(attendance).orderBy(attendance.checkedInAt),
			db
				.select()
				.from(weeklyReflections)
				.where(eq(weeklyReflections.projectSlug, slug)),
			db
				.select()
				.from(projectReviews)
				.where(eq(projectReviews.projectSlug, slug)),
		]);
		return {
			role,
			progress: Object.fromEntries(
				progress.map((p) => [
					p.taskId,
					{
						status: p.status,
						minutes: p.minutes,
						notes: p.notes,
						updatedAt: p.updatedAt.toISOString(),
					},
				]),
			),
			checkedItems: checks.map((c) => c.itemId),
			attendance: rows.map(toAttendanceRow),
			reflections: Object.fromEntries(
				reflections.map((r) => [
					r.week,
					{
						answers: r.answers,
						confidence: r.confidence,
						updatedAt: r.updatedAt.toISOString(),
					},
				]),
			),
			reviews: Object.fromEntries(
				reviews.map((r) => [
					r.subject,
					{ answers: r.answers, updatedAt: r.updatedAt.toISOString() },
				]),
			),
		};
	});

// --- task progress ------------------------------------------------------------------

export const updateTask = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		const taskId = v.string(o.taskId, "Task", 50);
		if (!project.tasks.some((t) => t.id === taskId)) {
			throw new Error(`Unknown task "${taskId}"`);
		}
		return {
			project: project.slug,
			taskId,
			status:
				o.status === undefined
					? undefined
					: v.oneOf(o.status, "Status", TASK_STATUSES),
			// undefined = leave as is, null = clear.
			minutes:
				o.minutes === undefined
					? undefined
					: o.minutes === null
						? null
						: v.integer(o.minutes, "Minutes", 0, 1440),
			notes:
				o.notes === undefined
					? undefined
					: v.string(o.notes, "Notes", MAX_NOTES),
		};
	})
	.handler(async ({ data }) => {
		requireRole("learner");
		const patch = {
			...(data.status !== undefined && { status: data.status }),
			...(data.minutes !== undefined && { minutes: data.minutes }),
			...(data.notes !== undefined && { notes: data.notes }),
			updatedAt: new Date(),
		};
		await getDb()
			.insert(taskProgress)
			.values({ projectSlug: data.project, taskId: data.taskId, ...patch })
			.onConflictDoUpdate({
				target: [taskProgress.projectSlug, taskProgress.taskId],
				set: patch,
			});
	});

export const toggleChecklist = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		const itemId = v.string(o.itemId, "Item", 60);
		const known = project.tasks.some((t) =>
			[...t.steps, ...t.doneWhen].some((i) => i.id === itemId),
		);
		if (!known) throw new Error(`Unknown checklist item "${itemId}"`);
		return {
			project: project.slug,
			itemId,
			checked: v.boolean(o.checked, "Checked"),
		};
	})
	.handler(async ({ data }) => {
		requireRole("learner");
		const db = getDb();
		if (data.checked) {
			await db
				.insert(checklistChecks)
				.values({ projectSlug: data.project, itemId: data.itemId })
				.onConflictDoNothing();
		} else {
			await db
				.delete(checklistChecks)
				.where(
					and(
						eq(checklistChecks.projectSlug, data.project),
						eq(checklistChecks.itemId, data.itemId),
					),
				);
		}
	});

// --- attendance ------------------------------------------------------------------

/** Check in to the slot open right now. Uses the server clock; repeat calls are no-ops. */
export const checkIn = createServerFn({ method: "POST" }).handler(
	async (): Promise<AttendanceRow> => {
		requireRole("learner");
		const now = new Date();
		const slot = openSlot(now);
		if (!slot) throw new Error("No session is open right now.");
		const db = getDb();
		await db
			.insert(attendance)
			.values({
				kind: "scheduled",
				slotStart: slot.start,
				localDate: slot.date,
				checkedInAt: now,
				status: classifyCheckIn(now, slot),
			})
			.onConflictDoNothing();
		const [row] = await db
			.select()
			.from(attendance)
			.where(eq(attendance.slotStart, slot.start));
		return toAttendanceRow(row);
	},
);

/** Log an extra session outside the schedule (max one per day). */
export const logMakeup = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => {
		const note = v.object(input).note;
		return {
			note: note === undefined ? null : v.string(note, "Note", 500) || null,
		};
	})
	.handler(async ({ data }): Promise<AttendanceRow> => {
		requireRole("learner");
		const now = new Date();
		if (openSlot(now)) {
			throw new Error(
				"A scheduled session is open — check in to that instead.",
			);
		}
		const inserted = await getDb()
			.insert(attendance)
			.values({
				kind: "makeup",
				slotStart: null,
				localDate: localDate(now),
				checkedInAt: now,
				status: "makeup",
				note: data.note,
			})
			.onConflictDoNothing()
			.returning();
		if (inserted.length === 0) {
			throw new Error("You've already logged a make-up session today.");
		}
		return toAttendanceRow(inserted[0]);
	});

// --- reflections ------------------------------------------------------------------

export const saveWeeklyReflection = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		const week = v.integer(o.week, "Week", 1, project.milestones.length);
		return {
			project: project.slug,
			week,
			answers: v.answers(
				o.answers,
				project.reflection.weeklyQuestions,
				MAX_ANSWER,
			),
			confidence:
				o.confidence === null
					? null
					: v.integer(o.confidence, "Confidence", 1, 5),
		};
	})
	.handler(async ({ data }) => {
		requireRole("learner");
		const values = {
			answers: data.answers,
			confidence: data.confidence,
			updatedAt: new Date(),
		};
		await getDb()
			.insert(weeklyReflections)
			.values({ projectSlug: data.project, week: data.week, ...values })
			.onConflictDoUpdate({
				target: [weeklyReflections.projectSlug, weeklyReflections.week],
				set: values,
			});
	});

export const saveProjectReview = createServerFn({ method: "POST" })
	.inputValidator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		const subject = v.oneOf(
			o.subject,
			"Subject",
			project.reflection.reviewSubjects,
		);
		return {
			project: project.slug,
			subject,
			answers: v.answers(
				o.answers,
				project.reflection.reviewQuestions,
				MAX_ANSWER,
			),
		};
	})
	.handler(async ({ data }) => {
		requireRole("learner");
		const values = { answers: data.answers, updatedAt: new Date() };
		await getDb()
			.insert(projectReviews)
			.values({ projectSlug: data.project, subject: data.subject, ...values })
			.onConflictDoUpdate({
				target: [projectReviews.projectSlug, projectReviews.subject],
				set: values,
			});
	});
