import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarClock,
	CheckCircle2,
	Flame,
	PartyPopper,
	Plus,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { TaskPanel } from "#/components/tracker/TaskPanel";
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
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					{now ? greeting(localHour(now)) : "Hello"}
					{state.role === "learner" ? ", Samanata" : ""}
				</h1>
				<p className="mt-1 text-slate-600">
					{milestone
						? `Week ${milestone.number} of ${project.milestones.length} · ${milestone.subproject} · ${milestone.bigQuestion}`
						: project.title}
				</p>
			</div>

			{now ? <CheckInCard state={state} now={now} /> : null}

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
					<TaskPanel project={project} task={next} state={state} compact />
				</Card>
			) : (
				<Card>
					<div className="flex items-center gap-3 text-lg text-slate-800">
						<PartyPopper className="h-7 w-7 text-rose-500" />
						Every session is done. You did it!
					</div>
				</Card>
			)}
		</div>
	);
}

function CheckInCard({ state, now }: { state: TrackerState; now: Date }) {
	const readOnly = state.role !== "learner";
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
	const checkIn = useCheckIn(DEFAULT_PROJECT);

	return (
		<Card title="This week" subtitle="Sessions are in Pacific time">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				<WeekStrip week={week} />
				<div className="lg:w-80">
					{open && checkedIn ? (
						<div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
							<CheckCircle2 className="h-6 w-6 shrink-0" />
							<div>
								<div className="font-semibold">You're checked in</div>
								<div className="text-sm">
									{formatTime(new Date(checkedIn.checkedInAt))} ·{" "}
									{checkedIn.status === "late"
										? "a little late, still counts"
										: "right on time"}
								</div>
							</div>
						</div>
					) : open ? (
						<div>
							<button
								type="button"
								disabled={readOnly || checkIn.isPending}
								onClick={() => checkIn.mutate(undefined)}
								className="w-full rounded-2xl bg-rose-500 px-5 py-4 text-lg font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 disabled:opacity-60"
							>
								{checkIn.isPending ? "Checking in…" : "I'm here — check in"}
							</button>
							<p className="mt-2 text-center text-sm text-slate-500">
								{formatSlot(open)} session is open until {formatTime(open.end)}
							</p>
							<ErrorNote error={checkIn.error} />
						</div>
					) : (
						<div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-slate-700">
							<CalendarClock className="h-6 w-6 shrink-0 text-rose-500" />
							<div>
								<div className="font-semibold">
									{upcoming
										? `Next: ${formatSlot(upcoming)}`
										: "No sessions scheduled"}
								</div>
								{upcoming ? (
									<div className="text-sm text-slate-500">
										{relativeDay(upcoming, now)} · check-in opens 10 min before
									</div>
								) : null}
							</div>
						</div>
					)}
					{!open && !readOnly ? (
						<MakeupForm
							alreadyToday={state.attendance.some(
								(r) => r.kind === "makeup" && r.localDate === today,
							)}
						/>
					) : null}
				</div>
			</div>
		</Card>
	);
}

function MakeupForm({ alreadyToday }: { alreadyToday: boolean }) {
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState("");
	const makeup = useLogMakeup(DEFAULT_PROJECT);

	if (alreadyToday) {
		return (
			<p className="mt-3 text-center text-sm text-violet-700">
				Make-up session logged today ✓
			</p>
		);
	}
	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-slate-500 hover:text-violet-700"
			>
				<Plus className="h-4 w-4" /> Studying at another time? Log a make-up
				session
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
		<form onSubmit={onSubmit} className="mt-3 space-y-2">
			<input
				value={note}
				onChange={(e) => setNote(e.target.value)}
				maxLength={500}
				placeholder="Optional note (e.g. swapped for Monday)"
				className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
			/>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={makeup.isPending}
					className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
				>
					Log make-up session
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
				>
					Cancel
				</button>
			</div>
			<ErrorNote error={makeup.error} />
		</form>
	);
}
