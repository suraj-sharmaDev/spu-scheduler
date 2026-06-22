import { describe, expect, it } from "vitest";
import { requirements } from "./data";
import {
	checkPlan,
	creditsForQuarter,
	isEligible,
	offeredInSeason,
	offeringInfo,
	remainingRequirements,
	sectionsToPlan,
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
import type { Course, Section } from "./types";

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
		prereqs: ["CSC1230"],
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
		const result = checkPlan(sections, new Set());
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
