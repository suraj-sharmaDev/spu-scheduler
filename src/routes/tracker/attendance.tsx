import { createFileRoute } from "@tanstack/react-router";
import { Card, StatTile } from "#/components/tracker/ui";
import { WeekStrip } from "#/components/tracker/WeekStrip";
import { toAttendanceLike } from "#/lib/tracker/progress";
import { DEFAULT_PROJECT } from "#/lib/tracker/projects";
import { trackerQuery, useTracker } from "#/lib/tracker/queries";
import {
	addDays,
	allWeeks,
	formatTime,
	slotStreak,
	TRACKER_START_DATE,
} from "#/lib/tracker/schedule";
import { useNow } from "#/lib/tracker/useNow";

export const Route = createFileRoute("/tracker/attendance")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(trackerQuery(DEFAULT_PROJECT)),
	component: Attendance,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** "Sep 27" for a "YYYY-MM-DD" date (UTC so the date itself doesn't shift). */
function shortDate(date: string): string {
	return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function Attendance() {
	const state = useTracker(DEFAULT_PROJECT);
	const now = useNow();
	if (!now) return null;

	const weeks = allWeeks(toAttendanceLike(state.attendance), now);
	const past = weeks
		.flatMap((w) => w.slots)
		.filter(
			(s) =>
				s.state === "present" || s.state === "late" || s.state === "missed",
		);
	const onTime = past.filter((s) => s.state !== "missed").length;
	const makeups = state.attendance.filter((r) => r.kind === "makeup");
	const fullWeeks = weeks.filter((w) => w.attended >= w.target).length;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					Attendance
				</h1>
				<p className="mt-1 text-slate-600">
					Tracking since {shortDate(TRACKER_START_DATE)} · 5 sessions a week
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatTile
					label="scheduled sessions attended"
					value={
						past.length ? `${Math.round((onTime / past.length) * 100)}%` : "–"
					}
					hint={`${onTime} of ${past.length} so far`}
				/>
				<StatTile label="sessions in a row" value={slotStreak(weeks)} />
				<StatTile label="make-up sessions" value={makeups.length} />
				<StatTile label="weeks at 5 / 5" value={fullWeeks} />
			</div>

			{weeks.length === 0 ? (
				<Card>
					<p className="text-slate-600">
						Tracking starts {shortDate(TRACKER_START_DATE)}. Your first week
						will show up here.
					</p>
				</Card>
			) : (
				[...weeks].reverse().map((week) => {
					const weekMakeups = makeups.filter(
						(r) =>
							r.localDate >= week.weekStart &&
							r.localDate < addDays(week.weekStart, 7),
					);
					return (
						<Card
							key={week.weekStart}
							title={`${shortDate(week.weekStart)} – ${shortDate(addDays(week.weekStart, 6))}`}
							right={
								<span
									className={`rounded-full px-3 py-1 text-sm font-semibold ${week.attended >= week.target ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
								>
									{week.attended} / {week.target}
								</span>
							}
						>
							<WeekStrip week={week} showCount={false} />
							{weekMakeups.length > 0 ? (
								<ul className="mt-4 space-y-1 text-sm text-slate-600">
									{weekMakeups.map((m) => (
										<li key={m.id}>
											<span className="font-medium text-violet-700">
												Make-up
											</span>{" "}
											{shortDate(m.localDate)},{" "}
											{formatTime(new Date(m.checkedInAt))}
											{m.note ? ` — ${m.note}` : ""}
										</li>
									))}
								</ul>
							) : null}
						</Card>
					);
				})
			)}
		</div>
	);
}
