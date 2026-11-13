const CODE_POINT = /^U\+([0-9A-F]{4,6})$/i;
const isScalar = value => Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff);

export function isIdeographicDescriptionOperator(character) {
  if (typeof character !== "string" || [...character].length !== 1) return false;
  const value = character.codePointAt(0);
  return value >= 0x2ff0 && value <= 0x2ffb;
}

function parseCodePoint(token) {
  const match = CODE_POINT.exec(token);
  if (!match) throw new TypeError("Expected a Unicode code point in U+ notation");
  const value = Number.parseInt(match[1], 16);
  if (!isScalar(value)) throw new RangeError("Invalid Unicode scalar value");
  return value;
}

export function parseUnihanLine(line) {
  if (typeof line !== "string") throw new TypeError("Unihan line must be a string");
  const source = line.trimEnd();
  if (!source || source.startsWith("#")) return null;
  const fields = source.split("\t");
  if (fields.length < 3) throw new SyntaxError("Unihan record must contain three tab-separated fields");
  const first = fields[0].trim();
  const match = /^(U\+[0-9A-F]{4,6})(?:\s+(\S))?$/i.exec(first);
  if (!match) throw new SyntaxError("Invalid Unihan code point field");
  const codePoint = parseCodePoint(match[1]);
  const property = fields[1].trim();
  const value = fields.slice(2).join("\t").trim();
  if (!/^k[A-Za-z0-9_]+$/.test(property)) throw new SyntaxError("Invalid Unihan property name");
  if (!value) throw new SyntaxError("Unihan property value is empty");
  return Object.freeze({
    codePoint,
    character: match[2] ?? String.fromCodePoint(codePoint),
    property,
    value
  });
}

export function parseCJKVIIDSLine(line) {
  if (typeof line !== "string") throw new TypeError("IDS line must be a string");
  const source = line.trimEnd();
  if (!source || source.startsWith("#")) return null;
  const fields = source.split("\t");
  if (fields.length < 3) throw new SyntaxError("IDS record must contain code point, character and decomposition");
  const codePoint = parseCodePoint(fields[0].trim());
  const character = [...fields[1]][0];
  if (!character || character.codePointAt(0) !== codePoint) throw new SyntaxError("IDS character does not match its code point");
  const decompositions = fields.slice(2).map(value => value.trim()).filter(Boolean);
  if (decompositions.length === 0) throw new SyntaxError("IDS decomposition is empty");
  return Object.freeze({
    codePoint,
    character,
    decompositions: Object.freeze(decompositions)
  });
}
