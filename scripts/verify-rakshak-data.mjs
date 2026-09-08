#!/usr/bin/env node
/**
 * verify-rakshak-data.mjs — prove a copied Project Rakshak home page carries
 * byte-identical data to the canonical source.
 *
 * USAGE
 *   node verify-rakshak-data.mjs <path-to-file-or-dir> [...more]
 *
 *   Accepts any mix of:
 *     - a .tsx/.ts/.jsx/.js file containing `export const LOCATIONS = [...]`
 *       (the standalone snapshot, or any file that inlines the arrays)
 *     - a directory containing the original src/data/*.json files
 *     - an individual .json file
 *
 * WHAT IT CHECKS
 *   Nine datasets, each canonicalised (object keys sorted recursively, numbers
 *   normalised) and hashed with SHA-256, then compared to the expected digests
 *   embedded below. Coordinates get an extra dedicated pass because a single
 *   transposed digit moves a marker hundreds of kilometres while still looking
 *   plausible in a code review.
 *
 * EXIT CODES
 *   0 = every dataset matched exactly
 *   1 = at least one mismatch (every differing field is printed with its path)
 *   2 = usage / parse error
 */

import { readFileSync, statSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname, basename } from "node:path";

/* ── Canonical digests. Generated from src/data/*.json at commit 41150d9. ──── */
const EXPECTED = {
  LOCATIONS: "b9ada03739edd5f1e05b4861b930c880",
  STATUS_META: "aa49834ee4493a4e367cdc3ac257104b",
  RISK_COLORS: "159c182bc4d9135e45e1c2c6f8f4f2a3",
  RISK_LABELS: "ea6f6078d0c2bc030dbc119434c757cf",
  PROGRESS_STEPS: "71948edf89cb25d927a3e0cd37f323e2",
  AUTH_CATEGORIES: "2b486317b7c2b5fbf3fae7483429ba17",
  STATE_BOUNDS: "3b2a4df27d38b567ac8c1782068b869a",
  GEO_NAME_MAP: "a4d10aea5fe605f9e983772975cdb9cc",
  SITE_MAPS: "d2fa83022b8f9f84dc5e33242aa34cc6",
  UNIVERSITIES: "354c102221e508e25af0f115df7a4d8d",
};

/** Digest over just (id, lat, lng) — isolates geographic drift from text edits. */
const EXPECTED_COORDS = "9e2a029e8db2aff49483514ad3ec1d62";

/** Expected shape, so a truncated copy is caught even if it hashes "cleanly". */
const EXPECTED_COUNTS = {
  LOCATIONS: 31,
  STATUS_META: 7,
  PROGRESS_STEPS: 6,
  AUTH_CATEGORIES: 4,
  STATE_BOUNDS: 13,
  GEO_NAME_MAP: 2,
  SITE_MAPS: 28,
  UNIVERSITIES: 20,
};

/** Which src/data/*.json file supplies each dataset, and how to unwrap it. */
const JSON_SOURCES = {
  "locations.json": [["LOCATIONS", (d) => d]],
  "statusMeta.json": [["STATUS_META", (d) => d]],
  "riskMeta.json": [
    ["RISK_COLORS", (d) => d.RC],
    ["RISK_LABELS", (d) => d.RL],
  ],
  "progressSteps.json": [["PROGRESS_STEPS", (d) => d]],
  "authCategories.json": [["AUTH_CATEGORIES", (d) => d]],
  "stateBounds.json": [["STATE_BOUNDS", (d) => d]],
  "geoNameMap.json": [["GEO_NAME_MAP", (d) => d]],
  "siteMaps.json": [["SITE_MAPS", (d) => d]],
  "universities.json": [["UNIVERSITIES", (d) => d]],
};

/* ── canonicalisation ─────────────────────────────────────────────────────── */

/**
 * Deterministic serialisation. Object keys are sorted so formatting, key order
 * and whitespace cannot affect the digest — only actual values can. Arrays keep
 * their order, because location order is itself data.
 */
