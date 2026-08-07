import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import sharp from "sharp";

import {
  checkBrandAssets,
  renderBrandAssets,
} from "../scripts/render-brand.mjs";

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0B1020"/>
</svg>\n`;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 80">
  <rect width="80" height="80" fill="#0B1020"/>
  <text x="92" y="52" font-size="38">Evalorium</text>
</svg>\n`;

async function createBrandFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "evalorium-brand-"));
  const brandDir = path.join(root, "docs", "assets", "brand");
  await mkdir(brandDir, { recursive: true });
  await writeFile(path.join(brandDir, "evalorium-mark.svg"), MARK_SVG);
  await writeFile(path.join(brandDir, "evalorium-logo.svg"), LOGO_SVG);
  return root;
}

test("renderBrandAssets creates PNG derivatives at required dimensions", async () => {
  const root = await createBrandFixture();

  await renderBrandAssets(root);

  const mark = await sharp(
    path.join(root, "docs", "assets", "brand", "evalorium-mark-512.png"),
  ).metadata();
  const logo = await sharp(
    path.join(root, "docs", "assets", "brand", "evalorium-logo.png"),
  ).metadata();
  assert.equal(mark.format, "png");
  assert.equal(mark.width, 512);
  assert.equal(mark.height, 512);
  assert.equal(logo.format, "png");
  assert.equal(logo.width, 1440);
  assert.equal(logo.height, 320);
});

test("checkBrandAssets reports a stale committed derivative", async () => {
  const root = await createBrandFixture();
  await renderBrandAssets(root);
  await writeFile(
    path.join(root, "docs", "assets", "brand", "evalorium-logo.png"),
    Buffer.from("stale"),
  );

  const errors = await checkBrandAssets(root);

  assert.match(errors.join("\n"), /stale brand derivative.*evalorium-logo\.png/);
});

test("formal horizontal logos do not depend on platform fonts", async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, "..");
  for (const name of ["evalorium-logo.svg", "evalorium-logo-dark.svg"]) {
    const source = await readFile(
      path.join(repositoryRoot, "docs", "assets", "brand", name),
      "utf8",
    );
    assert.doesNotMatch(source, /<text\b|font-family/i, name);
  }
});
