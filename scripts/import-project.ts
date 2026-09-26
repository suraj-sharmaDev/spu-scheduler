/**
 * Learning tracker — project importer (run manually).
 *
 *   pnpm import-project docs/projects/Cpp_Developer_Plan.xlsx cpp-developer "C++ Developer Plan"
 *
 * Reads a plan workbook (sheets: Start Here, Roadmap, Plan, Concepts, Weekly
 * Reflection, Project Review, Resources) and writes
 * src/data/projects/<slug>.json. The Progress sheet is not imported: the app
 * computes progress from the database.
 *
 * Fails loudly and writes nothing if a sheet or column is missing or the result
 * doesn't validate. Task and checklist ids come from session numbers and line
 * order, so reordering steps in the workbook moves saved ticks with them.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"
import ExcelJS from "exceljs"
import {
  orNull,
  parseConceptCell,
  parseLevel,
  slugify,
  splitChecklist,
  splitLines,
  splitWhatToDo,
} from "../src/lib/tracker/parse.ts"
import type {
  Concept,
  GuideItem,
  GuideSection,
  Milestone,
  Project,
  Resource,
  Task,
  Template,
} from "../src/lib/tracker/types.ts"
import { validateProject } from "../src/lib/tracker/validate.ts"

// Start Here sections that describe the spreadsheet itself, not the plan.
const SKIPPED_GUIDE_SECTIONS = new Set(["The tabs"])
const TEMPLATE_SECTION = /^templates/i

type Row = string[]

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  if ("richText" in value) return value.richText.map((r) => r.text).join("")
  if ("formula" in value || "sharedFormula" in value) {
    return cellText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
  }
  if ("hyperlink" in value) return String(value.text)
  if ("error" in value) return ""
  throw new Error(`Unsupported cell value: ${JSON.stringify(value)}`)
}

/** All rows as trimmed-right strings, index 0 = column A. Row 1 is rows[0]. */
function readRows(wb: ExcelJS.Workbook, name: string): Row[] {
  const ws = wb.getWorksheet(name)
  if (!ws) throw new Error(`Missing sheet "${name}"`)
  const rows: Row[] = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const cells: string[] = []
    for (let c = 1; c <= ws.columnCount; c++) {
      cells.push(cellText(row.getCell(c).value).replace(/\s+$/, ""))
    }
    rows.push(cells)
  }
  return rows
}

/** Map required header names (matched on the header's first line, case-insensitive prefix) to column indexes. */
function columns<K extends string>(header: Row, wanted: Record<K, string>): Record<K, number> {
  const out = {} as Record<K, number>
  const firstLines = header.map((h) => h.split("\n")[0].trim().toLowerCase())
  for (const [key, label] of Object.entries(wanted) as [K, string][]) {
    const idx = firstLines.findIndex((h) => h.startsWith(label.toLowerCase()))
    if (idx < 0) throw new Error(`Missing column "${label}" (have: ${firstLines.join(" | ")})`)
    out[key] = idx
  }
  return out
}

function toInt(text: string, what: string): number {
  const n = Number(text)
  if (!Number.isInteger(n)) throw new Error(`${what}: expected a whole number, got "${text}"`)
  return n
}

// ---------------------------------------------------------------------------

function parseConcepts(rows: Row[]): Concept[] {
  const col = columns(rows[0], {
    name: "Concept",
    type: "Type",
    plain: "In plain English",
    example: "Everyday example",
    why: "Why developers care",
    learnMore: "Learn more",
  })
  return rows
    .slice(1)
    .filter((r) => r[col.name])
    .map((r) => ({
      id: slugify(r[col.name]),
      name: r[col.name].trim(),
      type: r[col.type],
      plain: r[col.plain],
      example: r[col.example],
      why: r[col.why],
      learnMore: orNull(r[col.learnMore]),
    }))
}

function parseRoadmap(rows: Row[]): { milestones: Milestone[]; note: string | null } {
  const col = columns(rows[0], {
    week: "Week",
    subproject: "Project",
    bigQuestion: "Big question",
    outcome: "By the end",
    guidance: "Guidance",
  })
  const milestones: Milestone[] = []
  let note: string | null = null
  for (const r of rows.slice(1)) {
    if (/^\d+$/.test(r[col.week])) {
      const number = toInt(r[col.week], "Roadmap week")
      milestones.push({
        id: `w${number}`,
        number,
        subproject: r[col.subproject],
        bigQuestion: r[col.bigQuestion],
        outcome: r[col.outcome],
        guidance: r[col.guidance],
      })
    } else if (r[0] && !r.slice(1).some(Boolean)) {
      note = r[0]
    }
  }
  return { milestones, note }
}

