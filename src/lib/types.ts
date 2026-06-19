// Domain types for the SPU course planner.
// These mirror the shape of the committed JSON in `src/data/`.

/** A real, schedulable quarter. `ALT` (alternate years) is a *modifier* the
 *  catalog adds to `offered`, not a quarter you can actually attend. */
export type Season = "AUT" | "WIN" | "SPR" | "SUM";

/** Values that may appear in a course's `offered` array. */
export type OfferedTag = Season | "ALT";

export type CourseCategory = "CS_CORE" | "CS_ELECTIVE" | "MATH" | "OTHER";

export interface Course {
	id: string;
	subject: string;
	number: string;
	title: string;
	credits: number;
	creditsRaw: string;
	offered: OfferedTag[];
	offeredRaw: string;
	prereqs: string[];
	prereqsRaw: string;
	category: CourseCategory;
	/** Flips to true after a human reviews the scraped row. */
	verified: boolean;
}

export interface RequirementCourse {
	id: string;
	credits: number | null;
	/** Marks an "X or Y" alternative within a group. */
	or?: boolean;
}

export interface RequirementGroup {
	name: string;
	creditsRequired: number | null;
	selectionRule: string | null;
	courses: RequirementCourse[];
}

export interface Requirements {
	catalogYear: string;
	sourceUrl: string;
	scrapedAt: string;
	totalCreditsForDegree: number;
	verified: boolean;
	groups: RequirementGroup[];
}

/** A specific quarter in a specific calendar year, e.g. Autumn 2026. */
export interface Term {
	season: Season;
	/** Calendar year the quarter starts in (Autumn 2026, Winter 2027, ...). */
	year: number;
}

/** A plan maps a term key (see `termKey`) to the course ids placed in it. */
export type Plan = Record<string, string[]>;

/** Everything we persist to localStorage. */
export interface AppState {
	/** Course ids the student has already completed (incl. transfer credit). */
	completed: string[];
	/** Whether the DTA / Common Curriculum is considered satisfied. */
	dtaComplete: boolean;
	/** First quarter of the plan timeline. */
	startTerm: Term;
	/** How many consecutive quarters the timeline shows. */
	horizon: number;
	/** The working plan: term key -> course ids. */
	plan: Plan;
}
