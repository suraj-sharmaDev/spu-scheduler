import { courses, getCourse } from "./data";
import { compareTerms, parseTermKey, termKey, termLabel } from "./quarters";
import { findConflicts, fitsDays, type SectionConflict } from "./schedule";
import type {
	Course,
	Day,
	Pathway,
	Plan,
	Prereq,
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
// Prerequisites
// ---------------------------------------------------------------------------

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Is a single prereq satisfied? `earned` is everything completed or taken in
 *  an earlier term; `sameTerm` is the rest of *this* quarter, which only a
 *  `coreq` may lean on. Recurses through `anyOf` groups. */
export function prereqSatisfied(
	prereq: Prereq,
	earned: ReadonlySet<string>,
	sameTerm: ReadonlySet<string> = EMPTY_SET,
): boolean {
	if ("anyOf" in prereq) {
		return prereq.anyOf.some((p) => prereqSatisfied(p, earned, sameTerm));
	}
	if ("coreq" in prereq) {
		return earned.has(prereq.coreq) || sameTerm.has(prereq.coreq);
	}
	// We don't track grades, so `minGrade` is advisory: presence satisfies it.
	return earned.has(prereq.course);
}

/** Human label for a prereq, e.g. "CSC2430 (C+)" or "CSC2430 or CSC2330". */
export function prereqLabel(prereq: Prereq): string {
	if ("anyOf" in prereq) return prereq.anyOf.map(prereqLabel).join(" or ");
	if ("coreq" in prereq) return `${prereq.coreq} (same quarter)`;
	return prereq.minGrade
		? `${prereq.course} (${prereq.minGrade})`
		: prereq.course;
}

/** Labels for the top-level prereqs of `course` that aren't yet met. */
export function unmetPrereqs(
	course: Course,
	earned: ReadonlySet<string>,
	sameTerm: ReadonlySet<string> = EMPTY_SET,
): string[] {
	return course.prereqs
		.filter((p) => !prereqSatisfied(p, earned, sameTerm))
		.map(prereqLabel);
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export interface EligibilityContext {
	/** Courses already completed (transfer + finished quarters). */
	completed: ReadonlySet<string>;
	/** Courses planned in *earlier* terms than the one being checked. */
	plannedBefore: ReadonlySet<string>;
	/** Other courses placed in the *same* term — only coreqs use these. */
	sameTerm?: ReadonlySet<string>;
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
	const earned = new Set([...ctx.completed, ...ctx.plannedBefore]);
	const missingPrereqs = unmetPrereqs(course, earned, ctx.sameTerm);
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
		completed.has(id) ? "completed" : planned.has(id) ? "planned" : "remaining";

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
				if (isElectiveBucket && completedCredits + plannedCredits >= cap)
					return;
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

		// Coreqs may be satisfied by anything else taken this same quarter.
		const thisTerm = new Set(q.sections.map((s) => s.courseId));
		for (const s of q.sections) {
			const course = getCourse(s.courseId);
			if (!course) continue;
			const missing = unmetPrereqs(course, earned, thisTerm);
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

// ---------------------------------------------------------------------------
// Pathway-seeded suggestions
// ---------------------------------------------------------------------------

/** Academic-quarter order a pathway walks through. Summer is skipped — the
 *  published plans only schedule Autumn/Winter/Spring (docs/PATHWAYS.md §2). */
const ACADEMIC_FLOW: Season[] = ["AUT", "WIN", "SPR"];

/** The season a pathway step lands in, given where the student starts. A start
 *  in Summer (off the academic walk) just begins at Autumn. */
export function seasonForOffset(startSeason: Season, offset: number): Season {
	const base = ACADEMIC_FLOW.indexOf(startSeason);
	const start = base === -1 ? 0 : base;
	return ACADEMIC_FLOW[(start + offset) % ACADEMIC_FLOW.length];
}

/** The real term (season + calendar year) a pathway step lands in. Walks the
 *  academic flow Autumn→Winter→Spring, rolling the calendar year at each Autumn.
 *  A Summer start (off the walk) begins at the next Autumn. This is what makes
 *  a multi-year pathway lay out across multiple years instead of piling into
 *  the single year the time schedule happens to be published for. */
export function termForOffset(start: Term, offset: number): Term {
	const base = ACADEMIC_FLOW.indexOf(start.season);
	// The academic year the start term belongs to: Autumn opens academic year Y;
	// the Winter and Spring that follow belong to that same academic year Y.
	const startAcademicYear =
		base === -1 || start.season === "AUT" ? start.year : start.year - 1;
	const idx0 = base === -1 ? 0 : base;
	const total = idx0 + offset;
	const season = ACADEMIC_FLOW[total % ACADEMIC_FLOW.length];
	const academicYear =
		startAcademicYear + Math.floor(total / ACADEMIC_FLOW.length);
	return { season, year: season === "AUT" ? academicYear : academicYear + 1 };
}

export interface PlanSuggestion {
	/** The recommended sequence laid out across real terms (termKey → courseIds).
	 *  Spans every year of the plan — it rides on the pathway, not the single
	 *  year of section data, so nothing gets dropped or crammed. */
	placements: Plan;
	/** Pathway courses already completed (or covered by the DTA) — nothing to add. */
	alreadyDone: string[];
}

/** Lay an official pathway out across real terms from where she starts: walk the
 *  academic flow, roll the year each Autumn, and drop courses she's already done.
 *  Pure pathway→terms — no section data — so it covers the *whole* multi-year
 *  plan, not just the year the time schedule has been published for. A starting
 *  point she edits from, not a lock. */
export function suggestPlan(
	pathway: Pathway,
	completed: ReadonlySet<string>,
	start: Term,
): PlanSuggestion {
	const placements: Plan = {};
	const alreadyDone: string[] = [];
	const placed = new Set<string>();

	for (const step of pathway.steps) {
		const key = termKey(termForOffset(start, step.termOffset));
		for (const courseId of step.courseIds) {
			if (completed.has(courseId)) {
				alreadyDone.push(courseId);
				continue;
			}
			if (placed.has(courseId)) continue; // a pathway lists each course once
			const list = placements[key] ?? [];
			list.push(courseId);
			placements[key] = list;
			placed.add(courseId);
		}
	}

	return { placements, alreadyDone };
}

// ---------------------------------------------------------------------------
// Plan view — decorate a course-placement plan with real sections
// ---------------------------------------------------------------------------

/** A single course placed in a term, decorated with everything the UI needs. */
export interface PlannedCourse {
	courseId: string;
	title: string;
	credits: number;
	/** Chosen section for a published-year course (best-fit, or her override). */
	section: Section | null;
	/** Every section of this course that fits her days this term — lets her swap. */
	candidates: Section[];
	/** Its term is in the published schedule year, so concrete sections exist. */
	schedulable: boolean;
	/** Schedulable term, but no section fits her available days. */
	noFittingSection: boolean;
	/** Catalog offering vs the term's season: true offered, false not, null unknown. */
	offeredThisSeason: boolean | null;
	/** Prereqs not satisfied by completed + earlier-term courses. */
	missingPrereqs: string[];
	/** Time-clashes with another course chosen in the same term. */
	clash: boolean;
}

export interface PlannedTerm {
	key: string;
	term: Term;
	/** The published schedule year covers this term (days/times are knowable). */
	schedulable: boolean;
	courses: PlannedCourse[];
	credits: number;
}

export interface PlanView {
	terms: PlannedTerm[];
	totalCredits: number;
	/** Hard problems across the whole plan: prereq gaps + time clashes. */
	problems: number;
}

/** Resolve a multi-year course-placement plan into a schedulable view: attach
 *  real sections (days/times, clashes) for the published year, fall back to
 *  catalog offering hints for future years, and check prereqs in chronological
 *  order. The plan layer (placements) never needs section data — this is the
 *  decoration that makes the published year concrete and degrades gracefully
 *  beyond it. Pure: depends only on its inputs. */
export function buildPlanView(
	placements: Plan,
	completed: ReadonlySet<string>,
	availableDays: ReadonlySet<Day>,
	sectionChoices: Readonly<Record<string, string>>,
	sections: Section[],
): PlanView {
	// Terms the published schedule actually covers — anything with a section.
	const scheduleKeys = new Set(
		sections.map((s) => termKey({ season: s.season, year: s.year })),
	);

	const orderedKeys = Object.keys(placements)
		.filter((k) => (placements[k] ?? []).length > 0)
		.sort((a, b) => compareTerms(parseTermKey(a), parseTermKey(b)));

	const earned = new Set(completed);
	const terms: PlannedTerm[] = [];
	let totalCredits = 0;
	let problems = 0;

	for (const key of orderedKeys) {
		const term = parseTermKey(key);
		const schedulable = scheduleKeys.has(key);
		// A course marked complete after being placed is earned, not planned.
		const ids = (placements[key] ?? []).filter((id) => !completed.has(id));
		if (ids.length === 0) continue;
		const sameTerm = new Set(ids);

		// Resolve a section per course first — clash detection needs them all.
		const resolved = new Map<string, Section | null>();
		const candidatesById = new Map<string, Section[]>();
		for (const id of ids) {
			const candidates = sections
				.filter(
					(s) =>
						s.courseId === id &&
						s.season === term.season &&
						s.year === term.year &&
						fitsDays(s, availableDays),
				)
				.sort(
					(a, b) =>
						(a.startMin ?? Number.POSITIVE_INFINITY) -
							(b.startMin ?? Number.POSITIVE_INFINITY) ||
						a.crn.localeCompare(b.crn),
				);
			candidatesById.set(id, candidates);
			const chosen =
				candidates.find((s) => s.crn === sectionChoices[id]) ??
				candidates[0] ??
				null;
			resolved.set(id, chosen);
		}

		const chosenSections = [...resolved.values()].filter(
			(s): s is Section => s != null,
		);
		const clashCrns = new Set(
			findConflicts(chosenSections).flatMap((c) => [c.a.crn, c.b.crn]),
		);

		let credits = 0;
		const planned: PlannedCourse[] = ids.map((id) => {
			const course = getCourse(id);
			const section = resolved.get(id) ?? null;
			const candidates = candidatesById.get(id) ?? [];
			const credit = section?.credits ?? course?.credits ?? 0;
			credits += credit;
			const missingPrereqs = course
				? unmetPrereqs(course, earned, sameTerm)
				: [];
			const clash = section ? clashCrns.has(section.crn) : false;
			if (missingPrereqs.length > 0 || clash) problems++;
			return {
				courseId: id,
				title: course?.title ?? "Unknown course",
				credits: credit,
				section,
				candidates,
				schedulable,
				noFittingSection: schedulable && candidates.length === 0,
				offeredThisSeason: course ? offeredInSeason(course, term.season) : null,
				missingPrereqs,
				clash,
			};
		});

		totalCredits += credits;
		terms.push({ key, term, schedulable, courses: planned, credits });
		for (const id of ids) earned.add(id);
	}

	return { terms, totalCredits, problems };
}
