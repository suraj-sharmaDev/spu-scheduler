import { useParams } from "@tanstack/react-router";
import { getProject } from "./projects";
import type { Project } from "./types";

/** The project for the current /tracker/$project/* route (validated by its loader). */
export function useProject(): Project {
	const { project: slug } = useParams({ from: "/tracker/$project" });
	const project = getProject(slug);
	if (!project) throw new Error(`Unknown project "${slug}"`);
	return project;
}
