import { describe, expect, it } from "vitest";
import {
	checklistProgress,
	learnedConcepts,
	milestoneRows,
	nextTask,
	type ProgressInput,
	subprojectDone,
	subprojects,
	totals,
} from "./progress";
import { getProject } from "./projects";

const project = getProject("cpp-developer");
if (!project) throw new Error("cpp-developer missing");

const input: ProgressInput = {
	progress: {
		s1: { status: "done", minutes: 40 },
		s2: { status: "done", minutes: 50 },
		s3: { status: "stuck", minutes: 30 },
		s6: { status: "done", minutes: 45 },
		s7: { status: "in_progress", minutes: null },
	},
	checkedItems: ["s3.do.0", "s3.do.1"],
};

describe("progress aggregates", () => {
	it("matches the Progress sheet formulas per week", () => {
		const [w1, w2, w3] = milestoneRows(project, input);
		expect(w1).toMatchObject({
			sessions: 5,
			done: 2,
			stuck: 1,
			pct: 0.4,
			minutes: 120,
		});
		expect(w2).toMatchObject({
			sessions: 5,
			done: 1,
			stuck: 0,
			pct: 0.2,
			minutes: 45,
		});
		expect(w3).toMatchObject({
			sessions: 5,
			done: 0,
			stuck: 0,
			pct: 0,
			minutes: 0,
		});
	});

	it("totals across the plan", () => {
		const t = totals(project, input);
		expect(t).toMatchObject({
			tasks: 60,
			done: 3,
			stuck: 1,
			minutes: 165,
			concepts: 75,
		});
		expect(t.pct).toBeCloseTo(3 / 60);
	});

	it("picks the first task that isn't done", () => {
		expect(nextTask(project, input)?.id).toBe("s3");
		expect(nextTask(project, { progress: {}, checkedItems: [] })?.id).toBe(
			"s1",
		);
	});

	it("learns a concept when its first task is done", () => {
		const learned = learnedConcepts(project, input);
		// s1 introduces these four.
		for (const id of ["requirements", "console-program", "loop", "condition"]) {
			expect(learned.has(id)).toBe(true);
		}
		// "vector" is introduced in s3, which is stuck.
		expect(learned.has("vector")).toBe(false);
	});

	it("counts required checklist items only", () => {
		const s1 = project.tasks[0];
		const p = checklistProgress(s1, new Set(["s1.do.0", "s1.do.5"]));
		// s1.do.5 is the stretch step: not in the total, not counted.
		expect(p).toEqual({ done: 1, total: 8 });
	});

	it("groups milestones into sub-projects", () => {
		expect(
			subprojects(project).map((s) => [s.name, s.milestones.length]),
		).toEqual([
			["Student Manager", 6],
			["Library", 2],
			["Expense Tracker", 1],
			["Mini Search Engine", 1],
			["Capstone", 2],
		]);
		expect(subprojectDone(project, input, "Student Manager")).toBe(false);
	});
});
