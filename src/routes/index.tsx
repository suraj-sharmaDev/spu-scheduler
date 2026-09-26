import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	CalendarHeart,
	GraduationCap,
	Heart,
	Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	formatSlot,
	localHour,
	nextSlot,
	openSlot,
	relativeDay,
} from "#/lib/tracker/schedule";
import { useNow } from "#/lib/tracker/useNow";

export const Route = createFileRoute("/")({ component: Home });

// Fixed positions so server and client render the same hearts.
const HEARTS = [
	{ left: "6%", size: 18, delay: "0s", duration: "15s" },
	{ left: "15%", size: 28, delay: "4s", duration: "18s" },
	{ left: "27%", size: 14, delay: "8s", duration: "13s" },
	{ left: "38%", size: 22, delay: "2s", duration: "17s" },
	{ left: "52%", size: 16, delay: "10s", duration: "14s" },
	{ left: "63%", size: 30, delay: "6s", duration: "20s" },
	{ left: "74%", size: 18, delay: "1s", duration: "16s" },
	{ left: "85%", size: 24, delay: "9s", duration: "19s" },
	{ left: "93%", size: 14, delay: "5s", duration: "12s" },
];

function greetingFor(hour: number): string {
	if (hour < 5) return "Up late";
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function Home() {
	const now = useNow();
	const open = now ? openSlot(now) : null;
	const next = now ? nextSlot(now) : null;

	let sessionLine = "Five little sessions a week";
	if (open) sessionLine = "Your session is open now — come check in";
	else if (next && now)
		sessionLine = `Next session: ${formatSlot(next)} (${relativeDay(next, now)})`;

	return (
		<div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				{HEARTS.map((h) => (
					<Heart
						key={h.left}
						className="animate-float-up absolute -bottom-10 fill-rose-300 text-rose-300"
						style={{
							left: h.left,
							width: h.size,
							height: h.size,
							animationDelay: h.delay,
							animationDuration: h.duration,
						}}
					/>
				))}
			</div>

			<div className="relative mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12 sm:py-20">
				<header className="text-center">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-medium tracking-wide text-rose-700 shadow-sm ring-1 ring-rose-200">
						<Sparkles className="h-3.5 w-3.5" />
						{now ? `${greetingFor(localHour(now))}, love` : "Hello, love"}
					</span>
					<h1 className="mt-6 font-display text-5xl font-semibold text-rose-950 sm:text-7xl">
						For Samanata
					</h1>
					<p className="mx-auto mt-4 max-w-md text-lg text-rose-900/70">
						Every small step counts. Here's where yours add up.
					</p>
				</header>

				<div className="mt-12 grid gap-6 sm:mt-16 md:grid-cols-2">
					<HomeCard
						to="/tracker"
						icon={<CalendarHeart className="h-7 w-7" />}
						iconClass="bg-rose-500 text-white"
						title="Learning Tracker"
						body="Check in to your session, work through today's task, and see how far you've come."
						footer={sessionLine}
						highlight={open !== null}
					/>
					<HomeCard
						to="/scheduler"
						icon={<GraduationCap className="h-7 w-7" />}
						iconClass="bg-maroon-700 text-white"
						title="SPU Scheduler"
						body="Plan your BS in Computer Science quarter by quarter, with prerequisites checked for you."
						footer="Seattle Pacific University · CS"
					/>
				</div>

				<footer className="mt-auto pt-16 text-center text-sm text-rose-900/50">
					Made with{" "}
					<Heart className="inline h-3.5 w-3.5 fill-rose-400 text-rose-400" />{" "}
					by Suraj
				</footer>
			</div>
		</div>
	);
}

function HomeCard({
	to,
	icon,
	iconClass,
	title,
	body,
	footer,
	highlight = false,
}: {
	to: "/tracker" | "/scheduler";
	icon: ReactNode;
	iconClass: string;
	title: string;
	body: string;
	footer: string;
	highlight?: boolean;
}) {
	return (
		<Link
			to={to}
			className={`group flex flex-col rounded-3xl bg-white/75 p-7 shadow-lg shadow-rose-200/50 ring-1 backdrop-blur transition hover:-translate-y-1 hover:bg-white hover:shadow-xl ${highlight ? "ring-2 ring-rose-400" : "ring-rose-100"}`}
		>
			<span
				className={`grid h-14 w-14 place-items-center rounded-2xl ${iconClass}`}
			>
				{icon}
			</span>
			<h2 className="mt-5 font-display text-2xl font-semibold text-slate-900">
				{title}
			</h2>
			<p className="mt-2 flex-1 text-slate-600">{body}</p>
			<div className="mt-6 flex items-center justify-between border-t border-rose-100 pt-4 text-sm">
				<span
					className={highlight ? "font-medium text-rose-600" : "text-slate-500"}
				>
					{footer}
				</span>
				<ArrowRight className="h-5 w-5 text-rose-400 transition group-hover:translate-x-1 group-hover:text-rose-600" />
			</div>
		</Link>
	);
}
