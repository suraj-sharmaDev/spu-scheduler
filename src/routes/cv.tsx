import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CV, formatGpa, phoneHref } from "#/lib/cv";

export const Route = createFileRoute("/cv")({
	// Browsers use the title as the default "Save as PDF" file name.
	head: () => ({ meta: [{ title: "Samanata_Kathayat_Resume" }] }),
	component: CvPage,
});

const DOCX_NAME = "Samanata_Kathayat_Resume.docx";

async function downloadDocx() {
	// Loaded on click so the docx library stays out of the page bundle.
	const { cvDocxBlob } = await import("#/lib/cvDocx");
	const url = URL.createObjectURL(await cvDocxBlob());
	const a = document.createElement("a");
	a.href = url;
	a.download = DOCX_NAME;
	a.click();
	URL.revokeObjectURL(url);
}

function CvPage() {
	const [docxError, setDocxError] = useState<string | null>(null);
	const [docxPending, setDocxPending] = useState(false);

	async function onDocx() {
		setDocxPending(true);
		setDocxError(null);
		try {
			await downloadDocx();
		} catch (err) {
			setDocxError(
				err instanceof Error ? err.message : "Could not build the Word file.",
			);
		} finally {
			setDocxPending(false);
		}
	}

	return (
		<div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
			<div className="mx-auto mb-6 flex w-[8.5in] max-w-full items-center justify-between px-4 print:hidden">
				<Link
					to="/"
					className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
				>
					<ArrowLeft className="h-4 w-4" />
					Back home
				</Link>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onDocx}
						disabled={docxPending}
						className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
					>
						<FileText className="h-4 w-4" />
						{docxPending ? "Building…" : "Download Word"}
					</button>
					<button
						type="button"
						onClick={() => window.print()}
						className="inline-flex items-center gap-2 rounded-lg bg-maroon-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-maroon-800"
					>
						<Download className="h-4 w-4" />
						Download PDF
					</button>
				</div>
			</div>
			{docxError ? (
				<p
					role="alert"
					className="mx-auto mb-4 w-[8.5in] max-w-full px-4 text-sm text-red-600 print:hidden"
				>
					{docxError}
				</p>
			) : null}
			<p className="mx-auto mb-4 w-[8.5in] max-w-full px-4 text-xs text-slate-500 print:hidden">
				In the print dialog, choose "Save as PDF", paper size Letter, and turn
				off "Headers and footers".
			</p>

			<Resume />
		</div>
	);
}

function Resume() {
	const contact = [
		CV.location,
		CV.phone,
		CV.email,
		...CV.links.map((l) => l.label),
	];

	return (
		<main className="mx-auto min-h-[11in] w-[8.5in] max-w-full bg-white px-[0.5in] py-[0.45in] font-[Arial,Helvetica,sans-serif] text-[10.5pt] leading-snug text-black shadow-lg print:min-h-0 print:w-auto print:p-0 print:shadow-none">
			<header className="text-center">
				<h1 className="text-[20pt] font-bold tracking-wide">{CV.name}</h1>
				<p className="mt-1">
					{contact.map((item, i) => (
						<span key={item}>
							{i > 0 ? " | " : null}
							<ContactItem text={item} />
						</span>
					))}
				</p>
			</header>

			<Section title="Summary">
				<p>{CV.summary}</p>
			</Section>

			<Section title="Education">
				{CV.education.map((e) => (
					<div key={e.school} className="mt-1.5 first:mt-0">
						<Row left={<strong>{e.school}</strong>} right={e.location} />
						<Row
							left={
								<em>
									{e.degree}
									{e.gpa !== undefined ? ` | GPA: ${formatGpa(e.gpa)}` : null}
								</em>
							}
							right={e.dates}
						/>
						{e.details?.length ? <Bullets items={e.details} /> : null}
					</div>
				))}
			</Section>

			{CV.coursework.length > 0 ? (
				<Section title="Relevant Coursework">
					<p>{CV.coursework.join(", ")}</p>
				</Section>
			) : null}

			<Section title="Technical Skills">
				<ul>
					{CV.skills.map((g) => (
						<li key={g.label}>
							<strong>{g.label}:</strong> {g.items.join(", ")}
						</li>
					))}
				</ul>
			</Section>

			<Section title="Leadership Experience">
				{CV.leadership.map((job) => (
					<div key={`${job.title}-${job.org}`} className="mt-1.5 first:mt-0">
						<Row left={<strong>{job.title}</strong>} right={job.dates} />
						<Row left={<em>{job.org}</em>} right={job.location} />
						<Bullets items={job.bullets} />
					</div>
				))}
			</Section>

			<Section title="Honors & Awards">
				<Bullets items={CV.honors} />
			</Section>
		</main>
	);
}

function ContactItem({ text }: { text: string }) {
	if (text === CV.phone) return <a href={phoneHref(text)}>{text}</a>;
	if (text === CV.email) return <a href={`mailto:${text}`}>{text}</a>;
	const link = CV.links.find((l) => l.label === text);
	if (link) return <a href={link.href}>{text}</a>;
	return <>{text}</>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="mt-3 break-inside-avoid">
			<h2 className="mb-1 border-b border-black text-[11pt] font-bold uppercase tracking-wider">
				{title}
			</h2>
			{children}
		</section>
	);
}

function Row({ left, right }: { left: ReactNode; right: string }) {
	return (
		<div className="flex items-baseline justify-between gap-4">
			<span>{left}</span>
			<span className="shrink-0">{right}</span>
		</div>
	);
}

function Bullets({ items }: { items: string[] }) {
	return (
		<ul className="mt-0.5 list-disc pl-5">
			{items.map((b) => (
				<li key={b}>{b}</li>
			))}
		</ul>
	);
}
