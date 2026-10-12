import { describe, expect, it } from "vitest";
import {
	conceptMap,
	getProject,
	projects,
	tasksUsingConcept,
} from "./projects";
import { validateProject } from "./validate";

describe("committed projects", () => {
	it.each(projects.map((p) => [p.slug, p] as const))("%s validates", (_, p) => {
		expect(() => validateProject(p)).not.toThrow();
	});

	it("has the lessons first, then the rest of the workbook plan", () => {
		const p = getProject("cpp-developer");
		if (!p) throw new Error("cpp-developer missing");
		expect(p.milestones).toHaveLength(13);
		expect(p.tasks).toHaveLength(65);
		expect(p.concepts).toHaveLength(75);
		expect(p.tasks.filter((t) => t.checkpoint)).toHaveLength(12);
		expect(p.templates.map((t) => t.name)).toEqual(["Stuck", "Pseudocode"]);
		expect(p.reflection.reviewSubjects).toContain("Capstone");
		// Every concept is used by at least one task.
		const concepts = conceptMap(p);
		for (const id of concepts.keys()) {
			expect(tasksUsingConcept(p, id).length, id).toBeGreaterThan(0);
		}
	});
});

describe("C++ lessons", () => {
	const p = getProject("cpp-developer");
	if (!p) throw new Error("cpp-developer missing");
	const lessons = p.tasks.filter((t) => t.lesson);

	it("come first and are numbered from 1", () => {
		expect(p.tasks.slice(0, 15).map((t) => t.id)).toEqual(
			Array.from({ length: 15 }, (_, i) => `l${i + 1}`),
		);
		expect(p.tasks.map((t) => t.number)).toEqual(p.tasks.map((_, i) => i + 1));
		expect(p.tasks[15]).toMatchObject({ id: "s11", milestoneId: "w3" });
		expect(p.milestones.map((m) => m.number)).toEqual(
			p.milestones.map((_, i) => i + 1),
		);
	});

	it.each(
		lessons.map((t) => [t.id, t] as const),
	)("%s brings in at most 2 new ideas", (_, t) => {
		expect(t.concepts.filter((c) => c.isNew).length).toBeLessThanOrEqual(2);
	});

	it("marks a concept new only where it first appears", () => {
		const seen = new Set<string>();
		for (const t of p.tasks) {
			for (const ref of t.concepts) {
				expect(ref.isNew, `${t.id} ${ref.conceptId}`).toBe(
					!seen.has(ref.conceptId),
				);
				seen.add(ref.conceptId);
			}
		}
	});
});

describe("validateProject", () => {
	it("requires an example and recall questions on lessons", () => {
		const p = structuredClone(projects[0]);
		const lesson = p.tasks[0].lesson;
		if (!lesson) throw new Error("l1 has no lesson");
		lesson.example = null;
		lesson.recall = [];
		expect(() => validateProject(p)).toThrow(
			/l1: lesson has no example[\s\S]*l1: lesson has no recall questions/,
		);
	});

	it("reports unknown concepts and duplicate ids", () => {
		const p = structuredClone(projects[0]);
		p.tasks[1].id = p.tasks[0].id;
		p.tasks[2].concepts.push({ conceptId: "nope", isNew: false });
		expect(() => validateProject(p)).toThrow(
			/duplicate task id "l1"[\s\S]*unknown concept "nope"/,
		);
	});
});
