import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Search } from "lucide-react";
import { useState } from "react";
import { ConceptCard } from "#/components/tracker/ui";
import { learnedConcepts } from "#/lib/tracker/progress";
import { tasksUsingConcept } from "#/lib/tracker/projects";
import { useTracker } from "#/lib/tracker/queries";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/concepts")({
	component: Concepts,
});

type Filter = "all" | "learned" | "ahead";

function Concepts() {
	const project = useProject();
	const state = useTracker(project.slug);
	const learned = learnedConcepts(project, state);
	const [query, setQuery] = useState("");
	const [type, setType] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>("all");

	const types = [...new Set(project.concepts.map((c) => c.type))];
	const q = query.trim().toLowerCase();
	const shown = project.concepts.filter(
		(c) =>
			(!type || c.type === type) &&
			(filter === "all" || (filter === "learned") === learned.has(c.id)) &&
			(!q || `${c.name} ${c.plain} ${c.example}`.toLowerCase().includes(q)),
	);

	const chip = (active: boolean) =>
		`rounded-full px-3 py-1 text-sm transition ${active ? "bg-rose-500 text-white" : "bg-white text-slate-600 ring-1 ring-rose-100 hover:bg-rose-50"}`;

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					Concepts
				</h1>
				<p className="mt-1 text-slate-600">
					{learned.size} of {project.concepts.length} learned. A concept counts
					as learned once the session that introduces it is done.
				</p>
			</div>

			<div className="space-y-3">
				<label className="flex items-center gap-2 rounded-xl bg-white px-3 ring-1 ring-rose-100 focus-within:ring-2 focus-within:ring-rose-300">
					<Search className="h-4 w-4 text-slate-400" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search concepts"
						className="w-full bg-transparent py-2.5 text-sm outline-none"
					/>
				</label>
				<div className="flex flex-wrap gap-2">
					{(["all", "learned", "ahead"] as const).map((f) => (
						<button
							key={f}
							type="button"
							className={chip(filter === f)}
							onClick={() => setFilter(f)}
						>
							{f === "all"
								? "All"
								: f === "learned"
									? "Learned"
									: "Still ahead"}
						</button>
					))}
					<span className="mx-1 w-px bg-rose-100" />
					<button
						type="button"
						className={chip(type === null)}
						onClick={() => setType(null)}
					>
						Every type
					</button>
					{types.map((t) => (
						<button
							key={t}
							type="button"
							className={chip(type === t)}
							onClick={() => setType(type === t ? null : t)}
						>
							{t}
						</button>
					))}
				</div>
			</div>

			{shown.length === 0 ? (
				<p className="py-8 text-center text-slate-500">No concepts match.</p>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{shown.map((concept) => {
						const tasks = tasksUsingConcept(project, concept.id);
						return (
							<div key={concept.id} className="relative">
								{learned.has(concept.id) ? (
									<CheckCircle2
										className="absolute top-3 right-3 z-10 h-5 w-5 text-emerald-500"
										aria-label="Learned"
									/>
								) : null}
								<ConceptCard
									concept={concept}
									footer={
										<p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
											Used in
											{tasks.map((t) => (
												<Link
													key={t.id}
													to="/tracker/$project/tasks/$taskId"
													params={{ project: project.slug, taskId: t.id }}
													className="rounded bg-white px-1.5 py-0.5 font-medium text-rose-600 ring-1 ring-rose-100 hover:bg-rose-100"
													title={t.title}
												>
													#{t.number}
												</Link>
											))}
										</p>
									}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
