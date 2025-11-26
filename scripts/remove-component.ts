#!/usr/bin/env ts-node
/**
 * Removes a React component and its related types (if any).
 *
 * USAGE ─────────────────────────────────────────────────────────────
 *   remove component Posts
 *   remove component Posts:PostCard
 */

import fs from "fs";
import path from "path";
import { exit } from "process";
import { updateIndexFile } from "../src/helpers/updateIndexFile.ts";

const COMPONENT_ROOT = path.resolve("src/components");
const TYPES_ROOT = path.resolve("src/interfaces");

console.log("COMPONENT_ROOT resolved to:", COMPONENT_ROOT);
console.log("TYPES_ROOT resolved to:", TYPES_ROOT);

const [, , entity, rawName] = process.argv;

if (entity !== "component" || !rawName) {
  console.error("Usage: remove component Name[:SubName]");
  exit(1);
}

const [parent, child] = rawName.split(":");
const componentName = child ?? parent;
const componentDir = child ? path.join(COMPONENT_ROOT, parent) : COMPONENT_ROOT;
const componentFile = path.join(componentDir, `${componentName}.tsx`);

function deleteFileIfExists(filePath: string) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✔︎  Deleted ${path.relative(process.cwd(), filePath)}`);
  } else {
    console.warn(
      `⚠︎  File ${path.relative(process.cwd(), filePath)} does not exist`,
    );
  }
}

function isDirEmpty(dirPath: string) {
  return fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0;
}

function deleteDirIfEmptyRecursive(dirPath: string) {
  if (!fs.existsSync(dirPath)) return;

  if (isDirEmpty(dirPath)) {
    fs.rmdirSync(dirPath);
    console.log(
      `✔︎  Removed empty directory ${path.relative(process.cwd(), dirPath)}`,
    );
    // Recurse upwards
    deleteDirIfEmptyRecursive(path.dirname(dirPath));
  }
}

function deleteIndexIfEmpty(dirPath: string) {
  const indexFile = path.join(dirPath, "index.ts");
  if (fs.existsSync(indexFile)) {
    const content = fs.readFileSync(indexFile, "utf-8").trim();
    if (content === "") {
      fs.unlinkSync(indexFile);
      console.log(
        `✔︎  Deleted empty index.ts at ${path.relative(process.cwd(), indexFile)}`,
      );
      // After deleting index, check if directory became empty
      deleteDirIfEmptyRecursive(dirPath);
    }
  }
}

function removeTypesFiles() {
  const typesDir = child
    ? path.join(TYPES_ROOT, "components", parent)
    : path.join(TYPES_ROOT, "components");
  const typesFile = path.join(typesDir, `${componentName}.ts`);

  if (fs.existsSync(typesFile)) {
    fs.unlinkSync(typesFile);
    console.log(
      `✔︎  Deleted types file ${path.relative(process.cwd(), typesFile)}`,
    );

    // Update index files after removing type file
    if (fs.existsSync(typesDir)) {
      updateIndexFile(typesDir);
    }
    if (fs.existsSync(path.dirname(typesDir))) {
      updateIndexFile(path.dirname(typesDir));
    }
    if (fs.existsSync(TYPES_ROOT)) {
      updateIndexFile(TYPES_ROOT);
    }

    // Remove empty index.ts files and empty folders recursively
    deleteIndexIfEmpty(typesDir);
    deleteIndexIfEmpty(path.dirname(typesDir));
    deleteIndexIfEmpty(TYPES_ROOT);
  } else {
    console.warn(
      `⚠︎  Types file ${path.relative(process.cwd(), typesFile)} does not exist`,
    );
  }
}

// Remove the component file
deleteFileIfExists(componentFile);

// Remove component directory if empty (only if it was a subfolder)
if (child) {
  deleteDirIfEmptyRecursive(componentDir);
}

// Remove types file & clean up
removeTypesFiles();

function cleanIndexIfEmpty(indexPath: string) {
  if (!fs.existsSync(indexPath)) return;
  const content = fs.readFileSync(indexPath, "utf-8").trim();
  if (content === "") {
    fs.unlinkSync(indexPath);
    console.log(
      `✔︎  Deleted empty index.ts at ${path.relative(process.cwd(), indexPath)}`,
    );
  }
}

// ... inside removeTypesFiles after updateIndexFile calls:

const interfacesComponentsIndex = path.join(
  TYPES_ROOT,
  "components",
  "index.ts",
);

cleanIndexIfEmpty(interfacesComponentsIndex);
deleteDirIfEmptyRecursive(path.dirname(interfacesComponentsIndex)); // clean empty folders if any
