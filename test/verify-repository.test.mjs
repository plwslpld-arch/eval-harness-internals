import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyRepository } from "../scripts/verify-repository.mjs";

const SAFE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>Fixture mark</title>
  <rect width="64" height="64" fill="#0B1020"/>
</svg>\n`;

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function write(root, relativePath, content) {
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content);
}

async function createValidFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-verify-"));
  await write(root, "README.md", "# Fixture\n\n[Docs](docs/README.md)\n");
  await write(root, "docs/README.md", "# Docs\n");
  await write(
    root,
    "progress/state.yaml",
    `schema_version: 1
project: Evalorium
program:
  phases: 8
current:
  phase: A
  chapter: A1
  unit: A1.1
  status: in_progress
delivery:
  status: in_progress
next_actions:
  - learn A1.1
publication:
  repository: https://github.com/example/evalorium
`,
  );

  const brandRoot = "docs/assets/brand";
  for (const name of [
    "evalorium-mark.svg",
    "evalorium-mark-mono.svg",
    "evalorium-logo.svg",
    "evalorium-logo-dark.svg",
  ]) {
    await write(root, `${brandRoot}/${name}`, SAFE_SVG);
  }
  for (const name of [
    "evalorium-logo.png",
    "evalorium-mark-512.png",
    "source-concept.png",
  ]) {
    await write(root, `${brandRoot}/${name}`, ONE_PIXEL_PNG);
  }
  return root;
}

test("a valid repository fixture has no errors", async () => {
  const root = await createValidFixture();

  assert.deepEqual(await verifyRepository(root), []);
});

test("a missing relative Markdown target is reported", async () => {
  const root = await createValidFixture();
  await write(root, "README.md", "# Fixture\n\n[Missing](docs/missing.md)\n");

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /missing Markdown target/);
});

test("invalid UTF-8 is reported", async () => {
  const root = await createValidFixture();
  await write(root, "bad.md", Buffer.from([0xc3, 0x28]));

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /invalid UTF-8/);
});

test("missing state keys are reported", async () => {
  const root = await createValidFixture();
  await write(root, "progress/state.yaml", "schema_version: 1\nproject: Evalorium\n");

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /current\.unit/);
});

test("public progress state uses artifact delivery status rather than personal assessment", async () => {
  const root = await createValidFixture();

  const errors = await verifyRepository(root);

  assert.doesNotMatch(errors.join("\n"), /assessment\.status/);
  assert.doesNotMatch(errors.join("\n"), /delivery\.status/);
});

test("unsafe SVG content is reported", async () => {
  const root = await createValidFixture();
  await write(
    root,
    "docs/assets/brand/evalorium-mark.svg",
    `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`,
  );

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /unsafe SVG/);
});

test("credential-shaped content is reported", async () => {
  const root = await createValidFixture();
  const syntheticCredential = "gho_" + "x".repeat(24);
  await write(root, "leak.md", `unsafe example: ${syntheticCredential}\n`);

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /possible credential/);
});

test("an Academy unit with an incomplete package is reported", async () => {
  const root = await createValidFixture();
  await write(
    root,
    "academy/phase-a/chapter-a1/unit-a1-1/README.md",
    "# Incomplete unit\n",
  );

  const errors = await verifyRepository(root);

  assert.match(errors.join("\n"), /unit-a1-1\/index\.html: missing required Academy unit artifact/);
});
