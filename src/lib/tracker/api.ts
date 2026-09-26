import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
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
	studySessions,
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
	/** The one unfinished guided session, from any project. */
	activeSession: ActiveSession | null;
	/** Server clock at read time, so the client can correct its timer for skew. */
	serverNow: string;
}

export interface ActiveSession {
	id: number;
	projectSlug: string;
	taskId: string;
	startedAt: string;
	/** Null while paused. */
	runningSince: string | null;
	bankedMs: number;
	step: number;
}

function toActiveSession(r: typeof studySessions.$inferSelect): ActiveSession {
	return {
		id: r.id,
		projectSlug: r.projectSlug,
		taskId: r.taskId,
		startedAt: r.startedAt.toISOString(),
		runningSince: r.runningSince?.toISOString() ?? null,
		bankedMs: r.bankedMs,
		step: r.step,
	};
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
	.validator((input: unknown) => ({
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
	.validator((input: unknown) => ({
		project: projectFrom(v.object(input).project).slug,
	}))
	.handler(async ({ data }): Promise<TrackerState> => {
		const role = requireRole("learner", "admin");
		const db = getDb();
		const slug = data.project;
		const [progress, checks, rows, reflections, reviews, active] =
			await Promise.all([
				db
					.select()
					.from(taskProgress)
					.where(eq(taskProgress.projectSlug, slug)),
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
				db
					.select()
					.from(studySessions)
					.where(isNull(studySessions.endedAt))
					.limit(1),
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
			activeSession: active[0] ? toActiveSession(active[0]) : null,
			serverNow: new Date().toISOString(),
		};
	});

// --- task progress ------------------------------------------------------------------

export const updateTask = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
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
	.validator((input: unknown) => {
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
	.validator((input: unknown) => {
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
	.validator((input: unknown) => {
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
	.validator((input: unknown) => {
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

// --- guided study sessions --------------------------------------------------------

function taskFrom(project: Project, value: unknown): string {
	const taskId = v.string(value, "Task", 50);
	if (!project.tasks.some((t) => t.id === taskId)) {
		throw new Error(`Unknown task "${taskId}"`);
	}
	return taskId;
}

const sessionId = (value: unknown) =>
	v.integer(value, "Session", 1, 2_147_483_647);

export type StartSessionResult =
	| { started: true; session: ActiveSession }
	/** Another task's session is still open; it must be continued first. */
	| { started: false; session: ActiveSession };

/**
 * Start a session for a task, or return the open one. Only one session may be
 * open at a time (partial unique index), so a second device can't start another.
 */
export const startStudySession = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		return { project: project.slug, taskId: taskFrom(project, o.taskId) };
	})
	.handler(async ({ data }): Promise<StartSessionResult> => {
		requireRole("learner");
		const db = getDb();
		const [inserted] = await db
			.insert(studySessions)
			.values({ projectSlug: data.project, taskId: data.taskId })
			.onConflictDoNothing()
			.returning();
		const row =
			inserted ??
			(
				await db
					.select()
					.from(studySessions)
					.where(isNull(studySessions.endedAt))
					.limit(1)
			)[0];
		if (!row) throw new Error("Couldn't start the session. Please try again.");

		const sameTask =
			row.projectSlug === data.project && row.taskId === data.taskId;
		if (inserted) {
			// Starting a session means the task is under way (unless already further along).
			await db
				.insert(taskProgress)
				.values({
					projectSlug: data.project,
					taskId: data.taskId,
					status: "in_progress",
				})
				.onConflictDoUpdate({
					target: [taskProgress.projectSlug, taskProgress.taskId],
					set: { status: "in_progress", updatedAt: new Date() },
					setWhere: sql`${taskProgress.status} = 'not_started'`,
				});
		}
		return { started: sameTask, session: toActiveSession(row) };
	});

/** Pause, resume or move to a step. Uses the database clock for the timer. */
export const updateStudySession = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const o = v.object(input);
		const action = v.oneOf(o.action, "Action", [
			"pause",
			"resume",
			"step",
		] as const);
		return {
			id: sessionId(o.id),
			action,
			step: action === "step" ? v.integer(o.step, "Step", 0, 50) : 0,
		};
	})
	.handler(async ({ data }): Promise<ActiveSession> => {
		requireRole("learner");
		const db = getDb();
		const s = studySessions;
		const open = and(eq(s.id, data.id), isNull(s.endedAt));
		if (data.action === "pause") {
			await db
				.update(s)
				.set({
					bankedMs: sql`${s.bankedMs} + greatest(0, floor(extract(epoch from (now() - ${s.runningSince})) * 1000))::int`,
					runningSince: null,
				})
				.where(and(open, isNotNull(s.runningSince)));
		} else if (data.action === "resume") {
			await db
				.update(s)
				.set({ runningSince: sql`now()` })
				.where(and(open, isNull(s.runningSince)));
		} else {
			await db.update(s).set({ step: data.step }).where(open);
		}
		const [row] = await db.select().from(s).where(open);
		if (!row) throw new Error("This session has already ended.");
		return toActiveSession(row);
	});

/**
 * Wrap up: close the session and log its outcome and minutes on the task, in
 * one statement so a double submit (or a second device) can't add minutes twice.
 */
export const finishStudySession = createServerFn({ method: "POST" })
	.validator((input: unknown) => {
		const o = v.object(input);
		const project = projectFrom(o.project);
		return {
			id: sessionId(o.id),
			project: project.slug,
			taskId: taskFrom(project, o.taskId),
			outcome: v.oneOf(o.outcome, "Outcome", TASK_STATUSES),
			minutes: v.integer(o.minutes, "Minutes", 0, 1440),
		};
	})
	.handler(async ({ data }) => {
		requireRole("learner");
		const result = await getDb().execute(sql`
			with ended as (
				update study_sessions
				set ended_at = now(),
					minutes = ${data.minutes},
					outcome = ${data.outcome},
					banked_ms = banked_ms + case when running_since is null then 0
						else greatest(0, floor(extract(epoch from (now() - running_since)) * 1000))::int end,
					running_since = null
				where id = ${data.id} and ended_at is null
					and project_slug = ${data.project} and task_id = ${data.taskId}
				returning task_id
			)
			insert into task_progress (project_slug, task_id, status, minutes, updated_at)
			select ${data.project}, task_id, ${data.outcome}, ${data.minutes}, now() from ended
			on conflict (project_slug, task_id) do update set
				status = excluded.status,
				minutes = least(1440, coalesce(task_progress.minutes, 0) + excluded.minutes),
				updated_at = now()
			returning task_id
		`);
		if (result.rows.length === 0) {
			throw new Error("This session was already finished or discarded.");
		}
	});

/** Throw away the open session (started by mistake). Ticks and notes are kept. */
export const discardStudySession = createServerFn({ method: "POST" })
	.validator((input: unknown) => ({ id: sessionId(v.object(input).id) }))
	.handler(async ({ data }) => {
		requireRole("learner");
		const deleted = await getDb()
			.delete(studySessions)
			.where(and(eq(studySessions.id, data.id), isNull(studySessions.endedAt)))
			.returning({ id: studySessions.id });
		if (deleted.length === 0) {
			throw new Error("This session was already finished or discarded.");
		}
	});
