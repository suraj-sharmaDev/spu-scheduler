import { describe, expect, it } from "vitest";
import { requirements } from "./data";
import {
	buildPlanView,
	checkPlan,
	creditsForQuarter,
	isEligible,
	offeredInSeason,
	offeringInfo,
	remainingRequirements,
	seasonForOffset,
	sectionsToPlan,
	suggestPlan,
	termForOffset,
	validatePlan,
} from "./planner";
import {
	compareTerms,
	generateTerms,
	nextTerm,
	parseTermKey,
	termIndex,
	termKey,
} from "./quarters";
import { findConflicts, sectionsClash } from "./schedule";
import type { Course, Pathway, Section } from "./types";

function makeCourse(partial: Partial<Course> & { id: string }): Course {
	return {
		subject: "CSC",
		number: "0000",
		title: "Test Course",
		credits: 5,
		creditsRaw: "(5 Credits)",
		offered: [],
		offeredRaw: "",
		prereqs: [],
		prereqsRaw: "",
		category: "CS_CORE",
		verified: false,
		...partial,
	};
}

function makeSection(partial: Partial<Section> & { crn: string }): Section {
	return {
		courseId: "CSC2430",
		season: "AUT",
		year: 2026,
		days: ["M", "W", "F"],
		startMin: 9 * 60,
		endMin: 10 * 60,
		timeRaw: "9:00 AM-10:00 AM",
		credits: 5,
		arranged: false,
		instructor: "Test",
		...partial,
	};
}

describe("quarters", () => {
	it("advances chronologically across the year boundary", () => {
		expect(nextTerm({ season: "AUT", year: 2026 })).toEqual({
			season: "WIN",
			year: 2027,
		});
		expect(nextTerm({ season: "SUM", year: 2026 })).toEqual({
			season: "AUT",
			year: 2026,
		});
	});

	it("orders Autumn before the following Winter", () => {
		expect(
			compareTerms(
				{ season: "AUT", year: 2026 },
				{ season: "WIN", year: 2027 },
			),
		).toBeLessThan(0);
		expect(termIndex({ season: "WIN", year: 2027 })).toBeGreaterThan(
			termIndex({ season: "AUT", year: 2026 }),
		);
	});

	it("generates a consecutive sequence", () => {
		const terms = generateTerms({ season: "AUT", year: 2026 }, 4);
		expect(terms.map(termKey)).toEqual([
			"AUT-2026",
			"WIN-2027",
			"SPR-2027",
			"SUM-2027",
		]);
	});

	it("round-trips term keys", () => {
		const term = { season: "SPR", year: 2027 } as const;
		expect(parseTermKey(termKey(term))).toEqual(term);
	});
});

describe("offering", () => {
	it("splits seasons from the alternate-years modifier", () => {
		const c = makeCourse({ id: "X", offered: ["ALT", "SPR"] });
		expect(offeringInfo(c)).toEqual({
			seasons: ["SPR"],
			alternateYears: true,
			unknown: false,
		});
		expect(offeredInSeason(c, "SPR")).toBe(true);
		expect(offeredInSeason(c, "AUT")).toBe(false);
	});

	it("returns null when offering is unknown", () => {
		const c = makeCourse({ id: "X", offered: [] });
		expect(offeringInfo(c).unknown).toBe(true);
		expect(offeredInSeason(c, "WIN")).toBeNull();
	});
});

