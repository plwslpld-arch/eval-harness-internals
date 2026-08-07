import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";

const BRAND_PATH = path.join("docs", "assets", "brand");

function brandPaths(rootDir) {
  const brandDir = path.join(rootDir, BRAND_PATH);
  return {
    brandDir,
    logoPng: path.join(brandDir, "evalorium-logo.png"),
    logoSvg: path.join(brandDir, "evalorium-logo.svg"),
    markPng: path.join(brandDir, "evalorium-mark-512.png"),
    markSvg: path.join(brandDir, "evalorium-mark.svg"),
  };
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function renderBrandAssets(rootDir, outputRoot = rootDir) {
  const sources = brandPaths(path.resolve(rootDir));
  const outputs = brandPaths(path.resolve(outputRoot));
  await mkdir(outputs.brandDir, { recursive: true });
  await sharp(sources.markSvg).resize(512, 512).png().toFile(outputs.markPng);
  await sharp(sources.logoSvg)
    .resize({ width: 1440 })
    .png()
    .toFile(outputs.logoPng);
}

export async function checkBrandAssets(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const buildRoot = path.join(resolvedRoot, ".brand-build");
  const errors = [];
  try {
    await renderBrandAssets(resolvedRoot, buildRoot);
    const committed = brandPaths(resolvedRoot);
    const generated = brandPaths(buildRoot);
    for (const fileName of ["evalorium-mark-512.png", "evalorium-logo.png"]) {
      const committedPath = path.join(committed.brandDir, fileName);
      const generatedPath = path.join(generated.brandDir, fileName);
      let committedBytes;
      try {
        committedBytes = await readFile(committedPath);
      } catch {
        errors.push(`missing brand derivative: ${fileName}`);
        continue;
      }
      const generatedBytes = await readFile(generatedPath);
      if (sha256(committedBytes) !== sha256(generatedBytes)) {
        errors.push(`stale brand derivative: ${fileName}`);
      }
    }
  } finally {
    await rm(buildRoot, { recursive: true, force: true });
  }
  return errors;
}

async function main() {
  if (process.argv.includes("--check")) {
    const errors = await checkBrandAssets(process.cwd());
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(error);
      }
      process.exitCode = 1;
      return;
    }
    console.log("Brand derivatives are current.");
    return;
  }
  await renderBrandAssets(process.cwd());
  console.log("Brand derivatives rendered.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
