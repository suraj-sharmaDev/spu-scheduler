import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * A native <dialog> shown with showModal(): focus is trapped, Esc closes it and
 * the page behind can't be clicked. Slides up from the bottom on phones.
 */
export function Modal({
	open,
	onClose,
	title,
	children,
}: {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Esc already closes a modal dialog.
		<dialog
			ref={ref}
			onClose={onClose}
			// A click on the backdrop lands on the dialog element itself.
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			className="m-0 mt-auto max-h-[88vh] w-full max-w-none rounded-t-3xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-2xl sm:rounded-3xl"
		>
			{open ? (
				<div className="flex max-h-[88vh] flex-col">
					<header className="flex items-center gap-3 border-b border-rose-100 px-5 py-4 sm:px-6">
						<h2 className="flex-1 font-display text-xl font-semibold text-slate-900">
							{title}
						</h2>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800"
						>
							<X className="h-5 w-5" />
						</button>
					</header>
					<div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
				</div>
			) : null}
		</dialog>
	);
}
