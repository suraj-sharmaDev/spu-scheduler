import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Flame, PartyPopper } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
	SessionButton,
	SessionLauncher,
	TaskHeader,
} from "#/components/tracker/TaskPanel";
import { Card, ErrorNote, StatTile } from "#/components/tracker/ui";
import { WeekStrip } from "#/components/tracker/WeekStrip";
import type { TrackerState } from "#/lib/tracker/api";
import { nextTask, toAttendanceLike, totals } from "#/lib/tracker/progress";
import { DEFAULT_PROJECT, getProject } from "#/lib/tracker/projects";
import {
	trackerQuery,
	useCheckIn,
	useLogMakeup,
	useTracker,
} from "#/lib/tracker/queries";
import {
	allWeeks,
	formatSlot,
	formatTime,
	localDate,
	localHour,
	nextSlot,
	openSlot,
	relativeDay,
	slotStreak,
	TRACKER_START_DATE,
	weekStartOf,
	weekSummary,
} from "#/lib/tracker/schedule";
import type { Project } from "#/lib/tracker/types";
import { useNow } from "#/lib/tracker/useNow";

export const Route = createFileRoute("/tracker/")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(trackerQuery(DEFAULT_PROJECT)),
	component: Today,
});

function greeting(hour: number): string {
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function Today() {
	const project = getProject(DEFAULT_PROJECT);
	if (!project) throw new Error("No projects configured");
	const state = useTracker(project.slug);
	return state.role === "learner" ? (
		<LearnerToday project={project} state={state} />
	) : (
		<AdminToday project={project} state={state} />
	);
}

/**
 * One screen, one button. The button is whatever comes next: check in if a
 * slot is open, otherwise start (or continue) the next session. Everything
 * else is a quiet line of text or a link at the bottom.
 */
function LearnerToday({
	project,
	state,
}: {
	project: Project;
	state: TrackerState;
}) {
	const now = useNow();
	const next = nextTask(project, state);
	const milestone = next
		? project.milestones.find((m) => m.id === next.milestoneId)
		: undefined;
	const open = now ? openSlot(now) : null;
	const upcoming = now ? nextSlot(now) : null;
	const checkedIn = open
		? state.attendance.find(
				(r) =>
					r.slotStart &&
					new Date(r.slotStart).getTime() === open.start.getTime(),
			)
		: undefined;
	const today = now ? localDate(now) : "";
	const makeupToday = state.attendance.some(
		(r) => r.kind === "makeup" && r.localDate === today,
	);
	const checkIn = useCheckIn(project.slug);

	return (
		<div className="mx-auto max-w-xl space-y-10 pt-4 sm:pt-10">
			<div className="space-y-2">
				<h1 className="font-display text-3xl font-semibold sm:text-4xl">
					{now ? greeting(localHour(now)) : "Hello"}, Samanata
				</h1>
				<p className="text-slate-500">
					{open && checkedIn ? (
						<span className="inline-flex items-center gap-1.5 text-emerald-700">
							<CheckCircle2 className="h-4 w-4" /> Checked in at{" "}
							{formatTime(new Date(checkedIn.checkedInAt))}
						</span>
					) : open ? (
						`Tonight's session is open until ${formatTime(open.end)}`
					) : upcoming ? (
						`Next session ${formatSlot(upcoming)}, ${now ? relativeDay(upcoming, now) : ""}`
					) : (
						"No sessions scheduled"
					)}
				</p>
			</div>

			{open && !checkedIn ? (
				<div>
					<button
						type="button"
						disabled={checkIn.isPending}
						onClick={() => checkIn.mutate(undefined)}
						className="flex w-full items-center justify-center gap-3 rounded-2xl bg-rose-500 px-6 py-5 text-xl font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 active:scale-[0.99] disabled:opacity-60"
					>
						{checkIn.isPending ? "Checking in…" : "I'm here, check in"}
					</button>
					<p className="mt-3 text-center text-sm text-slate-500">
						Then your session starts.
					</p>
					<ErrorNote error={checkIn.error} />
				</div>
			) : next && milestone ? (
				<div className="space-y-5">
					<div>
						<p className="text-sm text-slate-500">
							Week {milestone.number} · Session {next.sessionInMilestone} of{" "}
							{
								project.tasks.filter((t) => t.milestoneId === milestone.id)
									.length
							}
						</p>
						<h2 className="mt-1 font-display text-2xl font-semibold">
							{next.title}
						</h2>
					</div>
					<SessionButton project={project} task={next} state={state} />
				</div>
			) : (
				<div className="flex items-center gap-3 text-lg">
					<PartyPopper className="h-7 w-7 text-rose-500" />
					Every session is done. You did it!
				</div>
			)}

			<div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-6 text-sm text-slate-500">
				<Link
					to="/tracker/$project/progress"
					params={{ project: project.slug }}
					className="hover:text-slate-900"
				>
					How it's going
				</Link>
				<Link
					to="/tracker/$project/reflect"
					params={{ project: project.slug }}
					className="hover:text-slate-900"
				>
					Reflect on the week
				</Link>
				{!open ? (
					<MakeupLink alreadyToday={makeupToday} project={project.slug} />
				) : null}
			</div>
		</div>
	);
}

function MakeupLink({
	alreadyToday,
	project,
}: {
	alreadyToday: boolean;
	project: string;
}) {
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const makeup = useLogMakeup(project);

	if (alreadyToday) {
		return <span className="text-emerald-700">Make-up logged today ✓</span>;
	}
	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="hover:text-slate-900"
			>
				Studying at another time?
			</button>
		);
	}

	function onSubmit(e: FormEvent) {
		e.preventDefault();
		makeup.mutate(
			{ note: note.trim() || undefined },
			{ onSuccess: () => setOpen(false) },
		);
	}

	return (
		<form onSubmit={onSubmit} className="w-full space-y-2">
			<input
				value={note}
				onChange={(e) => setNote(e.target.value)}
				maxLength={500}
				placeholder="Optional note (e.g. swapped for Monday)"
				className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-300"
			/>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={makeup.isPending}
					className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
				>
					Log a make-up session
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100"
				>
					Cancel
				</button>
			</div>
			<ErrorNote error={makeup.error} />
		</form>
	);
}

