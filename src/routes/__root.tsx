import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "SPU CS Scheduler" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

const NAV_LINKS = [
	{ to: "/", label: "Overview" },
	{ to: "/plan", label: "Plan" },
	{ to: "/transferred", label: "Transferred" },
] as const;

function NavBar() {
	return (
		<header className="border-b border-slate-200 bg-white">
			<div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
				<Link to="/" className="flex items-center gap-2">
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
							activeOptions={{ exact: link.to === "/" }}
						>
							{link.label}
						</Link>
					))}
				</nav>
			</div>
		</header>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<NavBar />
				<main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
