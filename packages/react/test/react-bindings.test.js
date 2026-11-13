import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("React adapter declares React as a peer dependency", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url)));
  assert.equal(manifest.peerDependencies.react, "^19.0.0");
  assert.equal(manifest.exports["."], "./src/index.js");
});

test("React adapter exposes runtime and logographic hooks", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  for (const name of ["SpacereaProvider", "useSpacerea", "useSpacereaModule", "useLogographicAPI", "useLogographs"]) {
    assert.match(source, new RegExp("export function " + name + "\\b"));
  }
});