function parsePlan(rows: Row[]): Task[] {
  const col = columns(rows[0], {
    number: "#",
    week: "Week",
    session: "Session",
    title: "Task",
    whatToDo: "What to do",
    concepts: "Concepts today",
    thinkAbout: "Think about",
    doneWhen: "Done when",
    level: "Level",
  })
  const tasks: Task[] = []
  for (const r of rows.slice(1)) {
    // Week dividers ("WEEK 1 · …") are merged across the row, so every cell
    // repeats column A.
    if (!r[col.title] || r[col.title] === r[0]) continue
    const number = toInt(r[col.number], `Plan row "${r[col.title]}"`)
    const id = `s${number}`
    const { intro, steps } = splitWhatToDo(r[col.whatToDo], `${id}.do`)
    tasks.push({
      id,
      number,
      milestoneId: `w${toInt(r[col.week], `${id} week`)}`,
      sessionInMilestone: toInt(r[col.session], `${id} session`),
      title: r[col.title].trim(),
      intro,
      steps,
      concepts: parseConceptCell(r[col.concepts]).map((c) => ({
        conceptId: slugify(c.name),
        isNew: c.isNew,
      })),
      thinkAbout: splitLines(r[col.thinkAbout]),
      doneWhen: splitChecklist(r[col.doneWhen], `${id}.done`),
      level: parseLevel(r[col.level]),
      checkpoint: /^checkpoint/i.test(r[col.title].trim()),
    })
  }
  return tasks
}

function parseStartHere(rows: Row[]): {
  title: string
  about: GuideItem[]
  guide: GuideSection[]
  templates: Template[]
} {
  const title = rows[0][0].trim()
  if (!title) throw new Error("Start Here: missing title in A1")
  const about: GuideItem[] = []
  const guide: GuideSection[] = []
  const templates: Template[] = []
  let section: GuideSection | null = null

  for (const [a, b] of rows.slice(1)) {
    if (!a) continue
    if (!b) {
      section = { title: a.trim(), items: [] }
      guide.push(section)
      continue
    }
    const item = { label: a.trim(), text: b }
    if (!section) about.push(item)
    else if (TEMPLATE_SECTION.test(section.title)) templates.push({ name: item.label, body: b })
    else section.items.push(item)
  }

  return {
    title,
    about,
    guide: guide.filter(
      (s) => s.items.length > 0 && !SKIPPED_GUIDE_SECTIONS.has(s.title),
    ),
    templates,
  }
}

function parseWeeklyQuestions(rows: Row[]): string[] {
  const header = rows[0].map((h) => h.trim()).filter(Boolean)
  if (!header.some((h) => /confidence/i.test(h))) {
    throw new Error('Weekly Reflection: missing "Confidence" column')
  }
  return header.filter((h) => !/^(week|project)$/i.test(h) && !/confidence/i.test(h))
}

function parseProjectReview(rows: Row[]): { questions: string[]; subjects: string[] } {
  const subjects = rows[0].slice(1).map((s) => s.trim()).filter(Boolean)
  const questions = rows
    .slice(1)
    .map((r) => r[0].replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
  if (subjects.length === 0 || questions.length === 0) {
    throw new Error("Project Review: expected subjects in row 1 and questions in column A")
  }
  return { questions, subjects }
}

function parseResources(rows: Row[]): { resources: Resource[]; tips: string[] } {
  const col = columns(rows[0], { name: "Resource", link: "Link", use: "Use it for" })
  const resources: Resource[] = []
  const tips: string[] = []
  let inTips = false
  for (const r of rows.slice(1)) {
    if (!r[col.name]) continue
    if (!r[col.link] && !r[col.use]) {
      // A lone column-A row is either the tips heading or a tip under it.
      if (inTips) tips.push(r[col.name].replace(/^•\s*/, ""))
      inTips = true
      continue
    }
    const link = orNull(r[col.link])
    resources.push({
      name: r[col.name],
      link: link && /^https?:\/\//.test(link) ? link : null,
      use: link && !/^https?:\/\//.test(link) ? `${link} ${r[col.use]}` : r[col.use],
    })
  }
  return { resources, tips }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [file, slug, titleArg] = process.argv.slice(2)
  if (!file || !slug) {
    throw new Error("Usage: import-project <workbook.xlsx> <slug> [title]")
  }

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)

  const start = parseStartHere(readRows(wb, "Start Here"))
  const roadmap = parseRoadmap(readRows(wb, "Roadmap"))
  const review = parseProjectReview(readRows(wb, "Project Review"))
  const resources = parseResources(readRows(wb, "Resources"))

  const project: Project = {
    slug,
    title: titleArg ?? start.title,
    source: basename(file),
    about: start.about,
    milestones: roadmap.milestones,
    tasks: parsePlan(readRows(wb, "Plan")),
    concepts: parseConcepts(readRows(wb, "Concepts")),
    guide: start.guide,
    templates: start.templates,
    resources: resources.resources,
    searchTips: resources.tips,
    roadmapNote: roadmap.note,
    reflection: {
      weeklyQuestions: parseWeeklyQuestions(readRows(wb, "Weekly Reflection")),
      reviewQuestions: review.questions,
      reviewSubjects: review.subjects,
    },
  }

  validateProject(project)

  const outDir = fileURLToPath(new URL("../src/data/projects/", import.meta.url))
  mkdirSync(outDir, { recursive: true })
  const outFile = `${outDir}${slug}.json`
  writeFileSync(outFile, `${JSON.stringify(project, null, 2)}\n`)
  console.log(
    `Wrote ${outFile}: ${project.milestones.length} milestones, ${project.tasks.length} tasks, ` +
      `${project.concepts.length} concepts, ${project.guide.length} guide sections`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
