/**
 * Progress aggregates over project content + saved progress. Mirrors the
 * workbook's Progress sheet (sessions / done / stuck / % / minutes per week)
 * and adds concept and confidence views. Pure functions, no I/O.
 */

import type { AttendanceLike } from "./schedule";
import type { TaskStatus } from "./status";
import type { ChecklistItem, Milestone, Project, Task } from "./types";

export interface ProgressInput {
	progress: Record<string, { status: TaskStatus; minutes: number | null }>;
	checkedItems: string[];
}

export function statusOf(input: ProgressInput, taskId: string): TaskStatus {
	return input.progress[taskId]?.status ?? "not_started";
}

/** Ticked vs total required items (stretch items don't count toward the total). */
export function checklistProgress(
	task: Task,
	checked: ReadonlySet<string>,
): { done: number; total: number } {
	const required = [...task.steps, ...task.doneWhen].filter(
		(i: ChecklistItem) => !i.stretch,
	);
	return {
		done: required.filter((i) => checked.has(i.id)).length,
		total: required.length,
	};
}

/** First task, in plan order, that isn't done. Null when everything is done. */
export function nextTask(project: Project, input: ProgressInput): Task | null {
	return project.tasks.find((t) => statusOf(input, t.id) !== "done") ?? null;
}

export interface MilestoneRow {
	milestone: Milestone;
	sessions: number;
	done: number;
	stuck: number;
	/** 0–1 */
	pct: number;
	minutes: number;
}

export function milestoneRows(
	project: Project,
	input: ProgressInput,
): MilestoneRow[] {
	return project.milestones.map((milestone) => {
		const tasks = project.tasks.filter((t) => t.milestoneId === milestone.id);
		const done = tasks.filter((t) => statusOf(input, t.id) === "done").length;
		return {
			milestone,
			sessions: tasks.length,
			done,
			stuck: tasks.filter((t) => statusOf(input, t.id) === "stuck").length,
			pct: tasks.length === 0 ? 0 : done / tasks.length,
			minutes: tasks.reduce(
				(sum, t) => sum + (input.progress[t.id]?.minutes ?? 0),
				0,
			),
		};
	});
}

export interface Totals {
	tasks: number;
	done: number;
	stuck: number;
	pct: number;
	minutes: number;
	conceptsLearned: number;
	concepts: number;
}

export function totals(project: Project, input: ProgressInput): Totals {
	const rows = milestoneRows(project, input);
	const tasks = rows.reduce((s, r) => s + r.sessions, 0);
	const done = rows.reduce((s, r) => s + r.done, 0);
	return {
		tasks,
		done,
		stuck: rows.reduce((s, r) => s + r.stuck, 0),
		pct: tasks === 0 ? 0 : done / tasks,
		minutes: rows.reduce((s, r) => s + r.minutes, 0),
		conceptsLearned: learnedConcepts(project, input).size,
		concepts: project.concepts.length,
	};
}

/** A concept is learned once the first task that uses it is done. */
export function learnedConcepts(
	project: Project,
	input: ProgressInput,
): Set<string> {
	const firstUse = new Map<string, string>();
	for (const t of project.tasks) {
		for (const ref of t.concepts) {
			if (!firstUse.has(ref.conceptId)) firstUse.set(ref.conceptId, t.id);
		}
	}
	const learned = new Set<string>();
	for (const [conceptId, taskId] of firstUse) {
		if (statusOf(input, taskId) === "done") learned.add(conceptId);
	}
	return learned;
}

/** Sub-project names in plan order with the milestones that belong to them. */
export function subprojects(
	project: Project,
): { name: string; milestones: Milestone[] }[] {
	const out: { name: string; milestones: Milestone[] }[] = [];
	for (const m of project.milestones) {
		const last = out[out.length - 1];
		if (last?.name === m.subproject) last.milestones.push(m);
		else out.push({ name: m.subproject, milestones: [m] });
	}
	return out;
}

/** True when every task in the sub-project's milestones is done. */
export function subprojectDone(
	project: Project,
	input: ProgressInput,
	name: string,
): boolean {
	const ids = new Set(
		project.milestones.filter((m) => m.subproject === name).map((m) => m.id),
	);
	const tasks = project.tasks.filter((t) => ids.has(t.milestoneId));
	return (
		tasks.length > 0 && tasks.every((t) => statusOf(input, t.id) === "done")
	);
}

/** Parse ISO attendance rows from the server into schedule inputs. */
export function toAttendanceLike(
	rows: {
		kind: "scheduled" | "makeup";
		slotStart: string | null;
		checkedInAt: string;
	}[],
): AttendanceLike[] {
	return rows.map((r) => ({
		kind: r.kind,
		slotStart: r.slotStart ? new Date(r.slotStart) : null,
		checkedInAt: new Date(r.checkedInAt),
	}));
}
