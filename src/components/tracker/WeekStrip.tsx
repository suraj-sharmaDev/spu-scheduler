import { Check, Clock, Plus, X } from "lucide-react";
import type { SlotState, WeekSummary } from "#/lib/tracker/schedule";
import { formatSlot } from "#/lib/tracker/schedule";

const STATE_STYLE: Record<SlotState, { box: string; label: string }> = {
	present: { box: "bg-emerald-500 text-white", label: "Present" },
	late: { box: "bg-amber-400 text-white", label: "Late" },
	missed: { box: "bg-slate-200 text-slate-500", label: "Missed" },
	open: {
		box: "bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse",
		label: "Open now",
	},
	upcoming: {
		box: "border-2 border-dashed border-rose-200 text-rose-300",
		label: "Upcoming",
	},
};

function StateIcon({ state }: { state: SlotState }) {
	if (state === "present") return <Check className="h-5 w-5" />;
	if (state === "late") return <Clock className="h-5 w-5" />;
	if (state === "missed") return <X className="h-5 w-5" />;
	return null;
}

/** The week's scheduled slots as a row of badges, plus the x/5 count. */
export function WeekStrip({ week }: { week: WeekSummary }) {
	return (
		<div>
			<div className="flex flex-wrap items-end gap-3 sm:gap-4">
				{week.slots.map(({ slot, state }) => {
					const [day, ...time] = formatSlot(slot).split(" ");
					return (
						<div
							key={slot.start.toISOString()}
							className="flex w-14 flex-col items-center gap-1 text-center"
							title={STATE_STYLE[state].label}
						>
							<span
								className={`grid h-11 w-11 place-items-center rounded-full ${STATE_STYLE[state].box}`}
							>
								<StateIcon state={state} />
							</span>
							<span className="text-xs font-semibold text-slate-700">
								{day}
							</span>
							<span className="text-[11px] leading-none text-slate-400">
								{time.join(" ")}
							</span>
						</div>
					);
				})}
				{week.makeups > 0 ? (
					<div className="flex w-14 flex-col items-center gap-1 text-center">
						<span className="grid h-11 w-11 place-items-center rounded-full bg-violet-500 text-white">
							<Plus className="h-5 w-5" />
						</span>
						<span className="text-xs font-semibold text-slate-700">
							{week.makeups} make-up
						</span>
					</div>
				) : null}
			</div>
			<p className="mt-3 text-sm text-slate-600">
				<span className="font-semibold text-slate-900">
					{week.attended} / {week.target}
				</span>{" "}
				sessions this week
			</p>
		</div>
	);
}
