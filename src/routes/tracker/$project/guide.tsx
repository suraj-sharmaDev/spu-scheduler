import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Card } from "#/components/tracker/ui";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/guide")({
	component: Guide,
});

function Guide() {
	const project = useProject();

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					How this works
				</h1>
				<p className="mt-1 text-slate-600">{project.title}</p>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				{project.about.map((item) => (
					<div
						key={item.label}
						className="rounded-2xl bg-gradient-to-br from-rose-100 to-amber-50 p-5"
					>
						<h2 className="text-xs font-semibold uppercase tracking-wide text-rose-700">
							{item.label}
						</h2>
						<p className="mt-2 text-slate-800">{item.text}</p>
					</div>
				))}
			</div>

			{project.guide.map((section) => (
				<Card key={section.title} title={section.title}>
					<dl className="divide-y divide-rose-50">
						{section.items.map((item) => (
							<div
								key={item.label}
								className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4"
							>
								<dt className="font-medium text-slate-800">{item.label}</dt>
								<dd className="whitespace-pre-line text-slate-600">
									{item.text}
								</dd>
							</div>
						))}
					</dl>
				</Card>
			))}

			{project.templates.length > 0 ? (
				<Card
					title="Templates"
					subtitle="Add these to a task's notes with one tap on the task page."
				>
					<div className="grid gap-3 md:grid-cols-2">
						{project.templates.map((t) => (
							<div key={t.name}>
								<h3 className="mb-1 font-medium text-slate-800">{t.name}</h3>
								<pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
									{t.body}
								</pre>
							</div>
						))}
					</div>
				</Card>
			) : null}

			<Card title="Resources">
				<ul className="divide-y divide-rose-50">
					{project.resources.map((r) => (
						<li key={r.name} className="py-2.5">
							{r.link ? (
								<a
									href={r.link}
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1 font-medium text-rose-600 hover:underline"
								>
									{r.name} <ExternalLink className="h-3.5 w-3.5" />
								</a>
							) : (
								<span className="font-medium text-slate-800">{r.name}</span>
							)}
							<p className="text-sm text-slate-600">{r.use}</p>
						</li>
					))}
				</ul>
				{project.searchTips.length > 0 ? (
					<div className="mt-4 rounded-xl bg-rose-50/70 p-4">
						<h3 className="font-medium text-slate-800">How to search well</h3>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
							{project.searchTips.map((tip) => (
								<li key={tip}>{tip}</li>
							))}
						</ul>
					</div>
				) : null}
			</Card>
		</div>
	);
}