describe("isEligible", () => {
	const course = makeCourse({
		id: "CSC2430",
		offered: ["AUT", "SPR"],
		prereqs: [{ course: "CSC1230" }],
	});

	it("is eligible when prereqs are met and offered that season", () => {
		const e = isEligible(course, {
			completed: new Set(["CSC1230"]),
			plannedBefore: new Set(),
			season: "AUT",
		});
		expect(e.prereqsMet).toBe(true);
		expect(e.offeredThisSeason).toBe(true);
		expect(e.eligible).toBe(true);
	});

	it("reports missing prereqs", () => {
		const e = isEligible(course, {
			completed: new Set(),
			plannedBefore: new Set(),
			season: "AUT",
		});
		expect(e.missingPrereqs).toEqual(["CSC1230"]);
		expect(e.eligible).toBe(false);
	});

	it("accepts prereqs satisfied by earlier planned terms", () => {
		const e = isEligible(course, {
			completed: new Set(),
			plannedBefore: new Set(["CSC1230"]),
			season: "SPR",
		});
		expect(e.prereqsMet).toBe(true);
	});

	it("is not eligible when not offered that season", () => {
		const e = isEligible(course, {
			completed: new Set(["CSC1230"]),
			plannedBefore: new Set(),
			season: "WIN",
		});
		expect(e.offeredThisSeason).toBe(false);
		expect(e.eligible).toBe(false);
	});

	it("satisfies an anyOf group with either member", () => {
		const c = makeCourse({
			id: "CSC2431",
			offered: ["WIN"],
			prereqs: [
				{
					anyOf: [
						{ course: "CSC2430", minGrade: "C+" },
						{ course: "CSC2330", minGrade: "C+" },
					],
				},
			],
		});
		// The transfer case: only the bridge course CSC2330 was taken.
		const e = isEligible(c, {
			completed: new Set(["CSC2330"]),
			plannedBefore: new Set(),
			season: "WIN",
		});
		expect(e.prereqsMet).toBe(true);
		// With neither, the group is reported as a single "X or Y" gap.
		const miss = isEligible(c, {
			completed: new Set(),
			plannedBefore: new Set(),
			season: "WIN",
		});
		expect(miss.missingPrereqs).toEqual(["CSC2430 (C+) or CSC2330 (C+)"]);
	});

	it("lets a coreq be satisfied within the same term", () => {
		const c = makeCourse({
			id: "CSC3221",
			offered: ["SPR"],
			prereqs: [{ coreq: "CSC3220" }],
		});
		const e = isEligible(c, {
			completed: new Set(),
			plannedBefore: new Set(),
			sameTerm: new Set(["CSC3220"]),
			season: "SPR",
		});
		expect(e.prereqsMet).toBe(true);
	});
});

describe("creditsForQuarter", () => {
	it("sums credits of placed courses (real catalog data)", () => {
		// CSC2430 and MAT1234 are both 5-credit courses.
		const plan = { "AUT-2026": ["CSC2430", "MAT1234"] };
		expect(creditsForQuarter(plan, "AUT-2026")).toBe(10);
		expect(creditsForQuarter(plan, "WIN-2027")).toBe(0);
	});
});

describe("remainingRequirements", () => {
	it("counts completed credits and preserves the degree total", () => {
		const progress = remainingRequirements(
			requirements,
			new Set(["CSC1250"]),
			new Set(),
		);
		expect(progress.totalCreditsForDegree).toBe(
			requirements.totalCreditsForDegree,
		);
		expect(progress.completedCredits).toBeGreaterThanOrEqual(5);
	});

	// The catalog lists only a handful of named technical electives, but the
	// requirement is "pick N credits" — any upper-division CS elective should fill it.
	const techElectiveGroups = (p: ReturnType<typeof remainingRequirements>) =>
		p.groups.filter((g) => /technical elective/i.test(g.name));

	it("fills a technical-elective bucket with an unlisted upper-division elective", () => {
		// CSC3750 is a 3000-level CS elective the BS-CS page never names individually.
		const progress = remainingRequirements(
			requirements,
			new Set(),
			new Set(["CSC3750"]),
		);
		const groups = techElectiveGroups(progress);
		expect(groups.length).toBeGreaterThan(0);
		const filled = groups.find((g) =>
			g.courses.some((c) => c.id === "CSC3750" && c.status === "planned"),
		);
		expect(filled).toBeDefined();
		expect(filled?.plannedCredits).toBeGreaterThanOrEqual(
			filled?.creditsRequired ?? 0,
		);
	});

	it("does not let a lower-division CS elective count as a technical elective", () => {
		// CSC1230 is tagged CS_ELECTIVE but is intro-level — not a technical elective.
		const progress = remainingRequirements(
			requirements,
			new Set(),
			new Set(["CSC1230"]),
		);
		for (const g of techElectiveGroups(progress)) {
			expect(g.courses.some((c) => c.id === "CSC1230")).toBe(false);
			expect(g.plannedCredits).toBe(0);
		}
	});

	it("caps a technical-elective bucket at its required credits", () => {
		// Two unlisted electives planned, but the bucket only needs its credits once.
		const progress = remainingRequirements(
			requirements,
			new Set(),
			new Set(["CSC3750", "CSC3760"]),
		);
		for (const g of techElectiveGroups(progress)) {
			const counted = g.completedCredits + g.plannedCredits;
			// Never counts more than the first course needed to satisfy the bucket.
			expect(counted).toBeLessThanOrEqual(5);
		}
	});
});

