import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import { Eye, Heart, LogOut } from "lucide-react";
import { getSession, logout } from "#/lib/tracker/api";

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
			</header>
			<main className="mx-auto max-w-5xl px-4 py-6">
				<Outlet />
			</main>
		</div>
	);
}
