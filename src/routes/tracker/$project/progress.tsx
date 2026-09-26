import { createFileRoute } from "@tanstack/react-router";
import { Card, Meter, StatTile } from "#/components/tracker/ui";
import { WeekChart } from "#/components/tracker/WeekChart";
import {
	milestoneRows,
	toAttendanceLike,
	totals,
} from "#/lib/tracker/progress";
import { useTracker } from "#/lib/tracker/queries";
import { allWeeks } from "#/lib/tracker/schedule";
import { useNow } from "#/lib/tracker/useNow";
import { useProject } from "#/lib/tracker/useProject";

export const Route = createFileRoute("/tracker/$project/progress")({
	component: Progress,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});
const shortDate = (d: string) =>
	dateFormatter.format(new Date(`${d}T00:00:00Z`));

function Progress() {
	const project = useProject();
	const state = useTracker(project.slug);
	const now = useNow();
	const rows = milestoneRows(project, state);
	const t = totals(project, state);
	const weeks = now ? allWeeks(toAttendanceLike(state.attendance), now) : [];
	const pastSlots = weeks
		.flatMap((w) => w.slots)
		.filter((s) => s.state !== "upcoming" && s.state !== "open");
	const attendedSlots = pastSlots.filter((s) => s.state !== "missed").length;
	const confidence = project.milestones.map((m) => ({
		label: `W${m.number}`,
		value: state.reflections[m.number]?.confidence ?? null,
	}));
	const hasConfidence = confidence.some((c) => c.value !== null);
	const maxSessions = Math.max(...rows.map((r) => r.sessions));
	const maxAttended = Math.max(5, ...weeks.map((w) => w.attended));

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					How far you've come
				</h1>
				<p className="mt-1 text-slate-600">{project.title}</p>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<StatTile
					label="sessions done"
					value={`${t.done} / ${t.tasks}`}
					hint={`${Math.round(t.pct * 100)}% of the plan${t.stuck ? ` · ${t.stuck} stuck` : ""}`}
				/>
				<StatTile
					label="concepts learned"
					value={`${t.conceptsLearned} / ${t.concepts}`}
				/>
				<StatTile
					label="hours of practice"
					value={(t.minutes / 60).toFixed(1)}
					hint={`${t.minutes} minutes logged`}
				/>
				<StatTile
					label="scheduled sessions attended"
					value={
						pastSlots.length
							? `${Math.round((attendedSlots / pastSlots.length) * 100)}%`
							: "–"
					}
					hint={`${attendedSlots} of ${pastSlots.length} so far`}
				/>
			</div>

			<Card title="Sessions done each week" subtitle="Out of 5 per week">
				<WeekChart
					kind="columns"
					ariaLabel="Sessions done per plan week"
					max={maxSessions}
					ticks={Array.from({ length: maxSessions + 1 }, (_, i) => i)}
					points={rows.map((r) => ({
						label: `W${r.milestone.number}`,
						value: r.done,
						detail: `${r.done} of ${r.sessions} · ${r.milestone.subproject}`,
					}))}
				/>
			</Card>

			{weeks.length > 0 ? (
				<Card
					title="Sessions attended each week"
					subtitle="Scheduled check-ins plus make-ups, out of 5"
				>
					<WeekChart
						kind="columns"
						ariaLabel="Sessions attended per calendar week"
						max={maxAttended}
						ticks={Array.from({ length: maxAttended + 1 }, (_, i) => i)}
						points={weeks.map((w) => ({
							label: shortDate(w.weekStart),
							value: w.attended,
							detail: `${w.attended} of ${w.target}${w.makeups ? ` · ${w.makeups} make-up` : ""}`,
						}))}
					/>
				</Card>
			) : null}

			<Card
				title="Confidence"
				subtitle="From your weekly reflections, 1 (shaky) to 5 (solid)"
			>
				{hasConfidence ? (
					<WeekChart
						kind="line"
						ariaLabel="Confidence per plan week"
						min={1}
						max={5}
						ticks={[1, 2, 3, 4, 5]}
						points={confidence}
						valueFormat={(v) => `${v} / 5`}
					/>
				) : (
					<p className="text-sm text-slate-500">
						Fill in a weekly reflection and your confidence will show up here.
					</p>
				)}
			</Card>

			<Card title="Week by week">
				<div className="-mx-2 overflow-x-auto">
					<table className="w-full min-w-[40rem] text-sm">
						<thead>
							<tr className="text-left text-xs uppercase tracking-wide text-slate-500">
								<th className="px-2 py-2 font-medium">Week</th>
								<th className="px-2 py-2 font-medium">Project</th>
								<th className="px-2 py-2 font-medium">Big question</th>
								<th className="px-2 py-2 text-right font-medium">Done</th>
								<th className="px-2 py-2 text-right font-medium">Stuck</th>
								<th className="w-32 px-2 py-2 font-medium">Progress</th>
								<th className="px-2 py-2 text-right font-medium">Minutes</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-rose-50 tabular-nums">
							{rows.map((r) => (
								<tr key={r.milestone.id}>
									<td className="px-2 py-2 text-slate-500">
										{r.milestone.number}
									</td>
									<td className="px-2 py-2 whitespace-nowrap text-slate-700">
										{r.milestone.subproject}
									</td>
									<td className="px-2 py-2 text-slate-600">
										{r.milestone.bigQuestion}
									</td>
									<td className="px-2 py-2 text-right text-slate-800">
										{r.done}/{r.sessions}
									</td>
									<td className="px-2 py-2 text-right text-slate-800">
										{r.stuck}
									</td>
									<td className="px-2 py-2">
										<div className="flex items-center gap-2">
											<Meter value={r.pct} />
											<span className="w-9 text-right text-xs text-slate-500">
												{Math.round(r.pct * 100)}%
											</span>
										</div>
									</td>
									<td className="px-2 py-2 text-right text-slate-800">
										{r.minutes}
									</td>
								</tr>
							))}
						</tbody>
						<tfoot>
							<tr className="border-t-2 border-rose-100 font-semibold text-slate-900 tabular-nums">
								<td className="px-2 py-2" colSpan={3}>
									Total · {(t.minutes / 60).toFixed(1)} hours
								</td>
								<td className="px-2 py-2 text-right">
									{t.done}/{t.tasks}
								</td>
								<td className="px-2 py-2 text-right">{t.stuck}</td>
								<td className="px-2 py-2">
									<div className="flex items-center gap-2">
										<Meter value={t.pct} />
										<span className="w-9 text-right text-xs">
											{Math.round(t.pct * 100)}%
										</span>
									</div>
								</td>
								<td className="px-2 py-2 text-right">{t.minutes}</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</Card>
		</div>
	);
}
