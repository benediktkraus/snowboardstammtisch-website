import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const databaseId = process.env.D1_DATABASE_ID;

if (!databaseId) {
  console.error("D1_DATABASE_ID is required.");
  process.exit(1);
}

const template = await readFile(resolve(root, "wrangler.template.toml"), "utf8");
if (!template.includes("__D1_DATABASE_ID__")) {
  throw new Error("wrangler.template.toml has no D1 placeholder");
}

await writeFile(
  resolve(root, ".wrangler.generated.toml"),
  template.replaceAll("__D1_DATABASE_ID__", databaseId),
  "utf8"
);

console.log("Generated platform/.wrangler.generated.toml");
