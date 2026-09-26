import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/tracker")({
	head: () => ({ meta: [{ title: "Learning Tracker · For Samanata" }] }),
	component: TrackerLayout,
});

function TrackerLayout() {
	return (
		<div className="min-h-screen bg-rose-50/40">
			<header className="border-b border-rose-100 bg-white/80 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
					<Link to="/tracker" className="flex items-center gap-2">
						<span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500 text-white">
							<Heart className="h-4 w-4 fill-white" />
						</span>
						<span className="font-display text-lg font-semibold text-slate-900">
							Learning Tracker
						</span>
					</Link>
					<Link
						to="/"
						className="ml-auto text-sm text-slate-500 hover:text-rose-600"
					>
						Home
					</Link>
				</div>
			</header>
			<main className="mx-auto max-w-5xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
