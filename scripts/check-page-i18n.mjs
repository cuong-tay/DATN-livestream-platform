import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const pagesDir = join(root, "src", "pages");
const shouldFail = process.argv.includes("--fail");
const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (/\.tsx?$/.test(entry)) {
      files.push(fullPath);
    }
  }
}

function stripSafeFragments(line) {
  return line
    .replace(/className=("[^"]*"|\{[^}]*\})/g, "")
    .replace(/(?:href|to|src|id|htmlFor|type|value|variant|size|key|accept|inputMode|maxLength)=\{?"[^"]*"\}?/g, "")
    .replace(/t\("[^"]+"(?:,\s*\{[^}]*\})?\)/g, "")
    .replace(/import\s+.*from\s+"[^"]+";?/g, "")
    .replace(/\/\/.*$/g, "");
}

const textNodePattern = />\s*([^<>{}\n]*[A-Za-zÀ-ỹ][^<>{}\n]*)\s*</g;
const attrPattern = /\b(?:placeholder|aria-label|title|alt)=\s*"([^"]*[A-Za-zÀ-ỹ][^"]*)"/g;
const toastPattern = /toast\.(?:success|error|info|warning)\(\s*["'`]/g;
const vietnamesePattern = /[À-ỹ]/;
const suspiciousEnglishWords = /\b(?:Loading|Create|Update|Delete|Cancel|Save|Search|Report|Reports|Category|Categories|Password|Profile|Email|Actions|Previous|Next|Empty|No\s+|Back|Home)\b/;
const findings = [];

walk(pagesDir);

for (const file of files) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = stripSafeFragments(rawLine);
    if (!line.trim()) return;

    if (toastPattern.test(line)) {
      findings.push({ rel, line: index + 1, reason: "direct toast string", text: rawLine.trim() });
    }
    toastPattern.lastIndex = 0;

    for (const match of line.matchAll(attrPattern)) {
      findings.push({ rel, line: index + 1, reason: "literal UI attribute", text: match[0].trim() });
    }

    for (const match of line.matchAll(textNodePattern)) {
      const text = match[1].trim();
      if (!text || text.length < 2) continue;
      if (vietnamesePattern.test(text) || suspiciousEnglishWords.test(text)) {
        findings.push({ rel, line: index + 1, reason: "literal JSX text", text });
      }
    }
  });
}

if (findings.length === 0) {
  console.log("i18n page check: no obvious hard-coded user-facing text found.");
  process.exit(0);
}

console.log(`i18n page check: found ${findings.length} possible hard-coded text item(s).`);
for (const item of findings.slice(0, 200)) {
  console.log(`${item.rel}:${item.line} [${item.reason}] ${item.text}`);
}
if (findings.length > 200) {
  console.log(`...and ${findings.length - 200} more.`);
}

if (shouldFail) {
  process.exit(1);
}