describe("validatePlan", () => {
	it("returns nothing for an empty plan", () => {
		expect(validatePlan({}, new Set())).toEqual([]);
	});

	it("flags an overloaded quarter", () => {
		// 4 x 5-credit courses = 20 credits, over the 18 cap.
		const plan = {
			"AUT-2026": ["CSC2430", "CSC2431", "MAT1234", "MAT1235"],
		};
		const warnings = validatePlan(plan, new Set());
		expect(
			warnings.some(
				(w) => w.level === "warning" && /heavy load/i.test(w.message),
			),
		).toBe(true);
	});
});

describe("sectionsClash", () => {
	it("clashes when a day and time both overlap", () => {
		const a = makeSection({
			crn: "1",
			days: ["M", "W"],
			startMin: 540,
			endMin: 600,
		});
		const b = makeSection({
			crn: "2",
			days: ["W", "F"],
			startMin: 570,
			endMin: 660,
		});
		expect(sectionsClash(a, b)).toBe(true);
	});

	it("does not clash when days are disjoint", () => {
		const a = makeSection({ crn: "1", days: ["M", "W", "F"] });
		const b = makeSection({ crn: "2", days: ["Tu", "Th"] });
		expect(sectionsClash(a, b)).toBe(false);
	});

	it("does not clash when times are back-to-back", () => {
		const a = makeSection({
			crn: "1",
			days: ["M"],
			startMin: 540,
			endMin: 600,
		});
		const b = makeSection({
			crn: "2",
			days: ["M"],
			startMin: 600,
			endMin: 660,
		});
		expect(sectionsClash(a, b)).toBe(false);
	});

	it("never clashes when a section has no fixed time (arranged)", () => {
		const a = makeSection({
			crn: "1",
			days: ["M"],
			startMin: null,
			endMin: null,
		});
		const b = makeSection({
			crn: "2",
			days: ["M"],
			startMin: 540,
			endMin: 600,
		});
		expect(sectionsClash(a, b)).toBe(false);
		expect(findConflicts([a, b])).toEqual([]);
	});
});

describe("checkPlan", () => {
	it("succeeds for non-overlapping sections that meet prereqs", () => {
		const sections = [
			makeSection({
				crn: "1",
				courseId: "CSC2430",
				days: ["M", "W"],
				startMin: 540,
				endMin: 600,
			}),
			makeSection({
				crn: "2",
				courseId: "MAT1234",
				days: ["Tu", "Th"],
				startMin: 540,
				endMin: 660,
			}),
		];
		// CSC2430's curated prereq (CSC1260) is already earned.
		const result = checkPlan(sections, new Set(["CSC1260"]));
		expect(result.success).toBe(true);
		expect(result.totalCredits).toBe(10);
		expect(result.quarters).toHaveLength(1);
	});

	it("fails when two sections clash in the same quarter", () => {
		const sections = [
			makeSection({
				crn: "1",
				courseId: "CSC2430",
				days: ["M"],
				startMin: 540,
				endMin: 600,
			}),
			makeSection({
				crn: "2",
				courseId: "MAT1234",
				days: ["M"],
				startMin: 570,
				endMin: 630,
			}),
		];
		const result = checkPlan(sections, new Set());
		expect(result.success).toBe(false);
		expect(result.problems.some((p) => /overlap/i.test(p.message))).toBe(true);
	});

	it("groups sections across quarters chronologically", () => {
		const sections = [
			makeSection({ crn: "2", courseId: "MAT1235", season: "WIN", year: 2027 }),
			makeSection({ crn: "1", courseId: "CSC2430", season: "AUT", year: 2026 }),
		];
		const result = checkPlan(sections, new Set());
		expect(result.quarters.map((q) => q.key)).toEqual(["AUT-2026", "WIN-2027"]);
	});
});

