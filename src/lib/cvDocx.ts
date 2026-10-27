import {
	AlignmentType,
	BorderStyle,
	Document,
	ExternalHyperlink,
	Packer,
	Paragraph,
	TabStopType,
	TextRun,
} from "docx";
import { CV, type Cv, formatGpa, phoneHref } from "./cv";

// Word units: twips (1/1440 in) for layout, half-points for font size.
const INCH = 1440;
const MARGIN = INCH / 2;
const TEXT_WIDTH = 8.5 * INCH - 2 * MARGIN;
const BODY_SIZE = 22; // 11pt, same as the /cv page
const CONTACT_SIZE = 20; // 10pt
const FONT = "Arial";

function heading(title: string): Paragraph {
	return new Paragraph({
		spacing: { before: 320, after: 80 },
		border: {
			bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 },
		},
		children: [
			new TextRun({ text: title.toUpperCase(), bold: true, size: 24 }),
		],
	});
}

/** Left text with right-aligned text on the same line, via a right tab stop. */
function row(left: TextRun, right: string, before = 0): Paragraph {
	return new Paragraph({
		spacing: { before },
		tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
		children: [left, new TextRun({ text: `\t${right}` })],
	});
}

function bullet(text: string): Paragraph {
	return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] });
}

// Smaller than body so the contact line, LinkedIn URL included, stays on one line.
function contactRun(text: string): TextRun {
	return new TextRun({ text, size: CONTACT_SIZE });
}

export function buildCvDocument(cv: Cv = CV): Document {
	const contact: (TextRun | ExternalHyperlink)[] = [
		contactRun(`${cv.location} | `),
		new ExternalHyperlink({
			link: phoneHref(cv.phone),
			children: [contactRun(cv.phone)],
		}),
		contactRun(" | "),
		new ExternalHyperlink({
			link: `mailto:${cv.email}`,
			children: [contactRun(cv.email)],
		}),
	];
	for (const l of cv.links) {
		contact.push(
			contactRun(" | "),
			new ExternalHyperlink({ link: l.href, children: [contactRun(l.label)] }),
		);
	}

	const body: Paragraph[] = [
		new Paragraph({
			alignment: AlignmentType.CENTER,
			children: [new TextRun({ text: cv.name, bold: true, size: 48 })],
		}),
		new Paragraph({ alignment: AlignmentType.CENTER, children: contact }),

		heading("Summary"),
		new Paragraph(cv.summary),

		heading("Education"),
	];

	cv.education.forEach((e, i) => {
		const degree =
			e.gpa === undefined ? e.degree : `${e.degree} | GPA: ${formatGpa(e.gpa)}`;
		body.push(
			row(new TextRun({ text: e.school, bold: true }), e.location, i ? 200 : 0),
			row(new TextRun({ text: degree, italics: true }), e.dates),
			...(e.details ?? []).map(bullet),
		);
	});

	if (cv.coursework.length > 0) {
		body.push(
			heading("Relevant Coursework"),
			new Paragraph(cv.coursework.join(", ")),
		);
	}

	body.push(heading("Technical Skills"));
	for (const g of cv.skills) {
		body.push(
			new Paragraph({
				children: [
					new TextRun({ text: `${g.label}: `, bold: true }),
					new TextRun(g.items.join(", ")),
				],
			}),
		);
	}

	body.push(heading("Leadership Experience"));
	cv.leadership.forEach((job, i) => {
		body.push(
			row(new TextRun({ text: job.title, bold: true }), job.dates, i ? 200 : 0),
			row(new TextRun({ text: job.org, italics: true }), job.location),
			...job.bullets.map(bullet),
		);
	});

	body.push(heading("Honors & Awards"), ...cv.honors.map(bullet));

	return new Document({
		creator: cv.name,
		title: `${cv.name} Resume`,
		styles: {
			default: {
				document: {
					run: { font: FONT, size: BODY_SIZE },
					// 1.25x line spacing, tuned with the larger spacing above so the page is ~93% full.
					paragraph: { spacing: { line: 300 } },
				},
			},
		},
		sections: [
			{
				properties: {
					page: {
						size: { width: 8.5 * INCH, height: 11 * INCH },
						margin: {
							top: MARGIN,
							bottom: MARGIN,
							left: MARGIN,
							right: MARGIN,
						},
					},
				},
				children: body,
			},
		],
	});
}

export function cvDocxBlob(cv: Cv = CV): Promise<Blob> {
	return Packer.toBlob(buildCvDocument(cv));
}
