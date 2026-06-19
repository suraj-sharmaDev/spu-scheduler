import coursesJson from "#/data/courses.json" with { type: "json" };
import requirementsJson from "#/data/requirements.json" with { type: "json" };
import type { Course, Requirements } from "./types";

export const courses = coursesJson as Course[];
export const requirements = requirementsJson as Requirements;

/** Fast lookup by course id. */
export const coursesById: ReadonlyMap<string, Course> = new Map(
	courses.map((c) => [c.id, c]),
);

export function getCourse(id: string): Course | undefined {
	return coursesById.get(id);
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
