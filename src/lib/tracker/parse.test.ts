import { describe, expect, it } from "vitest";
import {
	orNull,
	parseConceptCell,
	parseLevel,
	slugify,
	splitChecklist,
	splitWhatToDo,
} from "./parse";

describe("splitWhatToDo", () => {
	it("splits numbered steps and flags the stretch line", () => {
		const cell =
			"1. Create requirements.txt.\n2. Write input and output.\n\n⭐ Stretch: draw the menu first.";
		const { intro, steps } = splitWhatToDo(cell, "s1.do");
		expect(intro).toEqual([]);
		expect(steps).toEqual([
			{ id: "s1.do.0", text: "Create requirements.txt.", stretch: false },
			{ id: "s1.do.1", text: "Write input and output.", stretch: false },
			{ id: "s1.do.2", text: "draw the menu first.", stretch: true },
		]);
	});

	it("keeps unnumbered lines before the first step as intro", () => {
		const cell = "PSEUDOCODE FIRST.\n1. Add a menu option.\n2. Print it.";
		const { intro, steps } = splitWhatToDo(cell, "s6.do");
		expect(intro).toEqual(["PSEUDOCODE FIRST."]);
		expect(steps.map((s) => s.text)).toEqual([
			"Add a menu option.",
			"Print it.",
		]);
	});

	it("folds continuation lines into the previous step", () => {
		const cell =
			"1. Organize folders:\n  models/ (Student)   services/\n2. Build.";
		const { steps } = splitWhatToDo(cell, "s23.do");
		expect(steps[0].text).toBe(
			"Organize folders:\nmodels/ (Student)   services/",
		);
		expect(steps).toHaveLength(2);
	});

	it("treats every line as a step when nothing is numbered", () => {
		const cell =
			"Save all students.\nPlan your steps first.\n\n⭐ Stretch: use a temp file.";
		const { intro, steps } = splitWhatToDo(cell, "s17.do");
		expect(intro).toEqual([]);
		expect(steps.map((s) => [s.text, s.stretch])).toEqual([
			["Save all students.", false],
			["Plan your steps first.", false],
			["use a temp file.", true],
		]);
	});
});

describe("cell helpers", () => {
	it("parses concept cells with the new marker", () => {
		expect(parseConceptCell("🆕 Loop\nReference vs copy\n")).toEqual([
			{ name: "Loop", isNew: true },
			{ name: "Reference vs copy", isNew: false },
		]);
		expect(parseConceptCell("-")).toEqual([]);
	});

	it("counts filled stars and rejects bad levels", () => {
		expect(parseLevel("★☆☆☆")).toBe(1);
		expect(parseLevel("★★★★")).toBe(4);
		expect(() => parseLevel("☆☆☆☆")).toThrow();
	});

	it("builds stable ids and checklists", () => {
		expect(slugify("Variable & type")).toBe("variable-type");
		expect(slugify("std::string")).toBe("std-string");
		expect(splitChecklist("A.\n\nB.", "s1.done").map((i) => i.id)).toEqual([
			"s1.done.0",
			"s1.done.1",
		]);
		expect(orNull(" - ")).toBeNull();
	});
});
