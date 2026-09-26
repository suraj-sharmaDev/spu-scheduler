import { describe, expect, it } from "vitest";
import * as v from "./input";

describe("input validators", () => {
	it("rejects wrong types and out-of-range numbers", () => {
		expect(() => v.object(null)).toThrow();
		expect(() => v.object([])).toThrow();
		expect(() => v.string(5, "Notes", 10)).toThrow(/must be text/);
		expect(() => v.string("x".repeat(11), "Notes", 10)).toThrow(/too long/);
		expect(() => v.integer(2.5, "Minutes", 0, 10)).toThrow(/whole number/);
		expect(() => v.integer(11, "Minutes", 0, 10)).toThrow(/between/);
		expect(v.integer(10, "Minutes", 0, 10)).toBe(10);
		expect(() => v.oneOf("finished", "Status", ["done"] as const)).toThrow();
	});

	it("only accepts answers to known questions", () => {
		const qs = ["What was hard?"];
		expect(v.answers({ "What was hard?": "loops" }, qs, 100)).toEqual({
			"What was hard?": "loops",
		});
		expect(() => v.answers({ Other: "x" }, qs, 100)).toThrow(
			/Unknown question/,
		);
		expect(() => v.answers({ "What was hard?": 3 }, qs, 100)).toThrow();
	});
});
