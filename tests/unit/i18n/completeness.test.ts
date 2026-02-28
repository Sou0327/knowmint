import * as assert from "node:assert/strict";
import { describe, it, before } from "mocha";
import * as fs from "node:fs";
import * as path from "node:path";

const messagesDir = path.resolve(__dirname, "../../../messages");
const enRaw = fs.readFileSync(path.join(messagesDir, "en.json"), "utf-8");
const jaRaw = fs.readFileSync(path.join(messagesDir, "ja.json"), "utf-8");

// Deferred parse — only called after raw duplicate key check passes
let en: Record<string, unknown>;
let ja: Record<string, unknown>;

function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNamespaces(obj: Record<string, unknown>): string[] {
  return Object.keys(obj);
}

function findEmptyValues(obj: Record<string, unknown>, prefix = ""): string[] {
  const empties: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || value === "") {
      empties.push(fullKey);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      empties.push(...findEmptyValues(value as Record<string, unknown>, fullKey));
    }
  }
  return empties;
}

/**
 * Detect duplicate keys from raw JSON text (pre-parse).
 * JSON.parse silently collapses duplicates, so this must run on raw text.
 */
function findRawDuplicateKeys(raw: string, label: string): string[] {
  const dupes: string[] = [];
  const stack: string[] = [];
  const seenAtLevel = new Map<string, Set<string>>();
  let inString = false;
  let escaped = false;
  let currentKey = "";
  let collectingKey = false;
  let expectColon = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"' && !inString) {
      inString = true;
      currentKey = "";
      collectingKey = true;
      continue;
    }
    if (ch === '"' && inString) {
      inString = false;
      if (collectingKey) {
        expectColon = true;
        collectingKey = false;
      }
      continue;
    }
    if (inString) {
      if (collectingKey) currentKey += ch;
      continue;
    }
    if (expectColon && ch === ":") {
      expectColon = false;
      const level = stack.join(".");
      if (!seenAtLevel.has(level)) seenAtLevel.set(level, new Set());
      const seen = seenAtLevel.get(level)!;
      const fullKey = level ? `${level}.${currentKey}` : currentKey;
      if (seen.has(currentKey)) {
        dupes.push(`${label}: "${fullKey}"`);
      }
      seen.add(currentKey);
    }
    if (ch === "{") {
      stack.push(currentKey);
      continue;
    }
    if (ch === "}") {
      const popped = stack.pop();
      if (popped !== undefined) {
        const level = stack.join(".");
        const scopeKey = level ? `${level}.${popped}` : popped;
        seenAtLevel.delete(scopeKey);
      }
      continue;
    }
  }
  return dupes;
}

describe("i18n key completeness", () => {
  // Parse JSON lazily inside before() — after raw duplicate check can run first
  before(() => {
    en = JSON.parse(enRaw) as Record<string, unknown>;
    ja = JSON.parse(jaRaw) as Record<string, unknown>;
  });

  // --- Raw text checks (run before parsed-JSON tests) ---

  it("no duplicate keys in raw JSON source (pre-parse detection)", () => {
    const enDupes = findRawDuplicateKeys(enRaw, "en.json");
    const jaDupes = findRawDuplicateKeys(jaRaw, "ja.json");

    assert.deepStrictEqual(
      [...enDupes, ...jaDupes],
      [],
      `Duplicate keys in raw JSON:\n${[...enDupes, ...jaDupes].join("\n")}`
    );
  });

  // --- Parsed-JSON checks ---

  it("en keys not in ja should be zero", () => {
    const enKeys = flattenKeys(en);
    const jaKeySet = new Set(flattenKeys(ja));
    const enOnly = enKeys.filter((k) => !jaKeySet.has(k));
    assert.deepStrictEqual(
      enOnly,
      [],
      `Keys in en.json but not in ja.json: ${enOnly.join(", ")}`
    );
  });

  it("ja keys not in en should be zero", () => {
    const jaKeys = flattenKeys(ja);
    const enKeySet = new Set(flattenKeys(en));
    const jaOnly = jaKeys.filter((k) => !enKeySet.has(k));
    assert.deepStrictEqual(
      jaOnly,
      [],
      `Keys in ja.json but not in en.json: ${jaOnly.join(", ")}`
    );
  });

  it("all namespaces exist in both files", () => {
    const enNS = getNamespaces(en);
    const jaNS = getNamespaces(ja);
    const enNSSet = new Set(enNS);
    const jaNSSet = new Set(jaNS);

    const enOnlyNS = enNS.filter((ns) => !jaNSSet.has(ns));
    const jaOnlyNS = jaNS.filter((ns) => !enNSSet.has(ns));

    assert.deepStrictEqual(
      enOnlyNS,
      [],
      `Namespaces in en.json but not in ja.json: ${enOnlyNS.join(", ")}`
    );
    assert.deepStrictEqual(
      jaOnlyNS,
      [],
      `Namespaces in ja.json but not in en.json: ${jaOnlyNS.join(", ")}`
    );
  });

  it("en has no empty/null/undefined values", () => {
    const empties = findEmptyValues(en);
    assert.deepStrictEqual(
      empties,
      [],
      `Empty/null/undefined values in en.json: ${empties.join(", ")}`
    );
  });

  it("ja has no empty/null/undefined values", () => {
    const empties = findEmptyValues(ja);
    assert.deepStrictEqual(
      empties,
      [],
      `Empty/null/undefined values in ja.json: ${empties.join(", ")}`
    );
  });

  it("each namespace has the same number of keys in both files", () => {
    const enNS = getNamespaces(en);
    const mismatches: string[] = [];

    for (const ns of enNS) {
      const nsEn = en[ns];
      const nsJa = ja[ns];
      if (
        nsEn === undefined ||
        nsJa === undefined ||
        typeof nsEn !== "object" ||
        typeof nsJa !== "object" ||
        Array.isArray(nsEn) ||
        Array.isArray(nsJa)
      ) {
        continue;
      }
      const enNsKeys = flattenKeys(nsEn as Record<string, unknown>);
      const jaNsKeys = flattenKeys(nsJa as Record<string, unknown>);
      if (enNsKeys.length !== jaNsKeys.length) {
        mismatches.push(
          `${ns}: en=${enNsKeys.length} keys, ja=${jaNsKeys.length} keys`
        );
      }
    }

    assert.deepStrictEqual(
      mismatches,
      [],
      `Namespaces with differing key counts:\n${mismatches.join("\n")}`
    );
  });

  it("nested structure depth matches between en and ja", () => {
    const enKeys = flattenKeys(en);
    const jaKeySet = new Set(flattenKeys(ja));
    const typeMismatches: string[] = [];

    for (const key of enKeys) {
      if (!jaKeySet.has(key)) continue;

      const getValueType = (obj: Record<string, unknown>, dotPath: string): string => {
        const parts = dotPath.split(".");
        let current: unknown = obj;
        for (const part of parts) {
          if (current === null || typeof current !== "object" || Array.isArray(current)) {
            return typeof current;
          }
          current = (current as Record<string, unknown>)[part];
        }
        if (current === null) return "null";
        if (Array.isArray(current)) return "array";
        return typeof current;
      };

      const enType = getValueType(en, key);
      const jaType = getValueType(ja, key);

      if (enType !== jaType) {
        typeMismatches.push(`${key}: en=${enType}, ja=${jaType}`);
      }
    }

    assert.deepStrictEqual(
      typeMismatches,
      [],
      `Keys with mismatched types between en.json and ja.json:\n${typeMismatches.join("\n")}`
    );
  });
});
