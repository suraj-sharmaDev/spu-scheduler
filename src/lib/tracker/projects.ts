import cppDeveloperJson from "#/data/projects/cpp-developer.json" with {
	type: "json",
};
import { cppLessons } from "#/data/projects/cpp-developer.lessons";
import { applyLessons } from "./lessons";
import type { Concept, Project, Task } from "./types";

/**
 * Every learning project, in display order. To add one: run
 * `pnpm import-project <file.xlsx> <slug> "<Title>"` and add its JSON here.
 * Rewritten lessons (see lessons.ts) replace the weeks they cover.
 */
export const projects: Project[] = [
	applyLessons(cppDeveloperJson as Project, cppLessons),
];

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
