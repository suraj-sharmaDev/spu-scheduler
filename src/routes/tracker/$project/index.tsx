import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Flag } from "lucide-react";
import { LevelStars, Meter, StatusPill } from "#/components/tracker/ui";
import {
	checklistProgress,
	milestoneRows,
	nextTask,
	statusOf,
} from "#/lib/tracker/progress";
import { useTracker } from "#/lib/tracker/queries";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/")({ component: Plan });

function Plan() {
	const project = useProject();
	const state = useTracker(project.slug);
	const checked = new Set(state.checkedItems);
	const current = nextTask(project, state);
	const rows = milestoneRows(project, state);

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					{project.title}
				</h1>
				{project.roadmapNote ? (
					<p className="mt-1 text-slate-600">{project.roadmapNote}</p>
				) : null}
			</div>

			{rows.map(({ milestone, done, sessions }) => {
				const tasks = project.tasks.filter(
					(t) => t.milestoneId === milestone.id,
				);
				const isCurrent = current?.milestoneId === milestone.id;
				return (
					<details
						key={milestone.id}
						open={isCurrent}
						className="group rounded-2xl bg-white shadow-sm ring-1 ring-rose-100 open:ring-rose-200"
					>
						<summary className="flex cursor-pointer list-none items-start gap-4 p-5 [&::-webkit-details-marker]:hidden">
							<div
								className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-semibold ${done === sessions ? "bg-emerald-500 text-white" : isCurrent ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-700"}`}
							>
								{milestone.number}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
									<span className="font-medium text-slate-700">
										{milestone.subproject}
									</span>
									<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
										{milestone.guidance}
									</span>
									{isCurrent ? (
										<span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
											You're here
										</span>
									) : null}
								</div>
								<h2 className="mt-0.5 font-semibold text-slate-900">
									{milestone.bigQuestion}
								</h2>
								<div className="mt-2 flex items-center gap-3">
									<Meter value={done / sessions} className="max-w-48" />
									<span className="text-xs text-slate-500">
										{done}/{sessions} done
									</span>
								</div>
							</div>
							<ChevronDown className="mt-2 h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
						</summary>

						<div className="border-t border-rose-100 px-5 pb-4 pt-3">
							<p className="mb-3 text-sm text-slate-600">
								<span className="font-medium text-slate-700">By the end: </span>
								{milestone.outcome}
							</p>
							<ul className="divide-y divide-rose-50">
								{tasks.map((task) => {
									const status = statusOf(state, task.id);
									const cl = checklistProgress(task, checked);
									return (
										<li key={task.id}>
											<Link
												to="/tracker/$project/tasks/$taskId"
												params={{ project: project.slug, taskId: task.id }}
												className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-rose-50 ${task.checkpoint ? "bg-amber-50/60" : ""}`}
											>
												<span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-400">
													#{task.number}
												</span>
												<span className="min-w-0 flex-1">
													<span className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
														{task.checkpoint ? (
															<Flag className="h-3.5 w-3.5 shrink-0 text-amber-600" />
														) : null}
														<span className="truncate">{task.title}</span>
													</span>
													<span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
														<LevelStars level={task.level} />
														{cl.done > 0
															? `${cl.done}/${cl.total} ticked`
															: null}
													</span>
												</span>
												<StatusPill status={status} />
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					</details>
				);
			})}
		</div>
	);
}
