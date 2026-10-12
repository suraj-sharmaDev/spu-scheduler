import { RotateCcw } from "lucide-react";
import { useState } from "react";
import type { TrackerState } from "#/lib/tracker/api";
import { useResetTracker } from "#/lib/tracker/queries";
import { Modal } from "./Modal";
import { ErrorNote } from "./ui";

const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

/** Admin only: wipe all progress and attendance, after typing "reset". */
export function ResetTracker({
	project,
	state,
}: {
	project: string;
	state: TrackerState;
}) {
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");
	const [done, setDone] = useState(false);
	const reset = useResetTracker(project);
	const close = () => {
		setOpen(false);
		setTyped("");
		reset.reset();
	};
	const ticks = state.checkedItems.length;

	return (
		<section className="rounded-2xl p-5 ring-1 ring-red-100 sm:p-6">
			<h2 className="font-display text-xl font-semibold text-slate-900">
				Start over
			</h2>
			<p className="mt-1 text-sm text-slate-600">
				Deletes all progress and attendance so Samanata begins again from
				session 1. Only you can see this.
			</p>
			{done ? (
				<output className="mt-3 block rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
					Everything was cleared.
				</output>
			) : null}
			<button
				type="button"
				onClick={() => {
					setDone(false);
					setOpen(true);
				}}
				className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
			>
				<RotateCcw className="h-4 w-4" /> Reset everything
			</button>

			<Modal open={open} onClose={close} title="Reset everything?">
				<div className="space-y-5">
					<p className="text-slate-700">This permanently deletes:</p>
					<ul className="list-disc space-y-1 pl-5 text-slate-700">
						<li>
							{plural(
								state.history.length,
								"finished session",
								"finished sessions",
							)}{" "}
							and her sentences
						</li>
						<li>
							{plural(ticks, "ticked step", "ticked steps")}, task notes and
							statuses
						</li>
						<li>recall answers, reflections and reviews</li>
						<li>{plural(state.attendance.length, "check-in", "check-ins")}</li>
					</ul>
					<p className="font-medium text-red-700">This can't be undone.</p>
					<label className="block">
						<span className="text-sm text-slate-600">
							Type <span className="font-mono font-semibold">reset</span> to
							confirm
						</span>
						<input
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							autoComplete="off"
							className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
						/>
					</label>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							disabled={typed.trim() !== "reset" || reset.isPending}
							onClick={() =>
								reset.mutate(typed.trim(), {
									onSuccess: () => {
										close();
										setDone(true);
									},
								})
							}
							className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-40"
						>
							{reset.isPending ? "Deleting…" : "Delete everything"}
						</button>
						<button
							type="button"
							onClick={close}
							className="rounded-xl px-5 py-2.5 font-medium text-slate-600 hover:bg-slate-100"
						>
							Cancel
						</button>
					</div>
					<ErrorNote error={reset.error} />
				</div>
			</Modal>
		</section>
	);
}
