import { createFileRoute } from "@tanstack/react-router";
import { WeekStrip } from "#/components/tracker/WeekStrip";
import {
	addDays,
	localDate,
	TRACKER_START_DATE,
	weekStartOf,
	weekSummary,
} from "#/lib/tracker/schedule";
import { useNow } from "#/lib/tracker/useNow";

export const Route = createFileRoute("/tracker/")({ component: Today });

function Today() {
	const now = useNow();
	if (!now) return null;

	// Before tracking starts, preview the first tracked week instead of an empty one.
	const today = localDate(now);
	const weekStart = weekStartOf(
		today < TRACKER_START_DATE ? TRACKER_START_DATE : today,
	);
	const week = weekSummary(weekStart, [], now);

	return (
		<section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-rose-100">
			<h2 className="font-display text-xl font-semibold text-slate-900">
				This week
			</h2>
			<p className="mb-4 text-sm text-slate-500">
				Week of {weekStart} – {addDays(weekStart, 6)} · Pacific time
			</p>
			<WeekStrip week={week} />
		</section>
	);
}
