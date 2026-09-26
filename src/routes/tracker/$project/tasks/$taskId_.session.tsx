import {
	createFileRoute,
	Link,
	notFound,
	useNavigate,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Flag,
	Heart,
	LifeBuoy,
	Pause,
	Play,
	SkipForward,
	Trash2,
	X,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NotesBox } from "#/components/tracker/NotesBox";
import { SessionLauncher } from "#/components/tracker/TaskPanel";
import {
	Card,
	Checklist,
	ConceptCard,
	ErrorNote,
	LevelStars,
	Meter,
} from "#/components/tracker/ui";
import type { ActiveSession, TrackerState } from "#/lib/tracker/api";
import {
	checklistProgress,
	learnedConcepts,
	nextTask,
} from "#/lib/tracker/progress";
import { conceptMap, getProject } from "#/lib/tracker/projects";
import {
	type SessionAction,
	useCheckIn,
	useClockSkew,
	useDiscardSession,
	useFinishSession,
	useSessionControl,
	useToggleChecklist,
	useTracker,
} from "#/lib/tracker/queries";
import { formatSlot, formatTime, openSlot } from "#/lib/tracker/schedule";
import {
	formatElapsed,
	type SessionStep,
	sessionMinutes,
	sessionSteps,
} from "#/lib/tracker/session";
import type { TaskStatus } from "#/lib/tracker/status";
import type { Project, Task } from "#/lib/tracker/types";
import { useNow } from "#/lib/tracker/useNow";
import { useProject } from "#/lib/tracker/useProject";
import { useAutosaveNotes, useSessionElapsed } from "#/lib/tracker/useSession";

export const Route = createFileRoute(
	"/tracker/$project/tasks/$taskId_/session",
)({
	beforeLoad: ({ params }) => {
		const project = getProject(params.project);
		if (!project?.tasks.some((t) => t.id === params.taskId)) throw notFound();
	},
	head: () => ({ meta: [{ title: "Session · Learning Tracker" }] }),
	component: SessionPage,
});

type Result = { minutes: number; status: TaskStatus };

function SessionPage() {
	const project = useProject();
	const { taskId } = Route.useParams();
	const state = useTracker(project.slug);
	const task = project.tasks.find((t) => t.id === taskId);
	// Kept here so the celebration survives the open session disappearing.
	const [result, setResult] = useState<Result | null>(null);
	// Remember whether this page was running this task's session, so we can
	// explain if it ends elsewhere (finished or discarded on another device).
	const active = state.activeSession;
	const isThisTask =
		active?.projectSlug === project.slug && active?.taskId === taskId;
	const [endedElsewhere, setEndedElsewhere] = useState(false);
	const hadSession = useRef(false);
	useEffect(() => {
		if (isThisTask) {
			hadSession.current = true;
			setEndedElsewhere(false);
		} else if (hadSession.current) {
			hadSession.current = false;
			setEndedElsewhere(true);
		}
	}, [isThisTask]);
	if (!task) throw notFound();

	if (result) {
		return (
			<Celebration
				project={project}
				task={task}
				state={state}
				result={result}
			/>
		);
	}
	if (state.role !== "learner") {
		return (
			<Card>
				<p className="text-slate-700">
					Sessions are run from Samanata's account. You can see this task on{" "}
					<Link
						to="/tracker/$project/tasks/$taskId"
						params={{ project: project.slug, taskId }}
						className="font-medium text-rose-600 hover:underline"
					>
						its page
					</Link>
					.
				</p>
			</Card>
		);
	}

	if (active && isThisTask) {
		return (
			<SessionFlow
				key={active.id}
				project={project}
				task={task}
				state={state}
				session={active}
				onFinished={setResult}
			/>
		);
	}

	// Nothing open for this task: either another session is open (continue or
	// discard it first) or none is (start one).
	const openTask = active
		? getProject(active.projectSlug)?.tasks.find((t) => t.id === active.taskId)
		: undefined;
	return (
		<div className="space-y-4">
			{endedElsewhere ? (
				<output className="block rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
					This session was finished or discarded on another device, so nothing
					else was saved here. Your ticks and notes are safe.
				</output>
			) : null}
			{active ? (
				<Card>
					<h1 className="font-display text-2xl font-semibold text-slate-900">
						You have a session in progress
					</h1>
					<p className="mt-1 text-slate-600">
						#{openTask?.number} {openTask?.title}. Only one session can be open
						at a time.
					</p>
					<div className="mt-4">
						<DiscardLink project={project} session={active} />
					</div>
				</Card>
			) : null}
			<Card>
				<SessionLauncher project={project} task={task} state={state} />
			</Card>
		</div>
	);
}

