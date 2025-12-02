#!/usr/bin/env ts-node
/**
 * Scaffolds a React component.
 *
 * USAGE ─────────────────────────────────────────────────────────────
 *   add component Posts                   (defaults to --Props:compact)
 *   add component Posts:PostCard --Props:excluded
 *   add component Posts:PostCard --Props:compact
 *   add component Posts:PostCard --Props:centralized
 */

import fs from "fs";
import path from "path";
import { exit } from "process";
import { updateIndexFile } from "../src/helpers/updateIndexFile";

// ────────────────────────────────────────────────────────────────────
// CONFIG  ❱  tweak these if your paths differ
// ────────────────────────────────────────────────────────────────────
const COMPONENT_ROOT = path.resolve("src/components");
const TYPES_ROOT = path.resolve("src/interfaces");
const TYPES_ALIAS = "@interfaces"; // tsconfig paths alias

console.log("COMPONENT_ROOT resolved to:", COMPONENT_ROOT);
console.log("TYPES_ROOT resolved to:", TYPES_ROOT);
// ────────────────────────────────────────────────────────────────────

/* ------------------------------------------------------------------ */
/* argv parsing                                                        */
/* ------------------------------------------------------------------ */
const [, , entity, rawName, ...flags] = process.argv;

if (entity !== "component" || !rawName) {
  console.error(
    "Usage: add component Name[:SubName] [--Props:excluded|compact|centralized]"
  );
  exit(1);
}

const propsFlag =
  flags.find((f) => f.startsWith("--Props:"))?.split(":")[1] ?? "compact";

if (!["excluded", "compact", "centralized"].includes(propsFlag)) {
  console.error(
    "✖︎  Unknown --Props mode. Use excluded | compact | centralized"
  );
  exit(1);
}

const [parent, child] = rawName.split(":"); // Posts | Posts:PostCard
const componentName = child ?? parent;
const targetDir = child ? path.join(COMPONENT_ROOT, parent) : COMPONENT_ROOT;
const targetFile = path.join(targetDir, `${componentName}.tsx`);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createFile(file: string, content: string) {
  if (fs.existsSync(file)) {
    console.error(`✖︎  ${file} already exists`);
    exit(1);
  }
  fs.writeFileSync(file, content);
  console.log(`✔︎  Created ${path.relative(process.cwd(), file)}`);
}

function pascalify(name: string) {
  // ensure first letter is upper-case (in case CLI got "posts")
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/* ------------------------------------------------------------------ */
/* template builders                                                   */
/* ------------------------------------------------------------------ */
function componentTemplate(name: string, mode: string) {
  const n = pascalify(name);

  if (mode === "excluded") {
    return `import React from "react";

const ${n} = () => {
  return <div>${n}</div>;
};

export default ${n};
`;
  }

  if (mode === "compact") {
    return `import React from "react";

export interface ${n}Props {}

const ${n}: React.FC<${n}Props> = () => {
  return <div>${n}</div>;
};

export default ${n};
`;
  }

  // centralized
  return `import React from "react";
import type { ${n}Props } from "${TYPES_ALIAS}";

const ${n}: React.FC<${n}Props> = () => {
  return <div>${n}</div>;
};

export default ${n};
`;
}

function centralizedTypesPath(parent: string | undefined, comp: string) {
  if (parent) {
    return path.join(TYPES_ROOT, "components", parent, `${comp}.ts`);
  }
  return path.join(TYPES_ROOT, "components", `${comp}.ts`);
}

function typesInterfaceTemplate(name: string) {
  return `export interface ${pascalify(name)}Props {}
`;
}

function appendToTypesIndex(relPath: string) {
  const indexPath = path.join(TYPES_ROOT, "index.ts");
  const exportLine = `export * from "./${relPath}";`;

  let current = "";
  if (fs.existsSync(indexPath)) {
    current = fs.readFileSync(indexPath, "utf8");
    if (current.includes(exportLine)) return; // already exported
  }

  fs.writeFileSync(
    indexPath,
    current ? `${current.trimEnd()}\n${exportLine}\n` : `${exportLine}\n`
  );

  console.log(`✔︎  Updated ${path.relative(process.cwd(), indexPath)}`);
}

/* ------------------------------------------------------------------ */
/* execution                                                           */
/* ------------------------------------------------------------------ */
ensureDir(targetDir);
createFile(targetFile, componentTemplate(componentName, propsFlag));

if (propsFlag === "centralized") {
  const typesFile = centralizedTypesPath(
    child ? parent : undefined,
    componentName
  );
  ensureDir(path.dirname(typesFile));
  createFile(typesFile, typesInterfaceTemplate(componentName));

  // Update index.ts files at all relevant levels
  updateIndexFile(path.dirname(typesFile)); // e.g., components/Posts
  updateIndexFile(path.dirname(path.dirname(typesFile))); // e.g., components
  updateIndexFile(TYPES_ROOT); // interfaces root

  // turn path into POSIX-style and drop .ts extension
  const rel = path
    .relative(TYPES_ROOT, typesFile)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");

  appendToTypesIndex(rel);
}
