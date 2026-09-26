import type { Project } from "./types";

/**
 * Structural checks on imported content. Throws listing every problem so the
 * importer can refuse to write a broken file.
 */
export function validateProject(project: Project): void {
	const errors: string[] = [];
	const seen = new Set<string>();
	const unique = (id: string, what: string) => {
		if (seen.has(id)) errors.push(`duplicate ${what} id "${id}"`);
		seen.add(id);
	};

	if (!project.slug || !/^[a-z0-9-]+$/.test(project.slug)) {
		errors.push(`invalid slug "${project.slug}"`);
	}
	if (project.tasks.length === 0) errors.push("no tasks");
	if (project.milestones.length === 0) errors.push("no milestones");

	const conceptIds = new Set(project.concepts.map((c) => c.id));
	for (const c of project.concepts) unique(c.id, "concept");

	const milestoneIds = new Set<string>();
	for (const m of project.milestones) {
		unique(m.id, "milestone");
		milestoneIds.add(m.id);
	}

	for (const t of project.tasks) {
		unique(t.id, "task");
		if (!milestoneIds.has(t.milestoneId)) {
			errors.push(`${t.id}: unknown milestone "${t.milestoneId}"`);
		}
		if (!t.title) errors.push(`${t.id}: missing title`);
		if (t.steps.length === 0) errors.push(`${t.id}: no steps`);
		if (t.doneWhen.length === 0) errors.push(`${t.id}: no "done when" items`);
		for (const item of [...t.steps, ...t.doneWhen])
			unique(item.id, "checklist");
		for (const ref of t.concepts) {
			if (!conceptIds.has(ref.conceptId)) {
				errors.push(`${t.id}: unknown concept "${ref.conceptId}"`);
			}
		}
	}

	for (const m of project.milestones) {
		if (!project.tasks.some((t) => t.milestoneId === m.id)) {
			errors.push(`${m.id}: milestone has no tasks`);
		}
	}

	if (errors.length > 0) {
		throw new Error(
			`Invalid project "${project.slug}":\n  - ${errors.join("\n  - ")}`,
		);
	}
}
