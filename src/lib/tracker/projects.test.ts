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

	it("imports the whole C++ plan", () => {
		const p = getProject("cpp-developer");
		if (!p) throw new Error("cpp-developer missing");
		expect(p.milestones).toHaveLength(12);
		expect(p.tasks).toHaveLength(60);
		expect(p.concepts).toHaveLength(75);
		expect(p.tasks.filter((t) => t.checkpoint)).toHaveLength(11);
		expect(p.templates.map((t) => t.name)).toEqual(["Stuck", "Pseudocode"]);
		expect(p.reflection.reviewSubjects).toContain("Capstone");
		// Every concept is used by at least one task.
		const concepts = conceptMap(p);
		for (const id of concepts.keys()) {
			expect(tasksUsingConcept(p, id).length, id).toBeGreaterThan(0);
		}
	});
});

describe("validateProject", () => {
	it("reports unknown concepts and duplicate ids", () => {
		const p = structuredClone(projects[0]);
		p.tasks[1].id = p.tasks[0].id;
		p.tasks[2].concepts.push({ conceptId: "nope", isNew: false });
		expect(() => validateProject(p)).toThrow(
			/duplicate task id "s1"[\s\S]*unknown concept "nope"/,
		);
	});
});
