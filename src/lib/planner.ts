import { getCourse } from "./data";
import { compareTerms, parseTermKey } from "./quarters";
import type { Course, Plan, Requirements, Season } from "./types";

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

export function remainingRequirements(
	requirements: Requirements,
	completed: ReadonlySet<string>,
	planned: ReadonlySet<string>,
): RequirementsProgress {
	let completedTotal = 0;
	let plannedTotal = 0;

	const groups: RequirementGroupProgress[] = requirements.groups.map(
		(group) => {
			let completedCredits = 0;
			let plannedCredits = 0;
			const seen = new Set<string>();
			const courses: RequirementCourseProgress[] = [];

			for (const rc of group.courses) {
				if (seen.has(rc.id)) continue; // dedupe messy scraped rows
				seen.add(rc.id);

				const credits = rc.credits ?? getCourse(rc.id)?.credits ?? 0;
				let status: RequirementStatus = "remaining";
				if (completed.has(rc.id)) {
					status = "completed";
					completedCredits += credits;
				} else if (planned.has(rc.id)) {
					status = "planned";
					plannedCredits += credits;
				}
				courses.push({ id: rc.id, credits, status, or: rc.or ?? false });
			}

			completedTotal += completedCredits;
			plannedTotal += plannedCredits;
			return {
				name: group.name,
				selectionRule: group.selectionRule,
				creditsRequired: group.creditsRequired,
				completedCredits,
				plannedCredits,
				courses,
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
