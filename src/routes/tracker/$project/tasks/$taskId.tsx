import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TaskPanel } from "#/components/tracker/TaskPanel";
import { Card } from "#/components/tracker/ui";
import { getProject } from "#/lib/tracker/projects";
import { useTracker } from "#/lib/tracker/queries";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/tasks/$taskId")({
	beforeLoad: ({ params }) => {
		const project = getProject(params.project);
		if (!project?.tasks.some((t) => t.id === params.taskId)) throw notFound();
	},
	component: TaskPage,
});

function TaskPage() {
	const project = useProject();
	const { taskId } = Route.useParams();
	const state = useTracker(project.slug);
	const index = project.tasks.findIndex((t) => t.id === taskId);
	const task = project.tasks[index];
	const prev = project.tasks[index - 1];
	const next = project.tasks[index + 1];

	return (
		<div className="space-y-4">
			<nav className="flex items-center justify-between text-sm">
				<Link
					to="/tracker/$project"
					params={{ project: project.slug }}
					className="text-slate-500 hover:text-rose-600"
				>
					← Plan
				</Link>
				<div className="flex gap-2">
					{prev ? (
						<Link
							to="/tracker/$project/tasks/$taskId"
							params={{ project: project.slug, taskId: prev.id }}
							className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-rose-50"
						>
							<ArrowLeft className="h-4 w-4" /> #{prev.number}
						</Link>
					) : null}
					{next ? (
						<Link
							to="/tracker/$project/tasks/$taskId"
							params={{ project: project.slug, taskId: next.id }}
							className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-600 hover:bg-rose-50"
						>
							#{next.number} <ArrowRight className="h-4 w-4" />
						</Link>
					) : null}
				</div>
			</nav>
			<Card>
				<TaskPanel project={project} task={task} state={state} />
			</Card>
		</div>
	);
}
