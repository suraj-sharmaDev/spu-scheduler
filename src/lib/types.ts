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

/** Weekday tokens exactly as the SPU time schedule prints them. */
export type Day = "M" | "Tu" | "W" | "Th" | "F" | "Sa";

/** A concrete, schedulable class section from the quarterly time schedule.
 *  Mirrors `src/data/sections.json` (produced by `pnpm scrape`). */
export interface Section {
	/** Course Registration Number — unique per section, our selection key. */
	crn: string;
	courseId: string;
	season: Season;
	year: number;
	/** Meeting days; empty for fully-arranged / online-async sections. */
	days: Day[];
	/** Minutes from midnight, null when there is no fixed meeting time. */
	startMin: number | null;
	endMin: number | null;
	timeRaw: string;
	credits: number;
	/** Online / by-appointment — its days are advisory, not a hard conflict. */
	arranged: boolean;
	instructor: string;
}

/** A plan maps a term key (see `termKey`) to the course ids placed in it.
 *  Derived from the chosen sections; still the unit the requirements/credit
 *  helpers operate on. */
export type Plan = Record<string, string[]>;

/** Everything we persist to localStorage. */
export interface AppState {
	/** Course ids the student has already completed (incl. transfer credit). */
	completed: string[];
	/** Whether the DTA / Common Curriculum is considered satisfied. */
	dtaComplete: boolean;
	/** Quarter she begins attending (within the published schedule year). */
	startSeason: Season;
	/** Weekdays she's willing to be on campus — the offering filter. */
	availableDays: Day[];
	/** CRNs of the sections she's chosen — the working plan. */
	selectedCrns: string[];
}
