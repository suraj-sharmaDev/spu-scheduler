import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { getProject } from "#/lib/tracker/projects";
import { trackerQuery } from "#/lib/tracker/queries";

export const Route = createFileRoute("/tracker/$project")({
	loader: async ({ params, context }) => {
		const project = getProject(params.project);
		if (!project) throw notFound();
		await context.queryClient.ensureQueryData(trackerQuery(project.slug));
		return { title: project.title };
	},
	component: Outlet,
});
