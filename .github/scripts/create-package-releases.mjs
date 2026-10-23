import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const publishedPackages = JSON.parse(process.env.PUBLISHED_PACKAGES ?? "[]");


if (!Array.isArray(publishedPackages) || publishedPackages.length === 0) {
  throw new Error("PUBLISHED_PACKAGES must contain at least one published package.");
}

async function changelogSection(packageName, version) {
  const directory = packageName.split("/").at(-1);
  const changelog = await readFile(
    path.join(process.cwd(), "packages", directory, "CHANGELOG.md"),
    "utf8",
  );
  const lines = changelog.split("\n");
  const heading = `## ${version}`;
  const start = lines.findIndex((line) => line.trim() === heading);

  if (start === -1) {
    return "No package-specific release notes were recorded.";
  }

  const nextHeading = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  const end = nextHeading === -1 ? lines.length : nextHeading;
  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
}

const commit = process.env.GITHUB_SHA ?? "main";

for (const { name, version } of publishedPackages) {
  const tag = `${name}@${version}`;
  const changes = await changelogSection(name, version);
  const notes = [
    `[View ${name}@${version} on npm](https://www.npmjs.com/package/${name}/v/${version})`,
    "",
    "```sh",
    `npm install ${name}@${version}`,
    "```",
    "",
    changes,
    "",
  ].join("\n");

  execFileSync("gh", [
    "release", "create", tag,
    "--verify-tag",
    "--target", commit,
    "--title", tag,
    "--notes-file", "-",
    name === "@wpxdev/shared-kit" ? "--latest" : "--latest=false",
  ], { input: notes, stdio: ["pipe", "inherit", "inherit"] });
  console.log(`Created GitHub release ${tag}.`);
}
