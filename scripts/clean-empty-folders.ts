#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";

/**
 * Recursively removes empty directories from the given directory.
 * @param dir Path to the directory to clean.
 * @returns true if the directory was removed, false otherwise.
 */
function removeEmptyDirs(dir: string): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return false;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      removeEmptyDirs(fullPath);
    }
  }

  // After cleaning subfolders, check if current dir is empty
  const after = fs.readdirSync(dir);
  if (after.length === 0) {
    fs.rmdirSync(dir);
    console.log(`✔︎ Removed empty folder: ${path.relative(process.cwd(), dir)}`);
    return true;
  }

  return false;
}

const targetDir = process.argv[2] ?? process.cwd();

console.log(`Cleaning empty folders under: ${targetDir}`);

removeEmptyDirs(targetDir);
