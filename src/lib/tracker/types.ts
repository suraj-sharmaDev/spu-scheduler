/**
 * Learning-project content. Produced by `scripts/import-project.ts` from a
 * workbook and committed as JSON; read-only at runtime. Progress lives in the
 * database, keyed by the stable ids below (task `s12`, item `s12.do.0`).
 */

export interface Project {
	slug: string;
	title: string;
	/** Workbook the JSON was imported from, for provenance. */
	source: string;
	/** Goal / mindset / time — the intro lines of the guide. */
	about: GuideItem[];
	milestones: Milestone[];
	tasks: Task[];
	concepts: Concept[];
	guide: GuideSection[];
	/** Note templates (Stuck, Pseudocode) offered as one-click inserts. */
	templates: Template[];
	resources: Resource[];
	searchTips: string[];
	roadmapNote: string | null;
	reflection: {
		weeklyQuestions: string[];
		reviewQuestions: string[];
		/** Sub-projects that get a Project Review, in order. */
		reviewSubjects: string[];
	};
}

/** One week of the plan. */
export interface Milestone {
	id: string;
	number: number;
	/** The mini-project this week belongs to, e.g. "Student Manager". */
	subproject: string;
	bigQuestion: string;
	outcome: string;
	guidance: string;
}

/** One session. */
export interface Task {
	id: string;
	number: number;
	milestoneId: string;
	sessionInMilestone: number;
	title: string;
	/** Context lines shown above the steps. */
	intro: string[];
	/** "What to do" — the sub-tasks. */
	steps: ChecklistItem[];
	concepts: ConceptRef[];
	thinkAbout: string[];
	doneWhen: ChecklistItem[];
	/** 1 (easy) … 4 (challenge). */
	level: number;
	checkpoint: boolean;
}

export interface ChecklistItem {
	id: string;
	text: string;
	/** Optional extra, only for days with spare time. */
	stretch: boolean;
}

export interface ConceptRef {
	conceptId: string;
	/** First time the concept appears in the plan. */
	isNew: boolean;
}

export interface Concept {
	id: string;
	name: string;
	type: string;
	plain: string;
	example: string;
	why: string;
	learnMore: string | null;
}

export interface GuideItem {
	label: string;
	text: string;
}

export interface GuideSection {
	title: string;
	items: GuideItem[];
}

export interface Template {
	name: string;
	body: string;
}

export interface Resource {
	name: string;
	link: string | null;
	use: string;
}
