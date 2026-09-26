import { useEffect, useRef, useState } from "react";

/**
 * Single-series weekly chart (columns or line) in plain SVG. One accent hue
 * (rose-500, validated against the white surface), hairline grid, bars capped
 * at 24px with a 4px rounded data end. Each week's whole band is the hover /
 * focus target; the values are also in the table on the same page.
 */

export interface WeekPoint {
	label: string;
	value: number | null;
	/** Tooltip detail under the value, e.g. "3 of 5 sessions". */
	detail?: string;
}

const ACCENT = "#f43f5e"; // rose-500
const TRACK = "#ffe4e6"; // rose-100, lighter step of the same ramp
const GRID = "#f1f5f9"; // slate-100
const AXIS_TEXT = "#64748b"; // slate-500

// Drawn at the container's real pixel width so bar caps and text stay true size.
const DEFAULT_WIDTH = 640;
const H = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };
const BAR_MAX = 24;

/** Rounded top corners, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
	const r = Math.min(4, w / 2, h);
	return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function WeekChart({
	kind,
	points,
	min = 0,
	max,
	ticks,
	valueFormat = (v) => String(v),
	ariaLabel,
}: {
	kind: "columns" | "line";
	points: WeekPoint[];
	min?: number;
	max: number;
	ticks: number[];
	valueFormat?: (v: number) => string;
	ariaLabel: string;
}) {
	const [active, setActive] = useState<number | null>(null);
	const ref = useRef<HTMLDivElement>(null);
	const [W, setW] = useState(DEFAULT_WIDTH);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) =>
			setW(Math.max(240, Math.round(entry.contentRect.width))),
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const band = plotW / points.length;
	const x = (i: number) => PAD.left + band * i + band / 2;
	const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
	const barW = Math.min(BAR_MAX, band * 0.6);
	// Narrow screens: label every Nth week (plus the hovered one) so labels don't collide.
	const labelEvery = Math.max(1, Math.ceil(40 / band));

	const line = points
		.map((p, i) => (p.value === null ? null : `${x(i)},${y(p.value)}`))
		.reduce<string[][]>(
			(runs, pt) => {
				// Gaps (weeks with no value) break the line.
				if (pt === null) runs.push([]);
				else runs[runs.length - 1].push(pt);
				return runs;
			},
			[[]],
		)
		.filter((run) => run.length > 0);

	const activePoint = active === null ? null : points[active];

	return (
		<div ref={ref} className="relative">
			<svg
				width={W}
				height={H}
				viewBox={`0 0 ${W} ${H}`}
				className="block overflow-visible"
				role="img"
				aria-label={ariaLabel}
			>
				{ticks.map((t) => (
					<g key={t}>
						<line
							x1={PAD.left}
							x2={W - PAD.right}
							y1={y(t)}
							y2={y(t)}
							stroke={GRID}
							strokeWidth={1}
						/>
						<text
							x={PAD.left - 8}
							y={y(t)}
							textAnchor="end"
							dominantBaseline="middle"
							fontSize={12}
							fill={AXIS_TEXT}
						>
							{t}
						</text>
					</g>
				))}

				{points.map((p, i) =>
					i % labelEvery !== 0 && i !== active ? null : (
						<text
							key={p.label}
							x={x(i)}
							y={H - 8}
							textAnchor="middle"
							fontSize={12}
							fill={active === i ? "#0f172a" : AXIS_TEXT}
						>
							{p.label}
						</text>
					),
				)}

				{kind === "columns"
					? points.map((p, i) => {
							const bx = x(i) - barW / 2;
							const h = p.value === null ? 0 : y(min) - y(p.value);
							return (
								<g key={p.label}>
									<path
										d={columnPath(bx, y(max), barW, y(min) - y(max))}
										fill={TRACK}
									/>
									{h > 0 ? (
										<path
											d={columnPath(bx, y(min) - h, barW, h)}
											fill={ACCENT}
											opacity={active === null || active === i ? 1 : 0.55}
										/>
									) : null}
								</g>
							);
						})
					: null}

				{kind === "line" ? (
					<>
						{active !== null ? (
							<line
								x1={x(active)}
								x2={x(active)}
								y1={PAD.top}
								y2={PAD.top + plotH}
								stroke="#cbd5e1"
								strokeWidth={1}
							/>
						) : null}
						{line.map((run) => (
							<polyline
								key={run[0]}
								points={run.join(" ")}
								fill="none"
								stroke={ACCENT}
								strokeWidth={2}
								strokeLinejoin="round"
								strokeLinecap="round"
							/>
						))}
						{points.map((p, i) =>
							p.value === null ? null : (
								<circle
									key={p.label}
									cx={x(i)}
									cy={y(p.value)}
									r={active === i ? 6 : 4.5}
									fill={ACCENT}
									stroke="#ffffff"
									strokeWidth={2}
								/>
							),
						)}
					</>
				) : null}

				{/* Hit targets: the whole week band, keyboard-focusable. */}
				{points.map((p, i) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: SVG hit band; the same values are in the table below
					<rect
						key={p.label}
						x={PAD.left + band * i}
						y={PAD.top}
						width={band}
						height={plotH + PAD.bottom}
						fill="transparent"
						tabIndex={0}
						aria-label={`${p.label}: ${p.value === null ? "no data" : valueFormat(p.value)}`}
						onPointerEnter={() => setActive(i)}
						onPointerLeave={() => setActive(null)}
						onFocus={() => setActive(i)}
						onBlur={() => setActive(null)}
						className="outline-none focus-visible:stroke-rose-300"
					/>
				))}
			</svg>

			{activePoint ? (
				<div
					className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200"
					style={{ left: `${(x(active ?? 0) / W) * 100}%` }}
				>
					<div className="font-semibold text-slate-900">
						{activePoint.value === null ? "–" : valueFormat(activePoint.value)}
					</div>
					<div className="whitespace-nowrap text-xs text-slate-500">
						{activePoint.label}
						{activePoint.detail ? ` · ${activePoint.detail}` : ""}
					</div>
				</div>
			) : null}
		</div>
	);
}