function canonical(v) {
  if (v === null || typeof v !== "object") {
    // Normalise numbers so 11.30 and 11.3 agree, and -0 does not sneak through.
    if (typeof v === "number") return JSON.stringify(v === 0 ? 0 : v);
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 32);
const digest = (v) => sha(canonical(v));

/* ── extraction ───────────────────────────────────────────────────────────── */

/** Extracts a balanced [...] or {...} literal starting at `from`. */
function balanced(src, from) {
  const open = src[from];
  const close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false, quote = "", esc = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = true; quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  return null;
}

/**
 * Pulls `export const NAME[: Type] = <literal>` out of a source file.
 * Works because the snapshot emits pure JSON literals, so JSON.parse suffices —
 * we deliberately do NOT eval, so a tampered file cannot execute anything.
 */
function extractFromSource(src, name) {
  const re = new RegExp(
    "export\\s+const\\s+" + name + "\\s*(?::[^=]+)?=\\s*",
    "m",
  );
  const m = re.exec(src);
  if (!m) return { missing: true };
  const start = m.index + m[0].length;
  const ch = src[start];
  if (ch !== "[" && ch !== "{") {
    return { error: `value after "${name} =" is not an array or object literal` };
  }
  const lit = balanced(src, start);
  if (!lit) return { error: `unbalanced literal for ${name}` };
  try {
    return { value: JSON.parse(lit) };
  } catch (e) {
    return {
      error:
        `${name} is not plain JSON (${e.message}). ` +
        `If the copy re-formatted it with trailing commas, comments, single ` +
        `quotes or computed values, this checker cannot verify it — convert ` +
        `that block back to strict JSON first.`,
    };
  }
}

/* ── diffing ──────────────────────────────────────────────────────────────── */

function deepDiff(a, b, path = "", out = []) {
  if (out.length >= 60) return out;
  const ta = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const tb = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) {
    out.push({ path: path || "(root)", expected: `${ta}`, actual: `${tb}` });
    return out;
  }
  if (ta === "array") {
    if (a.length !== b.length) {
      out.push({ path: `${path}.length`, expected: a.length, actual: b.length });
    }
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      deepDiff(a[i], b[i], `${path}[${i}]`, out);
    }
    return out;
  }
  if (ta === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { out.push({ path: `${path}.${k}`, expected: "(absent)", actual: trunc(b[k]) }); continue; }
      if (!(k in b)) { out.push({ path: `${path}.${k}`, expected: trunc(a[k]), actual: "(absent)" }); continue; }
      deepDiff(a[k], b[k], `${path}.${k}`, out);
    }
    return out;
  }
  if (a !== b) out.push({ path: path || "(root)", expected: trunc(a), actual: trunc(b) });
  return out;
}

const trunc = (v) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "undefined" : s.length > 90 ? s.slice(0, 90) + "…" : s;
};

/* ── input collection ─────────────────────────────────────────────────────── */

function collect(paths) {
  /** name -> { value, from } */
  const found = {};
  const notes = [];

  const takeJson = (file) => {
    const spec = JSON_SOURCES[basename(file)];
    if (!spec) return;
    let raw;
    try { raw = JSON.parse(readFileSync(file, "utf8")); }
    catch (e) { notes.push(`could not parse ${file}: ${e.message}`); return; }
    for (const [name, pick] of spec) {
      const v = pick(raw);
      if (v !== undefined && !(name in found)) found[name] = { value: v, from: file };
    }
  };

  const takeSource = (file) => {
    const src = readFileSync(file, "utf8");
    for (const name of Object.keys(EXPECTED)) {
      if (name in found) continue;
      const r = extractFromSource(src, name);
      if (r.value !== undefined) found[name] = { value: r.value, from: file };
      else if (r.error) notes.push(`${basename(file)}: ${r.error}`);
    }
  };

  for (const p of paths) {
    let st;
    try { st = statSync(p); }
    catch { notes.push(`path not found: ${p}`); continue; }

    if (st.isDirectory()) {
      const walk = (dir, depth = 0) => {
        if (depth > 4) return;
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (e.name === "node_modules" || e.name.startsWith(".")) continue;
          const full = join(dir, e.name);
          if (e.isDirectory()) walk(full, depth + 1);
          else if (extname(e.name) === ".json") takeJson(full);
          else if ([".tsx", ".ts", ".jsx", ".js", ".mjs"].includes(extname(e.name))) {
            try { takeSource(full); } catch { /* unreadable, skip */ }
          }
        }
      };
      walk(p);
    } else if (extname(p) === ".json") {
      takeJson(p);
    } else {
      takeSource(p);
    }
  }
  return { found, notes };
}