function SessionFlow({
	project,
	task,
	state,
	session,
	onFinished,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	session: ActiveSession;
	onFinished: (result: Result) => void;
}) {
	const steps = sessionSteps(task);
	const finishIndex = steps.length;
	const index = Math.min(session.step, finishIndex);
	const paused = session.runningSince === null;
	const elapsed = useSessionElapsed(session, useClockSkew(project.slug));
	const control = useSessionControl(project.slug);
	const notes = useAutosaveNotes(
		project.slug,
		task.id,
		state.progress[task.id]?.notes ?? "",
		true,
	);

	const act = (a: SessionAction) => control.mutate({ id: session.id, ...a });
	const go = (next: number) => {
		notes.flush();
		// The clock stops while wrapping up, and restarts if she goes back.
		if (next === finishIndex && !paused) act({ action: "pause" });
		else if (index === finishIndex && next < finishIndex && paused)
			act({ action: "resume" });
		act({ action: "step", step: next });
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const step = steps[index];

	return (
		<div className="space-y-4 pb-28">
			<SessionHeader
				project={project}
				task={task}
				state={state}
				session={session}
				steps={steps}
				index={index}
				elapsed={elapsed}
				paused={paused}
				onToggleTimer={() => act({ action: paused ? "resume" : "pause" })}
				onJump={go}
			/>
			<ErrorNote error={control.error} />

			{step ? (
				<StepCard step={step}>
					<StepBody
						step={step}
						project={project}
						task={task}
						state={state}
						notes={notes}
					/>
				</StepCard>
			) : (
				<FinishScreen
					project={project}
					task={task}
					state={state}
					session={session}
					elapsed={elapsed}
					flushNotes={notes.flush}
					notes={notes}
					onSaved={onFinished}
				/>
			)}

			{index < finishIndex ? (
				<div className="fixed inset-x-0 bottom-0 z-20 border-t border-rose-100 bg-white/95 backdrop-blur">
					<div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
						<button
							type="button"
							onClick={() => go(index - 1)}
							disabled={index === 0}
							className="inline-flex items-center gap-1 rounded-xl px-4 py-3 font-medium text-slate-600 hover:bg-slate-100 disabled:invisible"
						>
							<ArrowLeft className="h-5 w-5" /> Back
						</button>
						{step?.kind === "plan" ? (
							<button
								type="button"
								onClick={() => go(index + 1)}
								className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-100"
							>
								<SkipForward className="h-4 w-4" /> Nothing tricky, skip
							</button>
						) : null}
						<button
							type="button"
							onClick={() => go(index + 1)}
							className={`${step?.kind === "plan" ? "" : "ml-auto"} inline-flex items-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white shadow-md shadow-rose-200 hover:bg-rose-600`}
						>
							{index === finishIndex - 1 ? "Finish" : "Next"}
							<ArrowRight className="h-5 w-5" />
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}

/**
 * Confirm throwing away the open session (started by mistake). The timer is
 * dropped and no minutes are logged; ticks, notes and task status stay.
 */
function DiscardConfirm({
	project,
	session,
	onCancel,
	onDiscarded,
}: {
	project: Project;
	session: ActiveSession;
	onCancel: () => void;
	onDiscarded?: () => void;
}) {
	const discard = useDiscardSession(project.slug);
	return (
		<div
			role="alertdialog"
			aria-label="Discard this session?"
			className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
		>
			<p className="font-medium text-slate-900">Discard this session?</p>
			<p className="mt-1 text-sm text-slate-600">
				The timer is thrown away and no minutes are logged. Your ticks and notes
				stay.
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					disabled={discard.isPending}
					onClick={() => discard.mutate(session.id, { onSuccess: onDiscarded })}
					className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
				>
					{discard.isPending ? "Discarding…" : "Yes, discard it"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
				>
					Keep it
				</button>
			</div>
			<ErrorNote error={discard.error} />
		</div>
	);
}

/** "Started by mistake? Discard that session" link that opens the confirm panel. */
function DiscardLink({
	project,
	session,
}: {
	project: Project;
	session: ActiveSession;
}) {
	const [open, setOpen] = useState(false);
	return open ? (
		<DiscardConfirm
			project={project}
			session={session}
			onCancel={() => setOpen(false)}
		/>
	) : (
		<button
			type="button"
			onClick={() => setOpen(true)}
			className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
		>
			<Trash2 className="h-4 w-4" /> Started by mistake? Discard that session
		</button>
	);
}

// --- header: timer, progress, check-in ------------------------------------------

function SessionHeader({
	project,
	task,
	state,
	session,
	steps,
	index,
	elapsed,
	paused,
	onToggleTimer,
	onJump,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	session: ActiveSession;
	steps: SessionStep[];
	index: number;
	elapsed: number;
	paused: boolean;
	onToggleTimer: () => void;
	onJump: (i: number) => void;
}) {
	const navigate = useNavigate();
	const [discarding, setDiscarding] = useState(false);
	const labels = [...steps.map((s) => s.title), "Wrap up"];
	const toTask = () =>
		navigate({
			to: "/tracker/$project/tasks/$taskId",
			params: { project: project.slug, taskId: task.id },
		});
	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<Link
					to="/tracker/$project/tasks/$taskId"
					params={{ project: project.slug, taskId: task.id }}
					className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"
					aria-label="Leave session (your timer and place are kept)"
					title="Leave session (your timer and place are kept)"
				>
					<X className="h-5 w-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="text-xs text-slate-500">Session #{task.number}</p>
					<h1 className="truncate font-display text-lg font-semibold text-slate-900">
						{task.title}
					</h1>
				</div>
				<div
					className={`flex items-center gap-1 rounded-full py-1 pr-1 pl-3 ${paused ? "bg-amber-100 text-amber-900" : "bg-rose-50 text-rose-900"}`}
				>
					<span className="font-mono text-base font-semibold tabular-nums">
						{formatElapsed(elapsed)}
					</span>
					<button
						type="button"
						onClick={onToggleTimer}
						className="grid h-8 w-8 place-items-center rounded-full bg-white/80 hover:bg-white"
						aria-label={paused ? "Resume timer" : "Pause timer"}
					>
						{paused ? (
							<Play className="h-4 w-4" />
						) : (
							<Pause className="h-4 w-4" />
						)}
					</button>
				</div>
				<button
					type="button"
					onClick={() => setDiscarding((d) => !d)}
					aria-expanded={discarding}
					className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="Discard session"
					title="Discard session (started by mistake)"
				>
					<Trash2 className="h-4 w-4" />
				</button>
			</div>
			{discarding ? (
				<DiscardConfirm
					project={project}
					session={session}
					onCancel={() => setDiscarding(false)}
					onDiscarded={toTask}
				/>
			) : null}

			<ol className="flex gap-1" aria-label="Session steps">
				{labels.map((label, i) => (
					<li key={label} className="flex-1">
						<button
							type="button"
							onClick={() => onJump(i)}
							aria-current={i === index ? "step" : undefined}
							className="group w-full text-left"
						>
							<span
								className={`block h-1.5 rounded-full transition ${i < index ? "bg-rose-400" : i === index ? "bg-rose-500" : "bg-rose-100 group-hover:bg-rose-200"}`}
							/>
							<span
								className={`mt-1 hidden truncate text-[11px] sm:block ${i === index ? "font-semibold text-rose-700" : "text-slate-400"}`}
							>
								{label}
							</span>
						</button>
					</li>
				))}
			</ol>
			<p className="text-xs text-slate-500 sm:hidden">
				Step {index + 1} of {labels.length} · {labels[index]}
			</p>

			<CheckInNudge project={project} state={state} />
		</div>
	);
}

function CheckInNudge({
	project,
	state,
}: {
	project: Project;
	state: TrackerState;
}) {
	const now = useNow();
	const checkIn = useCheckIn(project.slug);
	if (!now) return null;
	const slot = openSlot(now);
	if (!slot) return null;
	const checkedIn = state.attendance.some(
		(r) =>
			r.slotStart && new Date(r.slotStart).getTime() === slot.start.getTime(),
	);
	if (checkedIn) return null;
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-2xl bg-rose-500 px-4 py-3 text-white">
			<span className="flex-1 text-sm">
				Your {formatSlot(slot)} session is open until {formatTime(slot.end)}.
			</span>
			<button
				type="button"
				onClick={() => checkIn.mutate(undefined)}
				disabled={checkIn.isPending}
				className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
			>
				{checkIn.isPending ? "Checking in…" : "Check in"}
			</button>
			<ErrorNote error={checkIn.error} />
		</div>
	);
}

// --- steps ----------------------------------------------------------------------

function StepCard({
	step,
	children,
}: {
	step: SessionStep;
	children: ReactNode;
}) {
	return (
		<Card>
			<div className="mb-5">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="font-display text-2xl font-semibold text-slate-900">
						{step.title}
					</h2>
					<span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
						about {step.minutes}
					</span>
				</div>
				<p className="mt-1 text-slate-600">{step.hint}</p>
			</div>
			{children}
		</Card>
	);
}

function StepBody({
	step,
	project,
	task,
	state,
	notes,
}: {
	step: SessionStep;
	project: Project;
	task: Task;
	state: TrackerState;
	notes: ReturnType<typeof useAutosaveNotes>;
}) {
	const checked = new Set(state.checkedItems);
	const toggle = useToggleChecklist(project.slug);
	const onToggle = (itemId: string, value: boolean) =>
		toggle.mutate({ itemId, checked: value });
	const milestone = project.milestones.find((m) => m.id === task.milestoneId);
	const concepts = conceptMap(project);
	const pseudocode = project.templates.filter((t) => /pseudo/i.test(t.name));

	switch (step.kind) {
		case "read":
			return (
				<div className="space-y-5">
					<div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
						<span>
							Week {milestone?.number} · {milestone?.subproject}
						</span>
						<LevelStars level={task.level} />
						{task.checkpoint ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
								<Flag className="h-3 w-3" /> Checkpoint
							</span>
						) : null}
					</div>
					{task.intro.length > 0 ? (
						<p className="whitespace-pre-line rounded-xl bg-amber-50/70 px-4 py-3 text-slate-700">
							{task.intro.join("\n")}
						</p>
					) : null}
					<ReadList title="What you'll do" items={task.steps} numbered />
					{task.doneWhen.length > 0 ? (
						<ReadList title="You're done when" items={task.doneWhen} />
					) : null}
				</div>
			);

		case "words": {
			const learned = learnedConcepts(project, state);
			const refs = [...task.concepts].sort(
				(a, b) => Number(b.isNew) - Number(a.isNew),
			);
			return (
				<div className="space-y-3">
					{refs.map((ref) => {
						const concept = concepts.get(ref.conceptId);
						if (!concept) return null;
						return (
							<div key={ref.conceptId} className="relative">
								<span
									className={`absolute top-6 right-4 z-10 rounded px-1.5 text-[10px] font-bold ${ref.isNew ? "bg-rose-500 text-white" : learned.has(concept.id) ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
								>
									{ref.isNew
										? "NEW"
										: learned.has(concept.id)
											? "SEEN"
											: "AGAIN"}
								</span>
								<ConceptCard concept={concept} />
							</div>
						);
					})}
				</div>
			);
		}

		case "research":
			return (
				<div className="space-y-5">
					<ol className="space-y-2">
						{task.thinkAbout.map((q, i) => (
							<li
								key={q}
								className="flex gap-3 rounded-xl bg-rose-50/60 px-4 py-3"
							>
								<span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500 text-xs font-bold text-white">
									{i + 1}
								</span>
								<span className="text-slate-800">{q}</span>
							</li>
						))}
					</ol>
					<NotesBox
						label="Your answers and links"
						text={notes.text}
						onChange={notes.setText}
						onBlur={notes.flush}
						status={notes.status}
						templates={[]}
						readOnly={false}
						rows={6}
						placeholder={"1. …\n2. …"}
					/>
				</div>
			);

		case "plan":
			return (
				<NotesBox
					label="Notes and pseudocode"
					text={notes.text}
					onChange={notes.setText}
					onBlur={notes.flush}
					status={notes.status}
					templates={pseudocode}
					readOnly={false}
					rows={10}
					placeholder="Problem → Input → Output → Steps in plain English → What could go wrong"
				/>
			);

		case "build": {
			const items = task.steps.filter((s) => !s.stretch);
			const done = items.filter((s) => checked.has(s.id)).length;
			return (
				<div className="space-y-4">
					<ProgressLine done={done} total={items.length} label="steps done" />
					<Checklist
						items={task.steps}
						checked={checked}
						onToggle={onToggle}
						readOnly={false}
					/>
					<ErrorNote error={toggle.error} />
					<details className="rounded-xl bg-slate-50 px-4 py-3">
						<summary className="cursor-pointer text-sm font-medium text-slate-600">
							Notes (for anything you want to remember or where you got stuck)
						</summary>
						<div className="mt-3">
							<NotesBox
								text={notes.text}
								onChange={notes.setText}
								onBlur={notes.flush}
								status={notes.status}
								templates={project.templates}
								readOnly={false}
								rows={6}
							/>
						</div>
					</details>
				</div>
			);
		}

		case "check": {
			const done = task.doneWhen.filter((s) => checked.has(s.id)).length;
			return (
				<div className="space-y-4">
					<ProgressLine
						done={done}
						total={task.doneWhen.length}
						label="checks passed"
					/>
					<Checklist
						items={task.doneWhen}
						checked={checked}
						onToggle={onToggle}
						readOnly={false}
					/>
					<ErrorNote error={toggle.error} />
					{done === task.doneWhen.length ? (
						<p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
							<CheckCircle2 className="h-5 w-5" /> Everything checks out. Tap
							Finish to wrap up.
						</p>
					) : null}
				</div>
			);
		}
	}
}

function ReadList({
	title,
	items,
	numbered = false,
}: {
	title: string;
	items: Task["steps"];
	numbered?: boolean;
}) {
	let n = 0;
	return (
		<div>
			<h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700/70">
				{title}
			</h3>
			<ul className="space-y-2">
				{items.map((item) => {
					if (!item.stretch) n++;
					return (
						<li key={item.id} className="flex gap-3 text-slate-700">
							<span
								className={`mt-0.5 shrink-0 text-sm font-semibold ${item.stretch ? "text-violet-600" : "text-rose-500"}`}
							>
								{item.stretch ? "⭐" : numbered ? `${n}.` : "•"}
							</span>
							<span className="whitespace-pre-line">
								{item.stretch ? (
									<span className="font-medium text-violet-700">Stretch: </span>
								) : null}
								{item.text}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function ProgressLine({
	done,
	total,
	label,
}: {
	done: number;
	total: number;
	label: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<Meter value={total ? done / total : 0} className="max-w-56" />
			<span className="text-sm text-slate-600">
				{done} of {total} {label}
			</span>
		</div>
	);
}

// --- wrap up --------------------------------------------------------------------

const OUTCOMES: {
	status: TaskStatus;
	title: string;
	detail: string;
	icon: ReactNode;
	selected: string;
}[] = [
	{
		status: "done",
		title: "Done",
		detail: "Everything in the checks is true.",
		icon: <CheckCircle2 className="h-6 w-6" />,
		selected: "bg-emerald-50 ring-2 ring-emerald-500 text-emerald-900",
	},
	{
		status: "in_progress",
		title: "Not finished yet",
		detail: "I'll carry on next session. That's normal.",
		icon: <ArrowRight className="h-6 w-6" />,
		selected: "bg-sky-50 ring-2 ring-sky-500 text-sky-900",
	},
	{
		status: "stuck",
		title: "I'm stuck",
		detail: "Stuck for 15+ minutes. Write it down, then ask for help.",
		icon: <LifeBuoy className="h-6 w-6" />,
		selected: "bg-amber-50 ring-2 ring-amber-500 text-amber-900",
	},
];

function FinishScreen({
	project,
	task,
	state,
	session,
	elapsed,
	notes,
	flushNotes,
	onSaved,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	session: ActiveSession;
	elapsed: number;
	notes: ReturnType<typeof useAutosaveNotes>;
	flushNotes: () => void;
	onSaved: (result: { minutes: number; status: TaskStatus }) => void;
}) {
	const saved = state.progress[task.id];
	const [minutesText, setMinutesText] = useState(() =>
		String(sessionMinutes(elapsed)),
	);
	const [outcome, setOutcome] = useState<TaskStatus | null>(null);
	const finish = useFinishSession(project.slug);
	const checked = new Set(state.checkedItems);
	const unchecked = task.doneWhen.filter((i) => !checked.has(i.id)).length;
	const { done, total } = checklistProgress(task, checked);

	const minutes = Number(minutesText);
	const minutesValid =
		minutesText.trim() !== "" &&
		Number.isInteger(minutes) &&
		minutes >= 0 &&
		minutes <= 1440;
	const previous = saved?.minutes ?? 0;
	const stuckTemplate = project.templates.filter((t) => /stuck/i.test(t.name));

	function save() {
		if (!outcome || !minutesValid) return;
		flushNotes();
		// The server closes the session and adds the minutes to the task in one step.
		finish.mutate(
			{ id: session.id, taskId: task.id, outcome, minutes },
			{ onSuccess: () => onSaved({ minutes, status: outcome }) },
		);
	}

	return (
		<Card>
			<h2 className="font-display text-2xl font-semibold text-slate-900">
				How did it go?
			</h2>
			<p className="mt-1 text-slate-600">
				{done} of {total} ticked so far. Pick what's true right now.
			</p>

			<div className="mt-5 grid gap-3 sm:grid-cols-3">
				{OUTCOMES.map((o) => (
					<button
						key={o.status}
						type="button"
						aria-pressed={outcome === o.status}
						onClick={() => setOutcome(o.status)}
						className={`flex flex-col items-start gap-1 rounded-2xl p-4 text-left transition ${outcome === o.status ? o.selected : "bg-slate-50 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"}`}
					>
						{o.icon}
						<span className="font-semibold">{o.title}</span>
						<span className="text-sm opacity-80">{o.detail}</span>
					</button>
				))}
			</div>

			{outcome === "done" && unchecked > 0 ? (
				<p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
					{unchecked} {unchecked === 1 ? "check isn't" : "checks aren't"} ticked
					yet. You can still mark it Done, but go back to Check if you're not
					sure.
				</p>
			) : null}

			{outcome === "stuck" ? (
				<div className="mt-4">
					<NotesBox
						label="What's blocking you?"
						text={notes.text}
						onChange={notes.setText}
						onBlur={notes.flush}
						status={notes.status}
						templates={stuckTemplate}
						readOnly={false}
						rows={8}
						placeholder="I'm trying to… I expected… Instead… (exact error) … I think the cause is…"
					/>
				</div>
			) : null}

			<div className="mt-6 rounded-2xl bg-rose-50/70 p-4">
				<label className="flex flex-wrap items-center gap-3">
					<span className="text-sm font-medium text-slate-800">
						Minutes this session
					</span>
					<input
						type="number"
						inputMode="numeric"
						min={0}
						max={1440}
						value={minutesText}
						onChange={(e) => setMinutesText(e.target.value)}
						className="w-24 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-rose-300"
					/>
					<span className="text-sm text-slate-500">
						from the timer
						{previous > 0 && minutesValid
							? ` · total for this task becomes ${Math.min(1440, previous + minutes)}`
							: ""}
					</span>
				</label>
				{!minutesValid ? (
					<p className="mt-2 text-sm text-red-600">
						Enter a whole number from 0 to 1440.
					</p>
				) : null}
			</div>

			<button
				type="button"
				onClick={save}
				disabled={!outcome || !minutesValid || finish.isPending}
				className="mt-6 w-full rounded-2xl bg-rose-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 hover:bg-rose-600 disabled:opacity-50"
			>
				{finish.isPending
					? "Saving…"
					: outcome
						? "Save and finish"
						: "Pick how it went"}
			</button>
			<ErrorNote error={finish.error} />
		</Card>
	);
}

const CHEERS: Record<TaskStatus, string> = {
	done: "Another one done. Proud of you!",
	in_progress: "Good work today. You'll pick it up right where you left off.",
	stuck:
		"Getting stuck is part of learning. Your notes are saved, so ask for help with them.",
	not_started: "Saved.",
};

function Celebration({
	project,
	task,
	state,
	result,
}: {
	project: Project;
	task: Task;
	state: TrackerState;
	result: { minutes: number; status: TaskStatus };
}) {
	const next = nextTask(project, state);
	return (
		<div className="mx-auto max-w-lg py-10 text-center">
			<span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-rose-100">
				<Heart className="h-10 w-10 fill-rose-500 text-rose-500" />
			</span>
			<h1 className="mt-6 font-display text-3xl font-semibold text-rose-950">
				Session saved
			</h1>
			<p className="mt-2 text-slate-600">
				#{task.number} · {result.minutes} min
			</p>
			<p className="mt-4 text-lg text-slate-800">{CHEERS[result.status]}</p>
			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link
					to="/tracker"
					className="rounded-xl bg-rose-500 px-6 py-3 font-semibold text-white hover:bg-rose-600"
				>
					Back to Today
				</Link>
				{result.status === "done" && next ? (
					<Link
						to="/tracker/$project/tasks/$taskId"
						params={{ project: project.slug, taskId: next.id }}
						className="rounded-xl px-6 py-3 font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
					>
						See next: #{next.number} {next.title}
					</Link>
				) : null}
			</div>
		</div>
	);
}