/** The admin keeps the numbers: week strip, stat tiles, and what's up next. */
function AdminToday({
	project,
	state,
}: {
	project: Project;
	state: TrackerState;
}) {
	const now = useNow();
	const next = nextTask(project, state);
	const milestone = next
		? project.milestones.find((m) => m.id === next.milestoneId)
		: undefined;
	const t = totals(project, state);
	const rows = toAttendanceLike(state.attendance);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-display text-3xl font-semibold">
					{now ? greeting(localHour(now)) : "Hello"}
				</h1>
				<p className="mt-1 text-slate-600">
					{milestone
						? `Week ${milestone.number} of ${project.milestones.length} · ${milestone.subproject} · ${milestone.bigQuestion}`
						: project.title}
				</p>
			</div>

			{now ? <WeekCard state={state} now={now} /> : null}

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatTile
					label="sessions done"
					value={`${t.done} / ${t.tasks}`}
					hint={`${Math.round(t.pct * 100)}% of the plan`}
				/>
				<StatTile
					label="concepts learned"
					value={`${t.conceptsLearned} / ${t.concepts}`}
				/>
				<StatTile
					label="hours of practice"
					value={(t.minutes / 60).toFixed(1)}
				/>
				<StatTile
					label="sessions in a row"
					value={
						<span className="inline-flex items-center gap-1">
							{now ? slotStreak(allWeeks(rows, now)) : "–"}
							<Flame className="h-5 w-5 text-orange-500" />
						</span>
					}
				/>
			</div>

			{next ? (
				<Card
					title="Up next"
					right={
						<Link
							to="/tracker/$project"
							params={{ project: project.slug }}
							className="text-sm font-medium text-rose-600 hover:text-rose-700"
						>
							Whole plan →
						</Link>
					}
				>
					{state.role === "learner" ? (
						<SessionLauncher project={project} task={next} state={state} />
					) : (
						<TaskHeader project={project} task={next} state={state} />
					)}
				</Card>
			) : (
				<Card>
					<div className="flex items-center gap-3 text-lg">
						<PartyPopper className="h-7 w-7 text-rose-500" />
						Every session is done.
					</div>
				</Card>
			)}
		</div>
	);
}

function WeekCard({ state, now }: { state: TrackerState; now: Date }) {
	const rows = toAttendanceLike(state.attendance);
	const today = localDate(now);
	const weekStart = weekStartOf(
		today < TRACKER_START_DATE ? TRACKER_START_DATE : today,
	);
	const week = weekSummary(weekStart, rows, now);
	const open = openSlot(now);
	const upcoming = nextSlot(now);
	const checkedIn = open
		? state.attendance.find(
				(r) =>
					r.slotStart &&
					new Date(r.slotStart).getTime() === open.start.getTime(),
			)
		: undefined;

	return (
		<Card title="This week" subtitle="Sessions are in Pacific time">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<WeekStrip week={week} />
				<div className="lg:w-80">
					{open && checkedIn ? (
						<div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
							<CheckCircle2 className="h-6 w-6 shrink-0" />
							<div>
								<div className="font-semibold">Checked in</div>
								<div className="text-sm">
									{formatTime(new Date(checkedIn.checkedInAt))} ·{" "}
									{checkedIn.status === "late" ? "late" : "on time"}
								</div>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
							<CalendarClock className="h-6 w-6 shrink-0 text-rose-500" />
							<div>
								<div className="font-semibold">
									{open
										? `${formatSlot(open)} is open, not checked in`
										: upcoming
											? `Next: ${formatSlot(upcoming)}`
											: "No sessions scheduled"}
								</div>
								{!open && upcoming ? (
									<div className="text-sm text-slate-500">
										{relativeDay(upcoming, now)}
									</div>
								) : null}
							</div>
						</div>
					)}
				</div>
			</div>
		</Card>
	);
}
