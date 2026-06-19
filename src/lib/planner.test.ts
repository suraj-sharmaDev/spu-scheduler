import { describe, expect, it } from "vitest";
import { requirements } from "./data";
import {
	creditsForQuarter,
	isEligible,
	offeredInSeason,
	offeringInfo,
	remainingRequirements,
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
import type { Course } from "./types";

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
