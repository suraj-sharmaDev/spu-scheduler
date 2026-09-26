import { Link } from "@tanstack/react-router";
import { ArrowRight, Flag, LifeBuoy } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import type { TrackerState } from "#/lib/tracker/api";
import { checklistProgress, learnedConcepts } from "#/lib/tracker/progress";
import { conceptMap } from "#/lib/tracker/projects";
import { useToggleChecklist, useUpdateTask } from "#/lib/tracker/queries";
import { TASK_STATUSES } from "#/lib/tracker/status";
import type { Project, Task } from "#/lib/tracker/types";
import {
	Checklist,
	ConceptChips,
	ErrorNote,
	LevelStars,
	Meter,
	STATUS_META,
	StatusPill,
} from "./ui";

const QUICK_MINUTES = [30, 45, 60];

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700/70">
				{title}
			</h3>
			{children}
		</div>
	);
}

export function TaskPanel({
	project,
	task,
	state,
	compact = false,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	compact?: boolean;
}) {
	const readOnly = state.role !== "learner";
	const milestone = project.milestones.find((m) => m.id === task.milestoneId);
	const saved = state.progress[task.id];
	const status = saved?.status ?? "not_started";
	const checked = new Set(state.checkedItems);
	const concepts = conceptMap(project);
	const learned = learnedConcepts(project, state);
	const { done, total } = checklistProgress(task, checked);

	const update = useUpdateTask(project.slug);
	const toggle = useToggleChecklist(project.slug);
	const onToggle = (itemId: string, value: boolean) =>
		toggle.mutate({ itemId, checked: value });

	return (
		<div className="space-y-6">
			<header>
				<p className="text-sm text-slate-500">
					Week {milestone?.number} · Session {task.sessionInMilestone} ·{" "}
					{milestone?.subproject} · #{task.number}
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
					<h2 className="font-display text-2xl font-semibold text-slate-900">
						{task.title}
					</h2>
					<StatusPill status={status} />
					{task.checkpoint ? (
						<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
							<Flag className="h-3 w-3" /> Checkpoint
						</span>
					) : null}
				</div>
				<div className="mt-2 flex items-center gap-3 text-sm text-slate-500">
					<LevelStars level={task.level} />
					<span>
						{done}/{total} ticked
					</span>
					<Meter value={total ? done / total : 0} className="max-w-40" />
				</div>
			</header>

			{task.intro.length > 0 ? (
				<p className="whitespace-pre-line rounded-xl bg-amber-50/70 px-4 py-3 text-sm text-slate-700">
					{task.intro.join("\n")}
				</p>
			) : null}

			<Section title="What to do">
				<Checklist
					items={task.steps}
					checked={checked}
					onToggle={onToggle}
					readOnly={readOnly}
				/>
			</Section>

			{task.concepts.length > 0 ? (
				<Section title="Concepts today">
					<ConceptChips
						refs={task.concepts}
						concepts={concepts}
						learned={learned}
					/>
				</Section>
			) : null}

			{!compact && task.thinkAbout.length > 0 ? (
				<Section title="Think about / look up">
					<ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
						{task.thinkAbout.map((q) => (
							<li key={q}>{q}</li>
						))}
					</ul>
				</Section>
			) : null}

			<Section title="Done when…">
				<Checklist
					items={task.doneWhen}
					checked={checked}
					onToggle={onToggle}
					readOnly={readOnly}
				/>
			</Section>
			<ErrorNote error={toggle.error} />

			<Section title="Status">
				<div className="flex flex-wrap gap-2">
					{TASK_STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							disabled={readOnly}
							aria-pressed={status === s}
							onClick={() => update.mutate({ taskId: task.id, status: s })}
							className={`rounded-full px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${status === s ? STATUS_META[s].button : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
						>
							{STATUS_META[s].label}
						</button>
					))}
				</div>
				{status === "stuck" ? (
					<p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
						<LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
						Stuck for 15+ minutes? Fill in the Stuck template in Notes, then ask
						for help. That's part of the work, not a failure.
					</p>
				) : null}
				{status !== "done" && total > 0 && done === total ? (
					<p className="mt-3 text-sm text-emerald-700">
						Everything is ticked — mark it Done when you're happy with it.
					</p>
				) : null}
			</Section>

			<MinutesField
				key={`${task.id}-${saved?.minutes ?? ""}`}
				value={saved?.minutes ?? null}
				readOnly={readOnly}
				onSave={(minutes) => update.mutate({ taskId: task.id, minutes })}
			/>

			{compact ? (
				<Link
					to="/tracker/$project/tasks/$taskId"
					params={{ project: project.slug, taskId: task.id }}
					className="inline-flex items-center gap-1 font-medium text-rose-600 hover:text-rose-700"
				>
					Open full task, notes and questions <ArrowRight className="h-4 w-4" />
				</Link>
			) : (
				<NotesField
					key={task.id}
					initial={saved?.notes ?? ""}
					templates={project.templates}
					readOnly={readOnly}
					saving={update.isPending}
					onSave={(notes) => update.mutate({ taskId: task.id, notes })}
				/>
			)}
			<ErrorNote error={update.error} />
		</div>
	);
}

function MinutesField({
	value,
	readOnly,
	onSave,
}: {
	value: number | null;
	readOnly: boolean;
	onSave: (minutes: number | null) => void;
}) {
	const [text, setText] = useState(value === null ? "" : String(value));
	const commit = (raw: string) => {
		const trimmed = raw.trim();
		const minutes = trimmed === "" ? null : Number(trimmed);
		if (
			minutes !== null &&
			(!Number.isInteger(minutes) || minutes < 0 || minutes > 1440)
		) {
			setText(value === null ? "" : String(value));
			return;
		}
		if (minutes !== value) onSave(minutes);
	};
	return (
		<Section title="Minutes spent">
			<div className="flex flex-wrap items-center gap-2">
				<input
					type="number"
					inputMode="numeric"
					min={0}
					max={1440}
					value={text}
					disabled={readOnly}
					onChange={(e) => setText(e.target.value)}
					onBlur={(e) => commit(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commit(e.currentTarget.value);
					}}
					className="w-24 rounded-lg border border-rose-200 px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-300"
					aria-label="Minutes spent"
				/>
				{QUICK_MINUTES.map((m) => (
					<button
						key={m}
						type="button"
						disabled={readOnly}
						onClick={() => {
							setText(String(m));
							if (m !== value) onSave(m);
						}}
						className="rounded-full bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
					>
						{m} min
					</button>
				))}
			</div>
		</Section>
	);
}

function NotesField({
	initial,
	templates,
	readOnly,
	saving,
	onSave,
}: {
	initial: string;
	templates: Project["templates"];
	readOnly: boolean;
	saving: boolean;
	onSave: (notes: string) => void;
}) {
	const [text, setText] = useState(initial);
	const [lastSaved, setLastSaved] = useState(initial);
	const dirty = text !== lastSaved;

	// Pick up server changes (e.g. saved from another device) when not editing.
	// biome-ignore lint/correctness/useExhaustiveDependencies: react only to new server values
	useEffect(() => {
		if (!dirty) {
			setText(initial);
			setLastSaved(initial);
		}
	}, [initial]);

	const save = () => {
		if (!dirty) return;
		onSave(text);
		setLastSaved(text);
	};

	return (
		<Section title="Notes · pseudocode · where I got stuck">
			{!readOnly && templates.length > 0 ? (
				<div className="mb-2 flex flex-wrap gap-2">
					{templates.map((t) => (
						<button
							key={t.name}
							type="button"
							onClick={() =>
								setText((prev) =>
									prev.trim() ? `${prev}\n\n${t.body}` : t.body,
								)
							}
							className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
						>
							+ {t.name} template
						</button>
					))}
				</div>
			) : null}
			<textarea
				value={text}
				readOnly={readOnly}
				onChange={(e) => setText(e.target.value)}
				onBlur={save}
				rows={8}
				placeholder="Write short answers, links you found, pseudocode…"
				className="w-full rounded-xl border border-rose-200 px-3 py-2 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300"
			/>
			<div className="mt-2 flex items-center gap-3 text-sm">
				{!readOnly ? (
					<button
						type="button"
						onClick={save}
						disabled={!dirty}
						className="rounded-lg bg-rose-500 px-3 py-1.5 font-medium text-white hover:bg-rose-600 disabled:opacity-40"
					>
						Save notes
					</button>
				) : null}
				<span className="text-slate-400">
					{dirty ? "Unsaved changes" : saving ? "Saving…" : "Saved"}
				</span>
			</div>
		</Section>
	);
}
