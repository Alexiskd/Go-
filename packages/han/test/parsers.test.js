import test from "node:test";
import assert from "node:assert/strict";
import { parseUnihanLine, parseCJKVIIDSLine, isIdeographicDescriptionOperator } from "../src/parsers.js";

const idc = value => String.fromCodePoint(value);

test("Unihan parses a property record", () => {
  const record = parseUnihanLine("U+4E95\t kCantonese \t zeng2");
  assert.equal(record.codePoint, 0x4e95);
  assert.equal(record.character, "井");
  assert.equal(record.property, "kCantonese");
  assert.equal(record.value, "zeng2");
});

test("Unihan parses the review-database first-column format", () => {
  const record = parseUnihanLine("U+4E95 井\tkCantonese\tzeng2");
  assert.equal(record.character, "井");
  assert.equal(record.value, "zeng2");
});

test("CJKVI parses and preserves IDS decomposition variants", () => {
  const first = idc(0x2ff9);
  const second = idc(0x2ffb);
  const record = parseCJKVIIDSLine("U+4E0E\t与\t" + first + "②一[GTKV]\t" + second + "②一[J]");
  assert.equal(record.codePoint, 0x4e0e);
  assert.deepEqual(record.decompositions, [first + "②一[GTKV]", second + "②一[J]"]);
});

test("IDS operator detection uses Unicode code points", () => {
  assert.equal(isIdeographicDescriptionOperator(idc(0x2ff0)), true);
  assert.equal(isIdeographicDescriptionOperator("井"), false);
});

test("parsers skip comments and reject malformed records", () => {
  assert.equal(parseUnihanLine("# comment"), null);
  assert.equal(parseCJKVIIDSLine("# comment"), null);
  assert.throws(() => parseUnihanLine("bad"), SyntaxError);
});