describe("sectionsToPlan", () => {
	it("buckets sections into their term keys", () => {
		const sections = [
			makeSection({ crn: "1", courseId: "CSC2430", season: "AUT", year: 2026 }),
			makeSection({ crn: "2", courseId: "MAT1234", season: "AUT", year: 2026 }),
			makeSection({ crn: "3", courseId: "MAT1235", season: "WIN", year: 2027 }),
		];
		expect(sectionsToPlan(sections)).toEqual({
			"AUT-2026": ["CSC2430", "MAT1234"],
			"WIN-2027": ["MAT1235"],
		});
	});
});

describe("seasonForOffset", () => {
	it("walks Autumn → Winter → Spring, skipping Summer", () => {
		expect(seasonForOffset("AUT", 0)).toBe("AUT");
		expect(seasonForOffset("AUT", 1)).toBe("WIN");
		expect(seasonForOffset("AUT", 2)).toBe("SPR");
		expect(seasonForOffset("AUT", 3)).toBe("AUT");
	});

	it("starts the walk from a non-Autumn start quarter", () => {
		expect(seasonForOffset("WIN", 0)).toBe("WIN");
		expect(seasonForOffset("WIN", 1)).toBe("SPR");
		expect(seasonForOffset("WIN", 2)).toBe("AUT");
	});
});

describe("termForOffset", () => {
	it("rolls the calendar year across multiple academic years", () => {
		const start = { season: "AUT", year: 2026 } as const;
		expect(termForOffset(start, 0)).toEqual({ season: "AUT", year: 2026 });
		expect(termForOffset(start, 1)).toEqual({ season: "WIN", year: 2027 });
		expect(termForOffset(start, 2)).toEqual({ season: "SPR", year: 2027 });
		// Second academic year — this is what stops a 2-year plan piling into one.
		expect(termForOffset(start, 3)).toEqual({ season: "AUT", year: 2027 });
		expect(termForOffset(start, 4)).toEqual({ season: "WIN", year: 2028 });
		expect(termForOffset(start, 5)).toEqual({ season: "SPR", year: 2028 });
	});

	it("keeps a Winter start inside its own academic year", () => {
		const start = { season: "WIN", year: 2027 } as const;
		expect(termForOffset(start, 0)).toEqual({ season: "WIN", year: 2027 });
		expect(termForOffset(start, 1)).toEqual({ season: "SPR", year: 2027 });
		expect(termForOffset(start, 2)).toEqual({ season: "AUT", year: 2027 });
	});
});

describe("suggestPlan", () => {
	const pathway: Pathway = {
		entryType: "transfer",
		degree: "BS-CS",
		source: "test",
		totalCreditsRange: [86, 93],
		steps: [
			{ termOffset: 0, courseIds: ["CSC2330", "TCOR3001"] },
			{ termOffset: 1, courseIds: ["CSC2431"] },
			{ termOffset: 3, courseIds: ["CSC4898"] }, // a year out
		],
	};

	it("lays courses across real terms and subtracts what's done", () => {
		const result = suggestPlan(
			pathway,
			new Set(["CSC2330"]), // already done — should be subtracted
			{ season: "AUT", year: 2026 },
		);
		expect(result.alreadyDone).toEqual(["CSC2330"]);
		expect(result.placements).toEqual({
			"AUT-2026": ["TCOR3001"],
			"WIN-2027": ["CSC2431"],
			// termOffset 3 lands in the *next* academic year, not crammed into 2026-27.
			"AUT-2027": ["CSC4898"],
		});
	});

	it("places each course exactly once", () => {
		const dup: Pathway = {
			...pathway,
			steps: [
				{ termOffset: 0, courseIds: ["CSC2431"] },
				{ termOffset: 1, courseIds: ["CSC2431"] },
			],
		};
		const result = suggestPlan(dup, new Set(), { season: "AUT", year: 2026 });
		const placed = Object.values(result.placements).flat();
		expect(placed.filter((id) => id === "CSC2431")).toHaveLength(1);
	});
});

