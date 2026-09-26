import cppDeveloperJson from "#/data/projects/cpp-developer.json" with {
	type: "json",
};
import type { Concept, Project, Task } from "./types";

/**
 * Every learning project, in display order. To add one: run
 * `pnpm import-project <file.xlsx> <slug> "<Title>"` and add its JSON here.
 */
export const projects: Project[] = [cppDeveloperJson as Project];

export const DEFAULT_PROJECT = projects[0].slug;

export function getProject(slug: string): Project | undefined {
	return projects.find((p) => p.slug === slug);
}

export function conceptMap(project: Project): Map<string, Concept> {
	return new Map(project.concepts.map((c) => [c.id, c]));
}

/** Tasks that mention a concept, in plan order. */
export function tasksUsingConcept(project: Project, conceptId: string): Task[] {
	return project.tasks.filter((t) =>
		t.concepts.some((c) => c.conceptId === conceptId),
	);
}
