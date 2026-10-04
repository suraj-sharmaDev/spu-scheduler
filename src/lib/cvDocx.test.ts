import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { CV } from "./cv";
import { buildCvDocument } from "./cvDocx";

describe("buildCvDocument", () => {
	it("writes the CV text into a valid .docx", async () => {
		const buf = await Packer.toBuffer(buildCvDocument());
		expect(buf.subarray(0, 2).toString()).toBe("PK");

		const file = join(mkdtempSync(join(tmpdir(), "cv-")), "cv.docx");
		writeFileSync(file, buf);
		const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
			encoding: "utf8",
		});
		expect(xml).toContain(CV.name);
		expect(xml).toContain(CV.email);
		expect(xml).toContain(CV.phone);
		for (const e of CV.education) expect(xml).toContain(e.school);
		for (const job of CV.leadership)
			for (const b of job.bullets) expect(xml).toContain(b);
		// The & must be escaped or Word refuses to open the file.
		expect(xml).toContain("HONORS &amp; AWARDS");
	});
});
