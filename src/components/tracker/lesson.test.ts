import { describe, expect, it } from "vitest";
import { getProject } from "#/lib/tracker/projects";
import { firstWrongLine, shuffled } from "./lesson";

describe("shuffled", () => {
	it("is a stable permutation that never starts solved", () => {
		for (const n of [2, 3, 5, 8]) {
			const a = shuffled(n, "l1");
			expect([...a].sort((x, y) => x - y)).toEqual(
				Array.from({ length: n }, (_, i) => i),
			);
			expect(shuffled(n, "l1")).toEqual(a);
			expect(a.every((v, i) => v === i)).toBe(false);
		}
	});
});

describe("firstWrongLine", () => {
	const lines = ["a {", "x", "}", "b {", "y", "}"];

	it("accepts identical lines in either place", () => {
		expect(firstWrongLine(lines, [0, 1, 5, 3, 4, 2])).toBe(-1);
	});

	it("points at the first misplaced line", () => {
		expect(firstWrongLine(lines, [0, 2, 1])).toBe(1);
	});

	it("every lesson puzzle starts unsolved", () => {
		const project = getProject("cpp-developer");
		for (const t of project?.tasks ?? []) {
			const order = t.lesson?.order;
			if (!order) continue;
			const start = shuffled(order.lines.length, t.id);
			expect(firstWrongLine(order.lines, start), t.id).not.toBe(-1);
		}
	});
});
