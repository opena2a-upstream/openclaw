#!/usr/bin/env node
// Checks tracked Markdown prose for punctuation the docs style avoids:
// spaced double hyphens used as dashes, em dashes, spaced en dashes, and
// "Why this exists" / "Why this matters" headings. Fenced code, inline code,
// front matter, HTML comments, URLs and badge lines are skipped.
// Usage: node scripts/check-docs-prose.mjs [--list]
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "vendor",
  "dist",
  "build",
  "test",
  "tests",
  "__tests__",
  "fixture",
  "fixtures",
  "corpus",
  "golden",
  "snapshot",
  "snapshots",
  "__snapshots__",
  "example",
  "examples",
]);

// Generated translations and CI config are not hand-edited prose.
const EXCLUDED_PREFIXES = ["docs/zh-CN/", ".github/", "changelog.d/"];

export function isExcludedPath(file) {
  if (EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }
  const parts = file.split("/");
  const base = parts[parts.length - 1];
  if (/^changelog\.md$/i.test(base) || /^license/i.test(base)) {
    return true;
  }
  return parts.slice(0, -1).some((dir) => EXCLUDED_DIRS.has(dir));
}

const RULES = [
  { re: / -- /, message: "spaced double hyphen used as a dash" },
  { re: /—/, message: "em dash" },
  { re: / – /, message: "spaced en dash" },
];
const WHY_HEADING = /^\s{0,3}#{1,6}\s*Why this (exists|matters)\b/i;

function stripInlineCode(line) {
  // Backtick runs open and close inline code; the closing run must match in length.
  return line.replace(/(`+)[^`]*?\1/g, " ");
}

function stripUrlsAndBadges(line) {
  if (/^\s*(\[!\[|!\[|<img\b|<a\b[^>]*>\s*<img\b)/.test(line)) {
    return "";
  }
  return line.replace(/\bhttps?:\/\/\S+/g, " ");
}

/**
 * Returns findings for one Markdown document as { line, message } entries.
 */
export function scanMarkdown(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  let fence = null;
  let inComment = false;
  let inFrontMatter = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (i === 0 && /^---\s*$/.test(raw)) {
      inFrontMatter = true;
      continue;
    }
    if (inFrontMatter) {
      if (/^---\s*$/.test(raw)) {
        inFrontMatter = false;
      }
      continue;
    }
    const fenceMatch = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    let line = raw;
    if (inComment) {
      const end = line.indexOf("-->");
      if (end === -1) {
        continue;
      }
      line = line.slice(end + 3);
      inComment = false;
    }
    line = line.replace(/<!--[\s\S]*?-->/g, " ");
    const commentStart = line.indexOf("<!--");
    if (commentStart !== -1) {
      line = line.slice(0, commentStart);
      inComment = true;
    }
    if (WHY_HEADING.test(line)) {
      findings.push({ line: lineNo, message: 'heading named "Why this exists"' });
      continue;
    }
    line = stripUrlsAndBadges(stripInlineCode(line));
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        findings.push({ line: lineNo, message: rule.message });
      }
    }
  }
  return findings;
}

export function listTrackedMarkdown(cwd) {
  const result = spawnSync("git", ["ls-files", "-z", "--", "*.md", "*.mdx"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return result.stdout
    .split("\0")
    .filter((file) => file.length > 0)
    .filter((file) => !isExcludedPath(file));
}

function main() {
  const cwd = process.cwd();
  const listOnly = process.argv.includes("--list");
  const files = listTrackedMarkdown(cwd);
  if (listOnly) {
    for (const file of files) {
      console.log(file);
    }
    return 0;
  }
  let count = 0;
  for (const file of files) {
    const findings = scanMarkdown(readFileSync(file, "utf8"));
    for (const finding of findings) {
      count += 1;
      console.log(`${file}:${finding.line}: ${finding.message}`);
    }
  }
  if (count > 0) {
    console.error(`check-docs-prose: ${count} finding(s) in ${files.length} file(s)`);
    return 1;
  }
  console.log(`check-docs-prose: ${files.length} file(s) clean`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
