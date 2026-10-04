import { describe, expect, it } from "vitest";
import { CV, formatGpa, phoneHref } from "./cv";

function allStrings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value)) return value.flatMap(allStrings);
	if (value && typeof value === "object")
		return Object.values(value).flatMap(allStrings);
	return [];
}

describe("CV content", () => {
	it("has no empty strings or leftover placeholders", () => {
		for (const s of allStrings(CV)) {
			expect(s.trim(), "empty string").not.toBe("");
			expect(s).not.toMatch(/TODO|TBD|\[.*\]|lorem/i);
		}
	});

	it("fills every required section", () => {
		expect(CV.education.length).toBeGreaterThan(0);
		expect(CV.skills.length).toBeGreaterThan(0);
		expect(CV.leadership.length).toBeGreaterThan(0);
		expect(CV.honors.length).toBeGreaterThan(0);
		for (const job of CV.leadership)
			expect(job.bullets.length).toBeGreaterThan(0);
		for (const group of CV.skills)
			expect(group.items.length).toBeGreaterThan(0);
	});

	it("uses valid contact details", () => {
		expect(CV.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
		expect(phoneHref(CV.phone)).toMatch(/^tel:\+1\d{10}$/);
		for (const link of CV.links) expect(link.href).toMatch(/^https:\/\//);
	});

	it("keeps GPAs on a 4.0 scale", () => {
		for (const e of CV.education) {
			if (e.gpa === undefined) continue;
			expect(e.gpa).toBeGreaterThan(0);
			expect(e.gpa).toBeLessThanOrEqual(4);
		}
	});
});

describe("formatGpa", () => {
	it("pads to two decimals", () => {
		expect(formatGpa(4)).toBe("4.00/4.00");
		expect(formatGpa(3.96)).toBe("3.96/4.00");
	});
});
