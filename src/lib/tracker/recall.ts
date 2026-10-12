/**
 * Spaced recall: short questions from earlier sessions, asked at the start of
 * each session. Spacing counts finished sessions, not days, so a missed week
 * doesn't pile up reviews. Pure functions; review state lives in the database.
 */
import type { Project } from "./types";

export interface RecallCard {
	id: string;
	/** The session the card comes from. */
	taskId: string;
	q: string;
	a: string;
}

export interface ReviewState {
	/** 0 = keep asking, up to MAX_BOX = known well. */
	box: number;
	/** Finished-session count when it was last answered. */
	reviewedAt: number;
}

/** Finished sessions to wait before asking again, by box. */
export const INTERVALS = [1, 2, 4, 8, 16] as const;
export const MAX_BOX = INTERVALS.length - 1;

/** How many cards a session asks: more on review days. */
export const CARDS_PER_SESSION = 3;
export const CARDS_PER_REVIEW = 6;

/**
 * Every card in plan order. Lessons bring their own questions; older tasks get
 * one card per concept they introduce.
 */
export function recallCards(project: Project): RecallCard[] {
	const concepts = new Map(project.concepts.map((c) => [c.id, c]));
	return project.tasks.flatMap((task): RecallCard[] => {
		if (task.lesson) {
			return task.lesson.recall.map((r, i) => ({
				id: `${task.id}.r${i}`,
				taskId: task.id,
				q: r.q,
				a: r.a,
			}));
		}
		return task.concepts.flatMap((ref) => {
			const concept = concepts.get(ref.conceptId);
			if (!ref.isNew || !concept) return [];
			return [
				{
					id: `c:${concept.id}`,
					taskId: task.id,
					q: `What does "${concept.name}" mean?`,
					a: `${concept.plain} For example: ${concept.example}`,
				},
			];
		});
	});
}

export function isDue(
	review: ReviewState | undefined,
	sessionsDone: number,
): boolean {
	if (!review) return true;
	return sessionsDone - review.reviewedAt >= INTERVALS[review.box];
}

/** Box after an answer. Mirrored in SQL by reviewRecallCard. */
export function nextBox(box: number | undefined, gotIt: boolean): number {
	if (!gotIt) return 0;
	return box === undefined ? 1 : Math.min(MAX_BOX, box + 1);
}

/**
 * Cards to ask now: from sessions she has finished at least once, that are due.
 * Weakest first (new and missed cards), then the most recent session first, so
 * "last time" always comes up.
 */
export function dueCards(
	project: Project,
	input: {
		seenTaskIds: ReadonlySet<string>;
		reviews: Record<string, ReviewState>;
		sessionsDone: number;
	},
	limit: number,
): RecallCard[] {
	const order = new Map(project.tasks.map((t, i) => [t.id, i]));
	return recallCards(project)
		.filter(
			(c) =>
				input.seenTaskIds.has(c.taskId) &&
				isDue(input.reviews[c.id], input.sessionsDone),
		)
		.sort(
			(a, b) =>
				(input.reviews[a.id]?.box ?? -1) - (input.reviews[b.id]?.box ?? -1) ||
				(order.get(b.taskId) ?? 0) - (order.get(a.taskId) ?? 0),
		)
		.slice(0, limit);
}
