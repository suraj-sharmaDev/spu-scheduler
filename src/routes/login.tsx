import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, LockKeyhole } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { login } from "#/lib/tracker/api";

export const Route = createFileRoute("/login")({
	head: () => ({ meta: [{ title: "Sign in · For Samanata" }] }),
	validateSearch: (search: Record<string, unknown>) => ({
		// Only same-site paths, so the redirect can't send her elsewhere.
		redirect:
			typeof search.redirect === "string" &&
			search.redirect.startsWith("/") &&
			!search.redirect.startsWith("//")
				? search.redirect
				: undefined,
	}),
	component: Login,
});

function Login() {
	const { redirect } = Route.useSearch();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	// Until hydration the button would trigger a native form submit.
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);

	// Read the field on submit (uncontrolled) so text typed before hydration isn't lost.
	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const passcode = String(
			new FormData(e.currentTarget).get("passcode") ?? "",
		);
		setPending(true);
		setError(null);
		try {
			await login({ data: { passcode } });
			await navigate({ href: redirect ?? "/tracker" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
			setPending(false);
		}
	}

	return (
		<div className="grid min-h-screen place-items-center bg-gradient-to-br from-rose-100 via-pink-50 to-amber-50 px-6">
			<form
				method="post"
				onSubmit={onSubmit}
				className="w-full max-w-sm rounded-3xl bg-white/80 p-8 text-center shadow-lg shadow-rose-200/50 ring-1 ring-rose-100 backdrop-blur"
			>
				<span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500 text-white">
					<Heart className="h-7 w-7 fill-white" />
				</span>
				<h1 className="mt-5 font-display text-3xl font-semibold text-rose-950">
					Welcome back
				</h1>
				<p className="mt-1 text-sm text-slate-500">
					Enter your passcode to open the tracker.
				</p>
				<label className="mt-6 block text-left">
					<span className="sr-only">Passcode</span>
					<div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 focus-within:ring-2 focus-within:ring-rose-300">
						<LockKeyhole className="h-4 w-4 text-rose-300" />
						<input
							type="password"
							autoComplete="current-password"
							name="passcode"
							placeholder="Passcode"
							className="w-full bg-transparent py-3 text-slate-900 outline-none placeholder:text-slate-400"
							required
						/>
					</div>
				</label>
				{error ? (
					<p role="alert" className="mt-3 text-sm text-red-600">
						{error}
					</p>
				) : null}
				<button
					type="submit"
					disabled={!hydrated || pending}
					className="mt-5 w-full rounded-xl bg-rose-500 py-3 font-medium text-white transition hover:bg-rose-600 disabled:opacity-50"
				>
					{pending ? "Opening…" : "Open tracker"}
				</button>
				<Link
					to="/"
					className="mt-4 inline-block text-sm text-slate-500 hover:text-rose-600"
				>
					Back home
				</Link>
			</form>
		</div>
	);
}
