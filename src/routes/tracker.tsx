import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import {
	CircleHelp,
	Eye,
	Heart,
	ListChecks,
	LogOut,
	NotebookPen,
	Sun,
} from "lucide-react";
import type { ComponentType } from "react";
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

type NavItem = {
	label: string;
	to: string;
	params?: typeof project;
	icon?: ComponentType<{ className?: string }>;
	match: (p: string) => boolean;
};

// Active state is computed from the path: task pages belong to "Plan", which
// the router's prefix matching can't express (concepts/guide share its prefix).
// The learner gets three places to go; everything else is reached by a link
// from one of them, so there's never a row of tabs to decode.
const LEARNER_NAV: NavItem[] = [
	{ label: "Today", to: "/tracker", icon: Sun, match: (p) => p === "/tracker" },
	{
		label: "Plan",
		to: "/tracker/$project",
		params: project,
		icon: ListChecks,
		match: (p) => p === base || p.startsWith(`${base}/tasks/`),
	},
	{
		label: "Notebook",
		to: "/tracker/$project/notebook",
		params: project,
		icon: NotebookPen,
		match: (p) => p.startsWith(`${base}/notebook`),
	},
];

const ADMIN_NAV: NavItem[] = [
	...LEARNER_NAV,
	{
		label: "Concepts",
		to: "/tracker/$project/concepts",
		params: project,
		match: (p) => p.startsWith(`${base}/concepts`),
	},
	{
		label: "Attendance",
		to: "/tracker/attendance",
		match: (p) => p.startsWith("/tracker/attendance"),
	},
	{
		label: "Progress",
		to: "/tracker/$project/progress",
		params: project,
		match: (p) => p.startsWith(`${base}/progress`),
	},
	{
		label: "Reflect",
		to: "/tracker/$project/reflect",
		params: project,
		match: (p) => p.startsWith(`${base}/reflect`),
	},
	{
		label: "Guide",
		to: "/tracker/$project/guide",
		params: project,
		match: (p) => p.startsWith(`${base}/guide`),
	},
];

function usePathname() {
	return useLocation({
		select: (l) => l.pathname.replace(/\/$/, "") || "/",
	});
}

function TopNav({ items, always }: { items: NavItem[]; always: boolean }) {
	const pathname = usePathname();
	return (
		<nav
			className={`mx-auto max-w-3xl gap-1 overflow-x-auto px-4 pb-2 ${always ? "flex" : "hidden sm:flex"}`}
		>
			{items.map((item) => (
				<Link
					key={item.label}
					to={item.to}
					params={item.params}
					// Link sets aria-current itself; exact keeps it off parent routes.
					activeOptions={{ exact: true }}
					className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${item.match(pathname) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
				>
					{item.label}
				</Link>
			))}
		</nav>
	);
}

/** Phone nav: three big targets at the bottom, thumb-reachable. */
function BottomNav({ items }: { items: NavItem[] }) {
	const pathname = usePathname();
	return (
		<nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
			<div className="mx-auto flex max-w-3xl">
				{items.map((item) => {
					const Icon = item.icon;
					const active = item.match(pathname);
					return (
						<Link
							key={item.label}
							to={item.to}
							params={item.params}
							activeOptions={{ exact: true }}
							className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${active ? "text-rose-600" : "text-slate-500"}`}
						>
							{Icon ? <Icon className="h-6 w-6" /> : null}
							{item.label}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}

function TrackerLayout() {
	const { session } = Route.useRouteContext();
	const router = useRouter();
	const pathname = usePathname();
	const admin = session.role === "admin";
	const items = admin ? ADMIN_NAV : LEARNER_NAV;
	// The guided session has its own fixed Back/Next bar; don't stack a nav on it.
	const inSession = pathname.endsWith("/session");

	async function onLogout() {
		await logout();
		await router.navigate({ to: "/" });
	}

	return (
		<div className="min-h-screen bg-white text-slate-900">
			<header className="border-b border-slate-100">
				<div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
					<Link to="/tracker" className="flex items-center gap-2">
						<span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500 text-white">
							<Heart className="h-4 w-4 fill-white" />
						</span>
						<span className="font-display text-lg font-semibold">
							Learning Tracker
						</span>
					</Link>
					<div className="ml-auto flex items-center gap-4 text-sm text-slate-500">
						{admin ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
								<Eye className="h-3.5 w-3.5" /> View only
							</span>
						) : null}
						<Link
							to="/tracker/$project/guide"
							params={project}
							aria-label="How this works"
							title="How this works"
							className="hover:text-slate-900"
						>
							<CircleHelp className="h-5 w-5" />
						</Link>
						<button
							type="button"
							onClick={onLogout}
							aria-label="Sign out"
							title="Sign out"
							className="hover:text-slate-900"
						>
							<LogOut className="h-5 w-5" />
						</button>
					</div>
				</div>
				{inSession ? null : <TopNav items={items} always={admin} />}
			</header>
			<main
				className={`mx-auto max-w-3xl px-4 py-6 ${inSession || admin ? "" : "pb-24 sm:pb-6"}`}
			>
				<Outlet />
			</main>
			{inSession || admin ? null : <BottomNav items={items} />}
		</div>
	);
}
