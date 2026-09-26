import { Link, useNavigate } from "@tanstack/react-router";
import { Flag, LifeBuoy, Play } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { TrackerState } from "#/lib/tracker/api";
import { checklistProgress, learnedConcepts } from "#/lib/tracker/progress";
import { conceptMap, getProject } from "#/lib/tracker/projects";
import {
	useClockSkew,
	useStartSession,
	useToggleChecklist,
	useUpdateTask,
} from "#/lib/tracker/queries";
import { formatElapsed } from "#/lib/tracker/session";
import { TASK_STATUSES } from "#/lib/tracker/status";
import type { Project, Task } from "#/lib/tracker/types";
import { useAutosaveNotes, useSessionElapsed } from "#/lib/tracker/useSession";
import { NotesBox } from "./NotesBox";
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
	showHeader = true,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	showHeader?: boolean;
}) {
	const readOnly = state.role !== "learner";
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
			{showHeader ? (
				<TaskHeader project={project} task={task} state={state} />
			) : null}

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

			{task.thinkAbout.length > 0 ? (
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

			<Section title="Notes · pseudocode · where I got stuck">
				<TaskNotes
					key={task.id}
					project={project}
					taskId={task.id}
					serverNotes={saved?.notes ?? ""}
					readOnly={readOnly}
				/>
			</Section>
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

/** Where the task sits in the plan, its title, status, level and tick progress. */
export function TaskHeader({
	project,
	task,
	state,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
}) {
	const milestone = project.milestones.find((m) => m.id === task.milestoneId);
	const status = state.progress[task.id]?.status ?? "not_started";
	const { done, total } = checklistProgress(task, new Set(state.checkedItems));
	return (
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
	);
}

/** Task summary plus one big button into the guided session. */
export function SessionLauncher({
	project,
	task,
	state,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
}) {
	return (
		<div className="space-y-5">
			<TaskHeader project={project} task={task} state={state} />
			<SessionButton project={project} task={task} state={state} />
			<p className="text-center text-sm text-slate-500">
				It walks you through the whole session step by step and times it for
				you.
			</p>
		</div>
	);
}

function TaskNotes({
	project,
	taskId,
	serverNotes,
	readOnly,
}: {
	project: Project;
	taskId: string;
	serverNotes: string;
	readOnly: boolean;
}) {
	const notes = useAutosaveNotes(project.slug, taskId, serverNotes, !readOnly);
	return (
		<NotesBox
			text={notes.text}
			onChange={notes.setText}
			onBlur={notes.flush}
			status={notes.status}
			templates={project.templates}
			readOnly={readOnly}
		/>
	);
}

/**
 * Primary call to action. Starts the guided session, or continues the open one.
 * Only one session can be open, so if another task's session is open this
 * button leads there instead.
 */
export function SessionButton({
	project,
	task,
	state,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
}) {
	const active = state.activeSession;
	const elapsed = useSessionElapsed(active, useClockSkew(project.slug));
	const start = useStartSession(project.slug);
	const navigate = useNavigate();
	const big =
		"flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-500 px-6 py-5 text-xl font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.99] disabled:opacity-60";

	if (active) {
		const same =
			active.projectSlug === project.slug && active.taskId === task.id;
		const openTask = getProject(active.projectSlug)?.tasks.find(
			(t) => t.id === active.taskId,
		);
		return (
			<div className="space-y-2">
				<Link
					to="/tracker/$project/tasks/$taskId/session"
					params={{ project: active.projectSlug, taskId: active.taskId }}
					className={big}
				>
					<Play className="h-6 w-6 fill-white" />
					{same
						? "Continue session"
						: `Continue session #${openTask?.number ?? "?"}`}
					<span className="font-mono text-lg font-medium opacity-80">
						{formatElapsed(elapsed)}
					</span>
				</Link>
				{same ? null : (
					<p className="rounded-xl bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
						You have a session open for #{openTask?.number} {openTask?.title}.
						Finish or discard it before starting a new one.
					</p>
				)}
			</div>
		);
	}

	return (
		<div>
			<button
				type="button"
				disabled={start.isPending}
				onClick={() =>
					start.mutate(task.id, {
						onSuccess: (r) => {
							if (r.started) {
								navigate({
									to: "/tracker/$project/tasks/$taskId/session",
									params: { project: project.slug, taskId: task.id },
								});
							}
						},
					})
				}
				className={big}
			>
				<Play className="h-6 w-6 fill-white" />
				{start.isPending ? "Starting…" : "Start session"}
			</button>
			<ErrorNote error={start.error} />
		</div>
	);
}
