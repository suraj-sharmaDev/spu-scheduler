import { courses, getCourse } from "./data";
import { compareTerms, parseTermKey, termKey, termLabel } from "./quarters";
import { findConflicts, type SectionConflict } from "./schedule";
import type {
	Course,
	Plan,
	Requirements,
	Season,
	Section,
	Term,
} from "./types";

export const MAX_CREDITS = 18;
export const FULL_TIME_CREDITS = 12;

// ---------------------------------------------------------------------------
// Offering
// ---------------------------------------------------------------------------

export interface OfferingInfo {
	/** Concrete seasons the course is offered (ALT stripped out). */
	seasons: Season[];
	/** Catalog says "alternate years". */
	alternateYears: boolean;
	/** Catalog gave no offering info at all — we can't confirm a quarter. */
	unknown: boolean;
}

export function offeringInfo(course: Course): OfferingInfo {
	const seasons = course.offered.filter((o): o is Season => o !== "ALT");
	return {
		seasons,
		alternateYears: course.offered.includes("ALT"),
		unknown: course.offered.length === 0,
	};
}

/** Tri-state: true offered, false not offered, null unknown. */
export function offeredInSeason(
	course: Course,
	season: Season,
): boolean | null {
	const { seasons, unknown } = offeringInfo(course);
	if (unknown) return null;
	return seasons.includes(season);
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export interface EligibilityContext {
	/** Courses already completed (transfer + finished quarters). */
	completed: ReadonlySet<string>;
	/** Courses planned in *earlier* terms than the one being checked. */
	plannedBefore: ReadonlySet<string>;
	season: Season;
}

export interface Eligibility {
	prereqsMet: boolean;
	missingPrereqs: string[];
	/** true offered, false not offered, null offering unknown. */
	offeredThisSeason: boolean | null;
	/** Can be placed in this term (prereqs met, not known to be unoffered). */
	eligible: boolean;
}

export function isEligible(
	course: Course,
	ctx: EligibilityContext,
): Eligibility {
	const satisfied = (id: string) =>
		ctx.completed.has(id) || ctx.plannedBefore.has(id);
	const missingPrereqs = course.prereqs.filter((id) => !satisfied(id));
	const prereqsMet = missingPrereqs.length === 0;
	const offeredThisSeason = offeredInSeason(course, ctx.season);
	return {
		prereqsMet,
		missingPrereqs,
		offeredThisSeason,
		eligible: prereqsMet && offeredThisSeason !== false,
	};
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export function creditsForQuarter(plan: Plan, key: string): number {
	return (plan[key] ?? []).reduce(
		(sum, id) => sum + (getCourse(id)?.credits ?? 0),
		0,
	);
}

/** Every course id placed anywhere in the plan. */
export function plannedCourseIds(plan: Plan): Set<string> {
	return new Set(Object.values(plan).flat());
}

export function totalPlannedCredits(plan: Plan): number {
	return [...plannedCourseIds(plan)].reduce(
		(sum, id) => sum + (getCourse(id)?.credits ?? 0),
		0,
	);
}

export function totalCompletedCredits(completed: Iterable<string>): number {
	let sum = 0;
	for (const id of completed) sum += getCourse(id)?.credits ?? 0;
	return sum;
}

// ---------------------------------------------------------------------------
// Requirements progress
// ---------------------------------------------------------------------------

export type RequirementStatus = "completed" | "planned" | "remaining";

export interface RequirementCourseProgress {
	id: string;
	credits: number;
	status: RequirementStatus;
	or: boolean;
}

export interface RequirementGroupProgress {
	name: string;
	selectionRule: string | null;
	creditsRequired: number | null;
	completedCredits: number;
	plannedCredits: number;
	courses: RequirementCourseProgress[];
}

export interface RequirementsProgress {
	totalCreditsForDegree: number;
	completedCredits: number;
	plannedCredits: number;
	groups: RequirementGroupProgress[];
}

/** Groups whose requirement is "pick N credits of technical electives" rather than
 *  a fixed course list. Matched by name so both the "Technical Electives" and
 *  "Technical Elective Courses" rows the catalog emits are covered. */
const TECH_ELECTIVE_GROUP = /technical elective/i;

/** Courses that satisfy a technical-elective bucket beyond the ones the catalog
 *  happens to list: any upper-division (3000+) CS elective. Intro CS electives
 *  (CSC1xxx/2xxx, tagged CS_ELECTIVE too) are excluded — they don't count as
 *  technical electives. Heuristic over unverified data; confirm with an advisor. */
function isTechnicalElective(course: Course): boolean {
	return course.category === "CS_ELECTIVE" && Number(course.number) >= 3000;
}

export function remainingRequirements(
	requirements: Requirements,
	completed: ReadonlySet<string>,
	planned: ReadonlySet<string>,
): RequirementsProgress {
	let completedTotal = 0;
	let plannedTotal = 0;

	const statusOf = (id: string): RequirementStatus =>
		completed.has(id)
			? "completed"
			: planned.has(id)
				? "planned"
				: "remaining";

	const groups: RequirementGroupProgress[] = requirements.groups.map(
		(group) => {
			const isElectiveBucket =
				group.creditsRequired != null && TECH_ELECTIVE_GROUP.test(group.name);
			const cap = group.creditsRequired ?? Number.POSITIVE_INFINITY;

			let completedCredits = 0;
			let plannedCredits = 0;
			const seen = new Set<string>();
			const courseRows: RequirementCourseProgress[] = [];

			// Count a course toward this group, respecting the bucket's credit cap.
			const tally = (status: RequirementStatus, credits: number): void => {
				if (status === "remaining") return;
				if (isElectiveBucket && completedCredits + plannedCredits >= cap) return;
				if (status === "completed") completedCredits += credits;
				else plannedCredits += credits;
			};

			// 1) Courses the catalog explicitly lists for this group.
			for (const rc of group.courses) {
				if (seen.has(rc.id)) continue; // dedupe messy scraped rows
				seen.add(rc.id);
				const credits = rc.credits ?? getCourse(rc.id)?.credits ?? 0;
				const status = statusOf(rc.id);
				tally(status, credits);
				courseRows.push({ id: rc.id, credits, status, or: rc.or ?? false });
			}

			// 2) For an elective bucket, also let any upper-division CS elective the
			//    student actually picked fill it — so electives the catalog never
			//    names individually still count toward the requirement.
			if (isElectiveBucket) {
				for (const c of courses) {
					if (seen.has(c.id) || !isTechnicalElective(c)) continue;
					const status = statusOf(c.id);
					if (status === "remaining") continue; // only surface chosen ones
					if (completedCredits + plannedCredits >= cap) break;
					seen.add(c.id);
					tally(status, c.credits);
					courseRows.push({ id: c.id, credits: c.credits, status, or: false });
				}
			}

			completedTotal += completedCredits;
			plannedTotal += plannedCredits;
			return {
				name: group.name,
				selectionRule: group.selectionRule,
				creditsRequired: group.creditsRequired,
				completedCredits,
				plannedCredits,
				courses: courseRows,
			};
		},
	);

	return {
		totalCreditsForDegree: requirements.totalCreditsForDegree,
		completedCredits: completedTotal,
		plannedCredits: plannedTotal,
		groups,
	};
}

// ---------------------------------------------------------------------------
// Plan validation
// ---------------------------------------------------------------------------

export type WarningLevel = "error" | "warning";

export interface PlanWarning {
	termKey: string;
	level: WarningLevel;
	message: string;
	courseId?: string;
}

/** Walk the plan in chronological order and surface prereq gaps, overloads,
 *  and offering mismatches. Pure: depends only on its inputs + the catalog. */
export function validatePlan(
	plan: Plan,
	completed: ReadonlySet<string>,
): PlanWarning[] {
	const warnings: PlanWarning[] = [];
	const orderedKeys = Object.keys(plan)
		.filter((k) => (plan[k] ?? []).length > 0)
		.sort((a, b) => compareTerms(parseTermKey(a), parseTermKey(b)));

	// Courses completed strictly before the current term.
	const earned = new Set(completed);

	for (const key of orderedKeys) {
		const term = parseTermKey(key);
		const ids = plan[key] ?? [];

		const credits = creditsForQuarter(plan, key);
		if (credits > MAX_CREDITS) {
			warnings.push({
				termKey: key,
				level: "warning",
				message: `Heavy load: ${credits} credits (over ${MAX_CREDITS}).`,
			});
		}

		for (const id of ids) {
			const course = getCourse(id);
			if (!course) continue;

			const elig = isEligible(course, {
				completed: earned,
				plannedBefore: earned, // earned already folds in earlier terms
				season: term.season,
			});

			if (!elig.prereqsMet) {
				warnings.push({
					termKey: key,
					level: "error",
					courseId: id,
					message: `${id} needs ${elig.missingPrereqs.join(", ")} first.`,
				});
			}

			const offering = offeringInfo(course);
			if (elig.offeredThisSeason === false) {
				warnings.push({
					termKey: key,
					level: "warning",
					courseId: id,
					message: `${id} isn't typically offered in ${term.season}.`,
				});
			} else if (offering.unknown) {
				warnings.push({
					termKey: key,
					level: "warning",
					courseId: id,
					message: `${id} has no catalog offering info — confirm availability.`,
				});
			} else if (offering.alternateYears) {
				warnings.push({
					termKey: key,
					level: "warning",
					courseId: id,
					message: `${id} runs in alternate years — confirm it's offered this year.`,
				});
			}
		}

		// Everything in this term is now available to later terms.
		for (const id of ids) earned.add(id);
	}

	return warnings;
}

// ---------------------------------------------------------------------------
// Section-based plan (what the guided planner actually works with)
// ---------------------------------------------------------------------------

/** Collapse chosen sections into the term -> course-ids shape the requirements
 *  and credit helpers expect. */
export function sectionsToPlan(sections: Section[]): Plan {
	const plan: Plan = {};
	for (const s of sections) {
		const key = termKey({ season: s.season, year: s.year });
		const ids = plan[key] ?? [];
		ids.push(s.courseId);
		plan[key] = ids;
	}
	return plan;
}

export interface QuarterPlan {
	term: Term;
	key: string;
	sections: Section[];
	credits: number;
	conflicts: SectionConflict[];
}

export interface PlanCheck {
	/** No blocking problems — the plan is schedulable as drawn. */
	success: boolean;
	quarters: QuarterPlan[];
	totalCredits: number;
	/** Blocking issues: prereq gaps and time clashes. */
	problems: PlanWarning[];
	/** Advisory: heavy / light quarters. */
	notes: PlanWarning[];
}

/** Group selected sections into quarters and check the plan end-to-end:
 *  prerequisites earned in order, no time clashes, sane credit loads. */
export function checkPlan(
	selected: Section[],
	completed: ReadonlySet<string>,
): PlanCheck {
	const byTerm = new Map<string, Section[]>();
	for (const s of selected) {
		const key = termKey({ season: s.season, year: s.year });
		const list = byTerm.get(key) ?? [];
		list.push(s);
		byTerm.set(key, list);
	}

	const quarters: QuarterPlan[] = [...byTerm.entries()]
		.map(([key, sections]) => ({
			key,
			term: parseTermKey(key),
			sections,
			credits: sections.reduce((sum, s) => sum + s.credits, 0),
			conflicts: findConflicts(sections),
		}))
		.sort((a, b) => compareTerms(a.term, b.term));

	const problems: PlanWarning[] = [];
	const notes: PlanWarning[] = [];
	const earned = new Set(completed);

	for (const q of quarters) {
		if (q.credits > MAX_CREDITS) {
			notes.push({
				termKey: q.key,
				level: "warning",
				message: `Heavy load: ${q.credits} credits (over ${MAX_CREDITS}).`,
			});
		} else if (q.credits < FULL_TIME_CREDITS) {
			notes.push({
				termKey: q.key,
				level: "warning",
				message: `Part-time: ${q.credits} credits (under ${FULL_TIME_CREDITS}).`,
			});
		}

		for (const s of q.sections) {
			const course = getCourse(s.courseId);
			const missing = (course?.prereqs ?? []).filter((id) => !earned.has(id));
			if (missing.length > 0) {
				problems.push({
					termKey: q.key,
					level: "error",
					courseId: s.courseId,
					message: `${s.courseId} needs ${missing.join(", ")} beforehand.`,
				});
			}
		}

		for (const { a, b } of q.conflicts) {
			problems.push({
				termKey: q.key,
				level: "error",
				courseId: a.courseId,
				message: `${a.courseId} and ${b.courseId} overlap in ${termLabel(q.term)}.`,
			});
		}

		// Courses taken this quarter unlock prereqs for later quarters only.
		for (const s of q.sections) earned.add(s.courseId);
	}

	return {
		success: problems.length === 0,
		quarters,
		totalCredits: selected.reduce((sum, s) => sum + s.credits, 0),
		problems,
		notes,
	};
}
