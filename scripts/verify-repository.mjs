import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { parse as parseYaml } from "yaml";

import { verifyAcademyUnit } from "./verify-academy-unit.mjs";

const IGNORED_DIRECTORIES = new Set([
  ".brand-build",
  ".git",
  ".superpowers",
  "checkouts",
  "node_modules",
]);

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".txt",
  ".yaml",
  ".yml",
]);

const TEXT_BASENAMES = new Set([
  ".editorconfig",
  ".env",
  ".env.local",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  "LICENSE",
]);

export const requiredBrandFiles = [
  "docs/assets/brand/evalorium-mark.svg",
  "docs/assets/brand/evalorium-mark-mono.svg",
  "docs/assets/brand/evalorium-logo.svg",
  "docs/assets/brand/evalorium-logo-dark.svg",
  "docs/assets/brand/evalorium-logo.png",
  "docs/assets/brand/evalorium-mark-512.png",
  "docs/assets/brand/source-concept.png",
];

const STATE_PATHS = [
  "schema_version",
  "project",
  "program",
  "current.phase",
  "current.chapter",
  "current.unit",
  "current.status",
  "delivery.status",
  "toolchain.node",
  "synchronization.source_of_truth",
  "next_actions",
  "publication.repository",
];

const CREDENTIAL_PATTERNS = [
  /gh[opusr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /npm_[A-Za-z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /(?:^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\/\/[^\s=]+\/:_authToken\s*=\s*[^${\s][^\s]*/g,
];

const PROGRESS_MIRROR_PATHS = [
  "README.zh-CN.md",
  "START_HERE.md",
  "academy/README.md",
  "academy/curriculum/README.md",
  "docs/PROJECT_MATURITY.md",
  "progress/PROGRESS.md",
  "progress/competency-matrix.md",
  "handoffs/CURRENT.md",
];

function relative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function isTextFile(filePath) {
  return (
    TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ||
    TEXT_BASENAMES.has(path.basename(filePath))
  );
}

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], value);
}

async function verifyUtf8(rootDir, files, errors) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const filePath of files.filter(isTextFile)) {
    try {
      decoder.decode(await readFile(filePath));
    } catch {
      errors.push(`${relative(rootDir, filePath)}: invalid UTF-8`);
    }
  }
}

async function verifyMarkdownLinks(rootDir, files, errors) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const markdownFiles = files.filter((filePath) => path.extname(filePath) === ".md");
  const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const filePath of markdownFiles) {
    let source;
    try {
      source = decoder.decode(await readFile(filePath));
    } catch {
      continue;
    }
    for (const match of source.matchAll(linkPattern)) {
      let target = match[1].trim();
      if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1);
      }
      if (
        !target ||
        target.startsWith("#") ||
        /^(?:https?:|mailto:)/i.test(target)
      ) {
        continue;
      }
      target = target.split("#", 1)[0].split("?", 1)[0];
      try {
        target = decodeURIComponent(target);
      } catch {
        errors.push(`${relative(rootDir, filePath)}: invalid encoded Markdown target ${target}`);
        continue;
      }
      const resolved = path.resolve(path.dirname(filePath), target);
      if (!(await pathExists(resolved))) {
        errors.push(
          `${relative(rootDir, filePath)}: missing Markdown target ${target}`,
        );
      }
    }
  }
}

async function verifyStateYaml(rootDir, errors) {
  const statePath = path.join(rootDir, "progress", "state.yaml");
  if (!(await pathExists(statePath))) {
    errors.push("progress/state.yaml: missing state file");
    return;
  }

  let state;
  try {
    state = parseYaml(await readFile(statePath, "utf8"));
  } catch (error) {
    errors.push(`progress/state.yaml: invalid YAML (${error.message})`);
    return;
  }

  for (const requiredPath of STATE_PATHS) {
    const value = getPath(state, requiredPath);
    if (value === undefined || value === null || value === "") {
      errors.push(`progress/state.yaml: missing required key ${requiredPath}`);
    }
  }
  if (!Array.isArray(state?.next_actions) || state.next_actions.length === 0) {
    errors.push("progress/state.yaml: next_actions must be a non-empty array");
  }
}

async function verifyProgressMirrors(rootDir, errors) {
  const statePath = path.join(rootDir, "progress", "state.yaml");
  if (!(await pathExists(statePath))) return;

  let state;
  try {
    state = parseYaml(await readFile(statePath, "utf8"));
  } catch {
    return;
  }

  const expectedMarker = [
    "<!-- evalorium-progress",
    `current=${state?.current?.unit}`,
    `current_status=${state?.current?.status}`,
    `last_completed=${state?.last_completed?.unit}`,
    `last_status=${state?.last_completed?.status}`,
    "-->",
  ].join(" ");

  for (const mirrorPath of PROGRESS_MIRROR_PATHS) {
    const absolutePath = path.join(rootDir, mirrorPath);
    if (!(await pathExists(absolutePath))) {
      errors.push(`${mirrorPath}: missing required progress mirror`);
      continue;
    }
    const source = await readFile(absolutePath, "utf8");
    if (!source.includes(expectedMarker)) {
      errors.push(`${mirrorPath}: missing or stale progress marker ${expectedMarker}`);
    }
  }
}

async function verifySvgSafety(rootDir, files, errors) {
  const unsafePattern = /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:|(?:href|src)\s*=\s*["']https?:|data:image/i;
  for (const filePath of files.filter((file) => path.extname(file) === ".svg")) {
    const source = await readFile(filePath, "utf8");
    if (unsafePattern.test(source)) {
      errors.push(`${relative(rootDir, filePath)}: unsafe SVG content`);
    }
  }
}

async function verifyBrandFiles(rootDir, errors) {
  for (const brandFile of requiredBrandFiles) {
    if (!(await pathExists(path.join(rootDir, brandFile)))) {
      errors.push(`${brandFile}: missing required brand file`);
    }
  }
}

async function verifyCredentialPatterns(rootDir, files, errors) {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (const filePath of files.filter(isTextFile)) {
    let source;
    try {
      source = decoder.decode(await readFile(filePath));
    } catch {
      continue;
    }
    for (const pattern of CREDENTIAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) {
        errors.push(`${relative(rootDir, filePath)}: possible credential`);
        break;
      }
    }
  }
}

async function verifyAcademyPackages(rootDir, files, errors) {
  const unitDirectories = new Set();
  const unitPattern = /^academy\/phase-[^/]+\/chapter-[^/]+\/unit-[^/]+\//;
  for (const filePath of files) {
    const repositoryPath = relative(rootDir, filePath);
    const match = repositoryPath.match(unitPattern);
    if (match) unitDirectories.add(match[0].slice(0, -1));
  }

  for (const unitDirectory of [...unitDirectories].sort()) {
    for (const error of await verifyAcademyUnit(path.join(rootDir, unitDirectory))) {
      errors.push(`${unitDirectory}/${error}`);
    }
  }
}

export async function verifyRepository(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const errors = [];
  const files = await collectFiles(resolvedRoot);
  await verifyUtf8(resolvedRoot, files, errors);
  await verifyMarkdownLinks(resolvedRoot, files, errors);
  await verifyStateYaml(resolvedRoot, errors);
  await verifyProgressMirrors(resolvedRoot, errors);
  await verifySvgSafety(resolvedRoot, files, errors);
  await verifyBrandFiles(resolvedRoot, errors);
  await verifyCredentialPatterns(resolvedRoot, files, errors);
  await verifyAcademyPackages(resolvedRoot, files, errors);
  return errors;
}

async function main() {
  const errors = await verifyRepository(process.cwd());
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Repository verification passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
