/**
 * Rewritten sessions (worked examples, hints, recall) are authored in TypeScript
 * because they hold code, and replace whole weeks of the imported workbook plan.
 * `applyLessons` splices them in and renumbers everything after.
 */
import type {
	ChecklistItem,
	GuideSection,
	Hint,
	Lesson,
	Milestone,
	Project,
	Task,
} from "./types";

export type StepInput =
	| string
	| { text: string; hint?: Hint; stretch?: boolean };

export interface LessonTaskInput {
	id: string;
	milestoneId: string;
	title: string;
	/** One line: what she'll have by the end. */
	goal: string;
	level: number;
	checkpoint?: boolean;
	/** Concept ids. The first session that uses one marks it new. */
	concepts: string[];
	steps: StepInput[];
	doneWhen: string[];
	lesson: Lesson;
}

export interface LessonPlan {
	/** Workbook milestones these lessons replace, with all their tasks. */
	replaces: string[];
	milestones: Omit<Milestone, "number">[];
	tasks: LessonTaskInput[];
	/** Guide sections to replace, matched by title. */
	guide?: GuideSection[];
}

function toItem(step: StepInput, id: string): ChecklistItem {
	if (typeof step === "string") return { id, text: step, stretch: false };
	return {
		id,
		text: step.text,
		stretch: step.stretch ?? false,
		...(step.hint && { hint: step.hint }),
	};
}

function toTask(input: LessonTaskInput): Task {
	return {
		id: input.id,
		number: 0,
		milestoneId: input.milestoneId,
		sessionInMilestone: 0,
		title: input.title,
		intro: [input.goal],
		steps: input.steps.map((s, i) => toItem(s, `${input.id}.do.${i}`)),
		concepts: input.concepts.map((conceptId) => ({ conceptId, isNew: false })),
		thinkAbout: [],
		doneWhen: input.doneWhen.map((text, i) => ({
			id: `${input.id}.done.${i}`,
			text,
			stretch: false,
		})),
		level: input.level,
		checkpoint: input.checkpoint ?? false,
		lesson: input.lesson,
	};
}

/** Put the lessons first (in place of the weeks they replace) and renumber. */
export function applyLessons(base: Project, plan: LessonPlan): Project {
	const replaced = new Set(plan.replaces);
	const milestones = [
		...plan.milestones.map((m) => ({ ...m, number: 0 })),
		...base.milestones.filter((m) => !replaced.has(m.id)),
	].map((m, i) => ({ ...m, number: i + 1 }));

	const ordered = [
		...plan.tasks.map(toTask),
		...base.tasks.filter((t) => !replaced.has(t.milestoneId)),
	];
	// A concept is new where it first appears in the new order, not the workbook's.
	const seen = new Set<string>();
	const perMilestone = new Map<string, number>();
	const tasks = ordered.map((t, i) => {
		const inMilestone = (perMilestone.get(t.milestoneId) ?? 0) + 1;
		perMilestone.set(t.milestoneId, inMilestone);
		return {
			...t,
			number: i + 1,
			sessionInMilestone: inMilestone,
			concepts: t.concepts.map((ref) => {
				const isNew = !seen.has(ref.conceptId);
				seen.add(ref.conceptId);
				return { ...ref, isNew };
			}),
		};
	});

	const guide = base.guide.map(
		(section) => plan.guide?.find((g) => g.title === section.title) ?? section,
	);
	return { ...base, milestones, tasks, guide };
}
