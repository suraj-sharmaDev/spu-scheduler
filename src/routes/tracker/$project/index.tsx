import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, Circle, CircleDot } from "lucide-react";
import { milestoneRows, nextTask, statusOf } from "#/lib/tracker/progress";
import { useTracker } from "#/lib/tracker/queries";
import type { TaskStatus } from "#/lib/tracker/status";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/")({ component: Plan });

function StatusDot({
	status,
	current,
}: {
	status: TaskStatus;
	current: boolean;
}) {
	if (status === "done") {
		return (
			<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
				<Check className="h-3.5 w-3.5" />
			</span>
		);
	}
	if (current || status === "in_progress" || status === "stuck") {
		return <CircleDot className="h-6 w-6 shrink-0 text-rose-500" />;
	}
	return <Circle className="h-6 w-6 shrink-0 text-slate-300" />;
}

/**
 * The week she's on is open; every other week is one line. No stars, badges
 * or meters per row: the status dot and the title are enough to decide what
 * to tap.
 */
function Plan() {
	const project = useProject();
	const state = useTracker(project.slug);
	const current = nextTask(project, state);
	const rows = milestoneRows(project, state);

	return (
		<div className="mx-auto max-w-xl space-y-6">
			<h1 className="font-display text-3xl font-semibold">{project.title}</h1>

			<ol className="divide-y divide-slate-100">
				{rows.map(({ milestone, done, sessions }) => {
					const tasks = project.tasks.filter(
						(t) => t.milestoneId === milestone.id,
					);
					const isCurrent = current?.milestoneId === milestone.id;
					const complete = done === sessions;
					return (
						<li key={milestone.id}>
							<details open={isCurrent} className="group">
								<summary className="flex cursor-pointer list-none items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
									<span
										className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${complete ? "bg-emerald-500 text-white" : isCurrent ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"}`}
									>
										{complete ? (
											<Check className="h-4 w-4" />
										) : (
											milestone.number
										)}
									</span>
									<span className="min-w-0 flex-1">
										<span
											className={`block font-medium ${isCurrent ? "text-slate-900" : "text-slate-700"}`}
										>
											{milestone.bigQuestion}
										</span>
										<span className="block text-sm text-slate-500">
											Week {milestone.number} · {milestone.subproject}
											{done > 0 && !complete
												? ` · ${done} of ${sessions} done`
												: ""}
										</span>
									</span>
									<ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
								</summary>

								<ul className="mb-4 ml-13 divide-y divide-slate-100 rounded-2xl border border-slate-200">
									{tasks.map((task) => {
										const status = statusOf(state, task.id);
										const isNext = current?.id === task.id;
										return (
											<li key={task.id}>
												<Link
													to="/tracker/$project/tasks/$taskId"
													params={{ project: project.slug, taskId: task.id }}
													className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
												>
													<StatusDot status={status} current={isNext} />
													<span
														className={`min-w-0 flex-1 truncate ${status === "done" ? "text-slate-500" : "text-slate-900"} ${isNext ? "font-semibold" : ""}`}
													>
														{task.title}
													</span>
													{status === "stuck" ? (
														<span className="text-xs font-medium text-amber-700">
															Stuck
														</span>
													) : isNext ? (
														<span className="text-xs font-medium text-rose-600">
															Up next
														</span>
													) : null}
												</Link>
											</li>
										);
									})}
								</ul>
							</details>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
