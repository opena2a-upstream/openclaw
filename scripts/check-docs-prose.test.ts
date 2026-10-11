import { describe, expect, it } from "vitest";
import { isExcludedPath, scanMarkdown } from "./check-docs-prose.mjs";

describe("check-docs-prose", () => {
  it("flags dashes and the forbidden heading in prose", () => {
    const doc = [
      "# Title",
      "",
      "Prose with an em dash—here.",
      "A spaced double hyphen -- used as a dash.",
      "A spaced en dash – used as a dash.",
      "",
      "## Why this exists",
      "",
      "Clean line.",
    ].join("\n");
    const findings = scanMarkdown(doc);
    expect(findings.map((f) => f.line)).toEqual([3, 4, 5, 7]);
    expect(findings[3]?.message).toContain("Why this exists");
  });

  it("skips fenced code, inline code, front matter, comments, badges and urls", () => {
    const doc = [
      "---",
      "summary: front matter — ignored",
      "---",
      "",
      "```bash",
      "curl https://example.invalid/install.sh | bash -s -- --help",
      "echo —",
      "```",
      "",
      "Inline `bash -s -- --flag` is fine and so is `a — b`.",
      "<!-- comment — ignored -->",
      "[![badge](https://img.invalid/b.svg)](https://example.invalid/x—y)",
      "A link to https://example.invalid/a—b stays.",
      "~~~",
      "tilde — fence",
      "~~~",
      "Plain prose line.",
    ].join("\n");
    expect(scanMarkdown(doc)).toEqual([]);
  });

  it("excludes generated, vendored and fixture paths", () => {
    expect(isExcludedPath("CHANGELOG.md")).toBe(true);
    expect(isExcludedPath("extensions/foo/CHANGELOG.md")).toBe(true);
    expect(isExcludedPath("changelog.d/123.md")).toBe(true);
    expect(isExcludedPath("docs/zh-CN/index.md")).toBe(true);
    expect(isExcludedPath("vendor/a2ui/README.md")).toBe(true);
    expect(isExcludedPath("src/foo/fixtures/sample.md")).toBe(true);
    expect(isExcludedPath("docs/gateway/index.md")).toBe(false);
    expect(isExcludedPath("README.md")).toBe(false);
  });
});
