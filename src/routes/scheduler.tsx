import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/scheduler")({
	head: () => ({ meta: [{ title: "SPU CS Scheduler" }] }),
	component: SchedulerLayout,
});

const NAV_LINKS = [
	{ to: "/scheduler", label: "Overview" },
	{ to: "/scheduler/plan", label: "Plan" },
	{ to: "/scheduler/transferred", label: "Transferred" },
] as const;

function NavBar() {
	return (
		<header className="border-b border-slate-200 bg-white">
			<div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
				<Link to="/scheduler" className="flex items-center gap-2">
					<span className="grid h-7 w-7 place-items-center rounded-md bg-maroon-700 text-sm font-bold text-white">
						S
					</span>
					<span className="font-semibold text-slate-900">CS Scheduler</span>
				</Link>
				<nav className="flex items-center gap-1">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
							activeProps={{
								className: "bg-maroon-50 text-maroon-800 hover:bg-maroon-50",
							}}
							activeOptions={{ exact: link.to === "/scheduler" }}
						>
							{link.label}
						</Link>
					))}
				</nav>
				<Link
					to="/"
					className="ml-auto flex items-center gap-1 text-sm text-slate-500 hover:text-rose-600"
				>
					<Heart className="h-4 w-4" /> Home
				</Link>
			</div>
		</header>
	);
}

function SchedulerLayout() {
	return (
		<>
			<NavBar />
			<main className="mx-auto max-w-7xl px-4 py-6">
				<Outlet />
			</main>
		</>
	);
}
