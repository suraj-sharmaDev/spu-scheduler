import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Lock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Card, ErrorNote } from "#/components/tracker/ui";
import type { TrackerState } from "#/lib/tracker/api";
import { nextTask, subprojectDone, subprojects } from "#/lib/tracker/progress";
import {
	useSaveReflection,
	useSaveReview,
	useTracker,
} from "#/lib/tracker/queries";
import type { Project } from "#/lib/tracker/types";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/reflect")({
	component: ReflectPage,
});

function ReflectPage() {
	const project = useProject();
	const state = useTracker(project.slug);
	const current = nextTask(project, state);
	const currentWeek =
		project.milestones.find((m) => m.id === current?.milestoneId)?.number ??
		project.milestones.length;
	const [week, setWeek] = useState(currentWeek);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					Reflect
				</h1>
				<p className="mt-1 text-slate-600">
					Five minutes at the end of each week, and a longer look back after
					each project.
				</p>
			</div>

			<Card title="Weekly reflection">
				<div className="mb-5 flex flex-wrap gap-1.5">
					{project.milestones.map((m) => {
						const saved = state.reflections[m.number];
						return (
							<button
								key={m.id}
								type="button"
								onClick={() => setWeek(m.number)}
								aria-pressed={week === m.number}
								className={`relative h-9 w-9 rounded-full text-sm font-medium transition ${week === m.number ? "bg-rose-500 text-white" : saved ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-white text-slate-600 ring-1 ring-rose-100 hover:bg-rose-50"}`}
								title={`Week ${m.number}${saved ? " · filled in" : ""}`}
							>
								{m.number}
							</button>
						);
					})}
				</div>
				<WeeklyForm key={week} project={project} state={state} week={week} />
			</Card>

			<Card
				title="Project reviews"
				subtitle="Unlocks when every session of that project is done."
			>
				<div className="space-y-3">
					{subprojects(project).map(({ name }) => (
						<ReviewForm
							key={name}
							project={project}
							state={state}
							subject={name}
						/>
					))}
				</div>
			</Card>
		</div>
	);
}

function WeeklyForm({
	project,
	state,
	week,
}: {
	project: Project;
	state: TrackerState;
	week: number;
}) {
	const readOnly = state.role !== "learner";
	const milestone = project.milestones.find((m) => m.number === week);
	const saved = state.reflections[week];
	const [answers, setAnswers] = useState<Record<string, string>>(
		saved?.answers ?? {},
	);
	const [confidence, setConfidence] = useState<number | null>(
		saved?.confidence ?? null,
	);
	const [justSaved, setJustSaved] = useState(false);
	const save = useSaveReflection(project.slug);

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		save.mutate(
			{ week, answers, confidence },
			{ onSuccess: () => setJustSaved(true) },
		);
	}

	return (
		<form onSubmit={onSubmit} className="space-y-4">
			<p className="text-sm text-slate-500">
				Week {week} · {milestone?.subproject} · {milestone?.bigQuestion}
			</p>
			{project.reflection.weeklyQuestions.map((q) => (
				<label key={q} className="block">
					<span className="text-sm font-medium text-slate-800">{q}</span>
					<textarea
						value={answers[q] ?? ""}
						readOnly={readOnly}
						onChange={(e) => {
							setJustSaved(false);
							setAnswers((prev) => ({ ...prev, [q]: e.target.value }));
						}}
						maxLength={5000}
						rows={2}
						className="mt-1 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
					/>
				</label>
			))}
			<fieldset>
				<legend className="text-sm font-medium text-slate-800">
					How confident do you feel? (1–5)
				</legend>
				<div className="mt-2 flex gap-2">
					{[1, 2, 3, 4, 5].map((n) => (
						<button
							key={n}
							type="button"
							disabled={readOnly}
							aria-pressed={confidence === n}
							onClick={() => {
								setJustSaved(false);
								setConfidence(confidence === n ? null : n);
							}}
							className={`h-10 w-10 rounded-full text-sm font-semibold transition disabled:cursor-not-allowed ${confidence === n ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"}`}
						>
							{n}
						</button>
					))}
				</div>
			</fieldset>
			{!readOnly ? (
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={save.isPending}
						className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
					>
						{save.isPending ? "Saving…" : "Save reflection"}
					</button>
					{justSaved ? (
						<span className="inline-flex items-center gap-1 text-sm text-emerald-700">
							<CheckCircle2 className="h-4 w-4" /> Saved
						</span>
					) : null}
				</div>
			) : null}
			<ErrorNote error={save.error} />
		</form>
	);
}

function ReviewForm({
	project,
	state,
	subject,
}: {
	project: Project;
	state: TrackerState;
	subject: string;
}) {
	const readOnly = state.role !== "learner";
	const saved = state.reviews[subject];
	const unlocked =
		saved !== undefined || subprojectDone(project, state, subject);
	const [answers, setAnswers] = useState<Record<string, string>>(
		saved?.answers ?? {},
	);
	const [justSaved, setJustSaved] = useState(false);
	const save = useSaveReview(project.slug);

	if (!unlocked) {
		return (
			<div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
				<Lock className="h-4 w-4" /> {subject}
			</div>
		);
	}

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		save.mutate({ subject, answers }, { onSuccess: () => setJustSaved(true) });
	}

	return (
		<details className="rounded-xl ring-1 ring-rose-100" open={!saved}>
			<summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium text-slate-800">
				{saved ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : null}
				{subject}
			</summary>
			<form onSubmit={onSubmit} className="space-y-4 px-4 pb-4">
				{project.reflection.reviewQuestions.map((q) => (
					<label key={q} className="block">
						<span className="text-sm font-medium text-slate-800">{q}</span>
						<textarea
							value={answers[q] ?? ""}
							readOnly={readOnly}
							onChange={(e) => {
								setJustSaved(false);
								setAnswers((prev) => ({ ...prev, [q]: e.target.value }));
							}}
							maxLength={5000}
							rows={2}
							className="mt-1 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
						/>
					</label>
				))}
				{!readOnly ? (
					<div className="flex items-center gap-3">
						<button
							type="submit"
							disabled={save.isPending}
							className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-60"
						>
							{save.isPending ? "Saving…" : "Save review"}
						</button>
						{justSaved ? (
							<span className="inline-flex items-center gap-1 text-sm text-emerald-700">
								<CheckCircle2 className="h-4 w-4" /> Saved
							</span>
						) : null}
					</div>
				) : null}
				<ErrorNote error={save.error} />
			</form>
		</details>
	);
}
