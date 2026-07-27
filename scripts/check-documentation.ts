import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { checkDocumentation } from "./documentation-check-core";

const projectRoot = resolve(process.cwd());

function label(file: string): string {
  return relative(projectRoot, file).split(sep).join("/");
}

function collectMarkdown(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectMarkdown(file));
    else if (entry.name.endsWith(".md")) files.push(file);
  }
  return files.sort();
}

const rootMarkdownFiles = readdirSync(projectRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => resolve(projectRoot, entry.name));
const markdownFiles = [...rootMarkdownFiles, ...collectMarkdown(resolve(projectRoot, "docs"))];
const files = Object.fromEntries(
  markdownFiles.map((file) => [label(file), readFileSync(file, "utf8")])
);
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as {
  readonly scripts?: Readonly<Record<string, string>>;
};
const result = checkDocumentation({
  files,
  packageScripts: new Set(Object.keys(packageJson.scripts ?? {}))
});

if (result.diagnostics.length > 0) {
  console.error("Documentation check failed:");
  for (const entry of result.diagnostics) {
    console.error(`- ${entry.file}:${entry.line} [${entry.code}] ${entry.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Documentation check passed: ${Object.keys(files).length} Markdown files, ` +
      `${result.metadata.size} metadata owners and ${result.reachability.size} reachable documents.`
  );
}
