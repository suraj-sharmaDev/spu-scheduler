import {
	createRouter as createTanStackRouter,
	Link,
} from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const context = getContext();

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultNotFoundComponent: NotFound,
	});

	setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

	return router;
}

function NotFound() {
	return (
		<div className="grid min-h-[60vh] place-items-center px-6 text-center">
			<div>
				<h1 className="font-display text-3xl font-semibold text-rose-950">
					Page not found
				</h1>
				<p className="mt-2 text-slate-600">That link doesn't go anywhere.</p>
				<Link
					to="/"
					className="mt-4 inline-block font-medium text-rose-600 hover:text-rose-700"
				>
					Back home
				</Link>
			</div>
		</div>
	);
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