describe("buildPlanView", () => {
	const allDays = new Set<Section["days"][number]>(["M", "Tu", "W", "Th", "F"]);

	it("attaches a fitting section in the published year and degrades beyond it", () => {
		const sections = [
			makeSection({
				crn: "1",
				courseId: "CSC2430",
				season: "AUT",
				year: 2026,
				days: ["M", "W"],
			}),
		];
		const view = buildPlanView(
			// CSC2099 (no prereqs) sits a year out where no sections exist yet.
			{ "AUT-2026": ["CSC2430"], "AUT-2027": ["CSC2099"] },
			new Set(["CSC1260"]),
			allDays,
			{},
			sections,
		);
		const published = view.terms.find((t) => t.key === "AUT-2026");
		const future = view.terms.find((t) => t.key === "AUT-2027");
		expect(published?.schedulable).toBe(true);
		expect(published?.courses[0].section?.crn).toBe("1");
		// No sections exist for 2027 — the course still shows, just without a slot.
		expect(future?.schedulable).toBe(false);
		expect(future?.courses[0].section).toBeNull();
		expect(future?.courses[0].credits).toBeGreaterThan(0); // catalog credits
		expect(view.problems).toBe(0);
	});

	it("flags a time clash between two sections in the same term", () => {
		const sections = [
			makeSection({
				crn: "1",
				courseId: "CSC2430",
				season: "AUT",
				year: 2026,
				days: ["M"],
				startMin: 540,
				endMin: 600,
			}),
			makeSection({
				crn: "2",
				courseId: "MAT1234",
				season: "AUT",
				year: 2026,
				days: ["M"],
				startMin: 570,
				endMin: 630,
			}),
		];
		const view = buildPlanView(
			{ "AUT-2026": ["CSC2430", "MAT1234"] },
			new Set(),
			allDays,
			{},
			sections,
		);
		expect(view.terms[0].courses.every((c) => c.clash)).toBe(true);
		expect(view.problems).toBe(2);
	});

	it("honors a section override and offers the alternatives", () => {
		const sections = [
			makeSection({
				crn: "early",
				courseId: "CSC2430",
				season: "AUT",
				year: 2026,
				days: ["M"],
				startMin: 540,
				endMin: 600,
			}),
			makeSection({
				crn: "late",
				courseId: "CSC2430",
				season: "AUT",
				year: 2026,
				days: ["M"],
				startMin: 720,
				endMin: 780,
			}),
		];
		const view = buildPlanView(
			{ "AUT-2026": ["CSC2430"] },
			new Set(["CSC1260"]),
			allDays,
			{ CSC2430: "late" },
			sections,
		);
		const course = view.terms[0].courses[0];
		expect(course.section?.crn).toBe("late"); // override beats the earlier default
		expect(course.candidates).toHaveLength(2);
	});

	it("marks a published-year course with no day-fitting section", () => {
		const sections = [
			makeSection({
				crn: "1",
				courseId: "CSC2430",
				season: "AUT",
				year: 2026,
				days: ["Sa"], // she isn't free Saturday
			}),
		];
		const view = buildPlanView(
			{ "AUT-2026": ["CSC2430"] },
			new Set(["CSC1260"]),
			allDays,
			{},
			sections,
		);
		const course = view.terms[0].courses[0];
		expect(course.noFittingSection).toBe(true);
		expect(course.section).toBeNull();
	});
});
