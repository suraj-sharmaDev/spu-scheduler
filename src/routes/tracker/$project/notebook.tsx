import { createFileRoute, Link } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import { ExampleButton } from "#/components/tracker/lesson";
import { ConceptChips } from "#/components/tracker/ui";
import { conceptMap } from "#/lib/tracker/projects";
import { useTracker } from "#/lib/tracker/queries";
import { TZ } from "#/lib/tracker/schedule";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/notebook")({
	head: () => ({ meta: [{ title: "My notebook · Learning Tracker" }] }),
	component: Notebook,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	timeZone: TZ,
});

/** Her own one-sentence summaries, newest first: something to look back on. */
function Notebook() {
	const project = useProject();
	const state = useTracker(project.slug);
	const concepts = conceptMap(project);
	const tasks = new Map(project.tasks.map((t) => [t.id, t]));

	return (
		<div className="mx-auto max-w-2xl space-y-8">
			<div>
				<h1 className="font-display text-3xl font-semibold text-slate-900">
					My notebook
				</h1>
				<p className="mt-1 text-slate-600">
					What you learned, in your own words. Newest first.
				</p>
				<Link
					to="/tracker/$project/concepts"
					params={{ project: project.slug }}
					className="mt-2 inline-block text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
				>
					All the concepts, explained plainly
				</Link>
			</div>

			{state.history.length === 0 ? (
				<div className="rounded-3xl bg-white px-6 py-12 text-center border border-slate-200">
					<NotebookPen className="mx-auto h-10 w-10 text-rose-300" />
					<p className="mt-4 text-lg text-slate-700">
						Your notebook fills up as you finish sessions.
					</p>
					<Link
						to="/tracker"
						className="mt-6 inline-block rounded-xl bg-rose-500 px-5 py-3 font-semibold text-white hover:bg-rose-600"
					>
						Go to today
					</Link>
				</div>
			) : (
				<ol className="space-y-5">
					{state.history.map((entry) => {
						const task = tasks.get(entry.taskId);
						if (!task) return null;
						const fresh = task.concepts.filter((c) => c.isNew);
						return (
							<li
								key={entry.id}
								className="space-y-4 rounded-3xl bg-white p-6 border border-slate-200"
							>
								<p className="text-sm text-slate-500">
									{dateFormatter.format(new Date(entry.endedAt))} · #
									{task.number}{" "}
									<Link
										to="/tracker/$project/tasks/$taskId"
										params={{ project: project.slug, taskId: task.id }}
										className="font-medium text-slate-700 hover:text-rose-600"
									>
										{task.title}
									</Link>
								</p>
								{entry.takeaway ? (
									<p className="font-display text-xl leading-snug text-slate-900">
										“{entry.takeaway}”
									</p>
								) : (
									<p className="text-slate-400 italic">No sentence written.</p>
								)}
								{fresh.length > 0 || task.lesson?.example ? (
									<div className="flex flex-wrap items-start gap-3">
										{task.lesson?.example ? (
											<ExampleButton example={task.lesson.example} />
										) : null}
										<div className="min-w-0 flex-1">
											<ConceptChips refs={fresh} concepts={concepts} />
										</div>
									</div>
								) : null}
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
