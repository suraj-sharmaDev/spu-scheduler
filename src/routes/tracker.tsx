import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import { Eye, Heart, LogOut } from "lucide-react";
import { getSession, logout } from "#/lib/tracker/api";
import { DEFAULT_PROJECT } from "#/lib/tracker/projects";

export const Route = createFileRoute("/tracker")({
	head: () => ({ meta: [{ title: "Learning Tracker · For Samanata" }] }),
	beforeLoad: async ({ location }) => {
		const session = await getSession();
		if (!session) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
		return { session };
	},
	component: TrackerLayout,
});

const project = { project: DEFAULT_PROJECT };
const base = `/tracker/${DEFAULT_PROJECT}`;

// Active state is computed from the path: task pages belong to "Plan", which
// the router's prefix matching can't express (concepts/guide share its prefix).
const NAV = [
	{ label: "Today", to: "/tracker", match: (p: string) => p === "/tracker" },
	{
		label: "Plan",
		to: "/tracker/$project",
		params: project,
		match: (p: string) => p === base || p.startsWith(`${base}/tasks/`),
	},
	{
		label: "Concepts",
		to: "/tracker/$project/concepts",
		params: project,
		match: (p: string) => p.startsWith(`${base}/concepts`),
	},
	{
		label: "Attendance",
		to: "/tracker/attendance",
		match: (p: string) => p.startsWith("/tracker/attendance"),
	},
	{
		label: "Progress",
		to: "/tracker/$project/progress",
		params: project,
		match: (p: string) => p.startsWith(`${base}/progress`),
	},
	{
		label: "Reflect",
		to: "/tracker/$project/reflect",
		params: project,
		match: (p: string) => p.startsWith(`${base}/reflect`),
	},
	{
		label: "Guide",
		to: "/tracker/$project/guide",
		params: project,
		match: (p: string) => p.startsWith(`${base}/guide`),
	},
] as const;

function Nav() {
	const pathname = useLocation({
		select: (l) => l.pathname.replace(/\/$/, "") || "/",
	});
	return (
		<nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
			{NAV.map((item) => (
				<Link
					key={item.label}
					to={item.to}
					params={"params" in item ? item.params : undefined}
					// Link sets aria-current itself; exact keeps it off parent routes.
					activeOptions={{ exact: true }}
					className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${item.match(pathname) ? "bg-rose-100 text-rose-800" : "text-slate-600 hover:bg-rose-50 hover:text-rose-700"}`}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}

function TrackerLayout() {
	const { session } = Route.useRouteContext();
	const router = useRouter();

	async function onLogout() {
		await logout();
		await router.navigate({ to: "/" });
	}

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
					<div className="ml-auto flex items-center gap-3 text-sm">
						{session.role === "admin" ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
								<Eye className="h-3.5 w-3.5" /> View only
							</span>
						) : null}
						<Link to="/" className="text-slate-500 hover:text-rose-600">
							Home
						</Link>
						<button
							type="button"
							onClick={onLogout}
							className="flex items-center gap-1 text-slate-500 hover:text-rose-600"
						>
							<LogOut className="h-4 w-4" /> Sign out
						</button>
					</div>
				</div>
				<Nav />
			</header>
			<main className="mx-auto max-w-5xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
