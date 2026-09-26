import coursesJson from "#/data/courses.json" with { type: "json" };
import pathwaysJson from "#/data/pathways.json" with { type: "json" };
import requirementsJson from "#/data/requirements.json" with { type: "json" };
import sectionsJson from "#/data/sections.json" with { type: "json" };
import type {
	Course,
	EntryType,
	Pathway,
	Requirements,
	Season,
	Section,
	Term,
} from "./types";

export const courses = coursesJson as Course[];
export const requirements = requirementsJson as Requirements;
export const sections = sectionsJson as Section[];
export const pathways = pathwaysJson as Pathway[];

/** The official recommended sequence for an entry type, if we have one. */
export function getPathway(entryType: EntryType): Pathway | undefined {
	return pathways.find((p) => p.entryType === entryType);
}

/** Academic year the published time schedule covers (Autumn 2026 → Summer 2027). */
export const SCHEDULE_YEAR_START = 2026;
export const SCHEDULE_YEAR_LABEL = `${SCHEDULE_YEAR_START}–${SCHEDULE_YEAR_START + 1}`;

/** The calendar term a season maps to inside the schedule year (Autumn opens it). */
export function scheduleTerm(season: Season): Term {
	return {
		season,
		year: season === "AUT" ? SCHEDULE_YEAR_START : SCHEDULE_YEAR_START + 1,
	};
}

/** Fast lookup by course id. */
export const coursesById: ReadonlyMap<string, Course> = new Map(
	courses.map((c) => [c.id, c]),
);

export function getCourse(id: string): Course | undefined {
	return coursesById.get(id);
}

/** Fast lookup of a section by its CRN (the selection key). */
export const sectionByCrn: ReadonlyMap<string, Section> = new Map(
	sections.map((s) => [s.crn, s]),
);

export function getSection(crn: string): Section | undefined {
	return sectionByCrn.get(crn);
}

/** True if either dataset still has unverified rows (drives the UI warning). */
export const dataNeedsVerification: boolean =
	!requirements.verified || courses.some((c) => !c.verified);

/** The set of course ids the BS-CS degree actually references. The planner and
 *  overview operate on this focused set rather than the whole catalog. */
export const degreeCourseIds: ReadonlySet<string> = new Set(
	requirements.groups.flatMap((g) => g.courses.map((c) => c.id)),
);

/** Degree courses, deduped and resolved to full Course records (in catalog
 *  order), skipping any id we don't have a description for. */
export const degreeCourses: Course[] = courses.filter((c) =>
	degreeCourseIds.has(c.id),
);

/** Sections the guided planner offers: every section of a course in our curated
 *  catalog that actually runs this schedule year. This is broader than
 *  `degreeCourseIds` on purpose — electives (e.g. CSC2330) and gen-ed courses are
 *  valid choices even though the BS-CS program page never names them individually. */
export const degreeSections: Section[] = sections.filter((s) =>
	coursesById.has(s.courseId),
);
