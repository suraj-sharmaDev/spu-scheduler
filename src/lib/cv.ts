/** Resume content for /cv. Edit here; the page only handles layout. */

export interface CvLink {
	label: string;
	href: string;
}

export interface CvEducation {
	school: string;
	location: string;
	degree: string;
	dates: string;
	gpa?: number;
	details?: string[];
}

export interface CvExperience {
	title: string;
	org: string;
	location: string;
	dates: string;
	bullets: string[];
}

export interface CvSkillGroup {
	label: string;
	items: string[];
}

export interface Cv {
	name: string;
	location: string;
	email: string;
	/** Display format; digits are reused for the tel: link. */
	phone: string;
	links: CvLink[];
	summary: string;
	education: CvEducation[];
	/** Section is hidden while empty. */
	coursework: string[];
	skills: CvSkillGroup[];
	leadership: CvExperience[];
	honors: string[];
}

export const CV: Cv = {
	name: "Samanata Kathayat",
	location: "Seattle, WA",
	email: "samanatakathayat00@gmail.com",
	phone: "(206) 538-7583",
	links: [
		{
			label: "linkedin.com/in/samanata-kathayat-0003422aa",
			href: "https://www.linkedin.com/in/samanata-kathayat-0003422aa/",
		},
	],
	summary:
		"Computer Science student at Seattle Pacific University (Bachelor of Science, expected December 2028) and Phi Theta Kappa honor society member with a 3.96+ GPA record, seeking a Summer 2027 software engineering internship. Brings a foundation in C++ and web fundamentals (HTML, CSS) and hands-on student leadership experience in budget management and event coordination.",
	education: [
		{
			school: "Seattle Pacific University",
			location: "Seattle, WA",
			degree: "Bachelor of Science in Computer Science",
			dates: "Sep 2026 – Expected Dec 2028",
		},
		{
			school: "North Seattle College",
			location: "Seattle, WA",
			degree:
				"Transfer coursework toward Bachelor of Science in Computer Science",
			dates: "Jan 2025 – Jun 2026",
			gpa: 3.96,
		},
		{
			school: "Huston-Tillotson University",
			location: "Austin, TX",
			degree: "Undergraduate coursework in Computer Science",
			dates: "2024",
			gpa: 4.0,
		},
	],
	coursework: [],
	skills: [
		{ label: "Programming Languages", items: ["C++"] },
		{ label: "Web", items: ["HTML", "CSS"] },
		{
			label: "Professional",
			items: [
				"Budget Management",
				"Event Coordination",
				"Team Collaboration",
				"Communication",
			],
		},
	],
	leadership: [
		{
			title: "Student Leader",
			org: "Student Leadership & Engagement Office, North Seattle College",
			location: "Seattle, WA",
			dates: "2025 – 2026",
			bullets: [
				"Managed and tracked a $500K budget across 10+ student departments, keeping spending within approved limits.",
				"Coordinated campus events end to end, including planning, room and vendor logistics, promotion, and day-of execution.",
				"Collaborated with staff and fellow student leaders to plan programming that increased student engagement.",
			],
		},
	],
	honors: [
		"Merit Scholarship, Seattle Pacific University ($23,000)",
		"DTA Scholarship, Seattle Pacific University ($3,000)",
		"Phi Theta Kappa Scholarship, Seattle Pacific University ($2,000)",
		"North Seattle College Commitment Scholarship ($3,400)",
		"Phi Theta Kappa Honor Society, Member",
	],
};

export function phoneHref(phone: string): string {
	return `tel:+1${phone.replace(/\D/g, "")}`;
}

export function formatGpa(gpa: number): string {
	return `${gpa.toFixed(2)}/4.00`;
}