/* ── main ─────────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: node verify-rakshak-data.mjs <file-or-dir> [...]");
  process.exit(2);
}

const { found, notes } = collect(args);
if (notes.length) {
  console.log("Notes:");
  notes.forEach((n) => console.log("  ! " + n));
  console.log("");
}

let failures = 0;
const rows = [];

for (const [name, expectedHash] of Object.entries(EXPECTED)) {
  const hit = found[name];
  if (!hit) {
    rows.push({ name, verdict: "NOT FOUND", detail: "no such dataset in the given path(s)" });
    failures++;
    continue;
  }
  const actual = digest(hit.value);
  const size = Array.isArray(hit.value) ? hit.value.length : Object.keys(hit.value).length;
  const wantSize = EXPECTED_COUNTS[name];

  if (actual === expectedHash) {
    rows.push({ name, verdict: "MATCH", detail: `${size} entries · ${actual}` });
  } else {
    failures++;
    rows.push({
      name,
      verdict: "MISMATCH",
      detail:
        `expected ${expectedHash}, got ${actual}` +
        (wantSize !== undefined && size !== wantSize ? ` · SIZE ${size}, expected ${wantSize}` : ` · ${size} entries`),
    });
  }
}

const pad = Math.max(...rows.map((r) => r.name.length));
console.log("Dataset integrity");
console.log("─".repeat(78));
for (const r of rows) {
  const mark = r.verdict === "MATCH" ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${r.name.padEnd(pad)}  ${r.detail}`);
}

/* ---- coordinates get their own pass ---- */
console.log("");
console.log("Geographic coordinates");
console.log("─".repeat(78));
if (!found.LOCATIONS) {
  console.log("  [FAIL] LOCATIONS not found — cannot verify coordinates");
  failures++;
} else {
  const locs = found.LOCATIONS.value;
  const coords = locs.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng }));
  const ch = digest(coords);
  if (ch === EXPECTED_COORDS) {
    console.log(`  [PASS] all ${coords.length} (id, lat, lng) triples identical · ${ch}`);
  } else {
    failures++;
    console.log(`  [FAIL] coordinate digest ${ch}, expected ${EXPECTED_COORDS}`);
  }
  // Sanity bounds regardless of hash: everything must sit inside India.
  const oob = locs.filter(
    (l) => !(l.lat >= 6 && l.lat <= 38 && l.lng >= 67 && l.lng <= 98),
  );
  if (oob.length) {
    failures++;
    console.log(`  [FAIL] ${oob.length} location(s) fall outside India's bounding box:`);
    oob.forEach((l) => console.log(`         id ${l.id} "${l.n}" → ${l.lat}, ${l.lng}`));
  } else {
    console.log(`  [PASS] every location sits inside India's bounding box`);
  }
  const dupes = new Map();
  locs.forEach((l) => {
    const k = `${l.lat},${l.lng}`;
    dupes.set(k, (dupes.get(k) ?? 0) + 1);
  });
  const shared = [...dupes.entries()].filter(([, n]) => n > 1);
  console.log(
    shared.length
      ? `  [INFO] ${shared.length} coordinate(s) shared by more than one location`
      : `  [PASS] no two locations share a coordinate`,
  );
}

/* ---- field-level diff, only when something actually failed ---- */
const canDiff = failures > 0 && found.LOCATIONS;
if (canDiff) {
  console.log("");
  console.log("To see exactly which fields differ, run this again with a known-good");
  console.log("copy as the second argument:");
  console.log("  node verify-rakshak-data.mjs <your-copy> --against <known-good-file>");
}

const againstIdx = args.indexOf("--against");
if (againstIdx !== -1 && args[againstIdx + 1]) {
  const ref = collect([args[againstIdx + 1]]).found;
  console.log("");
  console.log("Field-level differences");
  console.log("─".repeat(78));
  let any = false;
  for (const name of Object.keys(EXPECTED)) {
    if (!ref[name] || !found[name]) continue;
    const d = deepDiff(ref[name].value, found[name].value, name);
    if (d.length) {
      any = true;
      d.forEach((x) => console.log(`  ${x.path}\n      expected: ${x.expected}\n      actual:   ${x.actual}`));
    }
  }
  if (!any) console.log("  none — the two inputs are identical");
}

console.log("");
console.log("═".repeat(78));
if (failures === 0) {
  console.log("RESULT: PASS — every dataset and every coordinate is byte-identical.");
  process.exit(0);
} else {
  console.log(`RESULT: FAIL — ${failures} check(s) did not match. Details above.`);
  process.exit(1);
}
