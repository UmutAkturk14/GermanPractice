import fs from "fs";
import path from "path";

function updateIndexFile(dir: string): boolean {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  const exportsFiles = files
    .filter(
      (f) => f.isFile() && f.name.endsWith(".ts") && f.name !== "index.ts",
    )
    .map((f) => `export * from "./${f.name.replace(/\.ts$/, "")}";`);

  const exportsDirs: string[] = [];

  for (const f of files) {
    if (f.isDirectory()) {
      const subDir = path.join(dir, f.name);
      const isSubUsed = updateIndexFile(subDir); // Recursively update
      if (isSubUsed) {
        exportsDirs.push(`export * from "./${f.name}";`);
      } else {
        // Folder is empty → delete it
        fs.rmdirSync(subDir);
        console.log(
          `✘  Removed empty folder ${path.relative(process.cwd(), subDir)}`,
        );
      }
    }
  }

  const contentLines = [...exportsFiles, ...exportsDirs];
  const content =
    contentLines.join("\n") + (contentLines.length > 0 ? "\n" : "");

  const indexPath = path.join(dir, "index.ts");
  const indexExists = fs.existsSync(indexPath);
  const current = indexExists ? fs.readFileSync(indexPath, "utf8") : "";

  if (contentLines.length === 0) {
    if (indexExists) {
      fs.unlinkSync(indexPath);
      console.log(
        `✘  Removed empty ${path.relative(process.cwd(), indexPath)}`,
      );
    }
    return false;
  }

  if (current.trim() !== content.trim()) {
    fs.writeFileSync(indexPath, content);
    console.log(`✔︎  Updated ${path.relative(process.cwd(), indexPath)}`);
  }

  return true;
}

export { updateIndexFile };
