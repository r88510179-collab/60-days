#!/usr/bin/env node
// build/verify.js — the invariant gate. Run after build/build.js.
// Fails the build (exit 1) if ANY invariant breaks, so a bad push never deploys.
//
// Invariants enforced (source index.html AND compiled dist/app.js):
//   I1  Task IDs: exactly the set d1t1..d60t2 — 140 unique, none missing, none extra
//   I2  localStorage keys: all eight se-* keys present
//   I3  No `.toISOString().slice(0,10)` day-key pattern anywhere
//   I4  ReactDOM.createRoot present (React 18 API)
//   I5  SNAPSHOT_VERSION === 3
// dist/ purity:
//   D1  All expected files exist (index.html, app.js, sw.js, manifest, icons, vendor x2)
//   D2  dist/index.html: no text/babel, no cdnjs URLs, references app.js + vendor files
//   D3  dist/sw.js: content-stamped cache name, shell precaches app.js + vendor files
//   D4  dist/app.js parses cleanly (node --check)

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

let failures = 0;
function check(cond, label) {
  if (cond) { console.log("PASS  " + label); }
  else { console.error("FAIL  " + label); failures++; }
}

// The DAYS data is the source of truth for task IDs. The curriculum has 140
// tasks across 60 days with a VARIABLE per-day count (twenty days carry three
// tasks, forty carry two) — so the expected set is derived from the id:"..."
// declarations, never hardcoded as dXt1/dXt2.
const TASK_COUNT = 152; // 140 original + 12 gap-closure tasks (April 2026 exam refresh)
const REQUIRED_KEYS = ["se-done", "se-hab", "se-start", "se-ref", "se-sync", "se-notes", "se-notesat", "se-exported"];
const FORBIDDEN_DAYKEY = /toISOString\(\)\.slice\(0,\s*10\)/;

function declaredIds(text) {
  // id:"dXtY" in source; Babel prints it as id: "dXtY" in compiled output.
  return new Set((text.match(/id:\s*"(d\d+t\d+)"/g) || []).map((s) => s.match(/d\d+t\d+/)[0]));
}

function checkInvariants(text, label) {
  const declared = declaredIds(text);
  check(declared.size === TASK_COUNT, `${label} I1a: ${TASK_COUNT} declared task IDs (found ${declared.size})`);

  const badDay = [...declared].filter((id) => { const m = id.match(/^d(\d+)t(\d+)$/); return !m || +m[1] < 1 || +m[1] > 60 || +m[2] < 1; });
  check(badDay.length === 0, `${label} I1b: all IDs within day 1-60${badDay.length ? " (bad: " + badDay.slice(0, 5).join(",") + ")" : ""}`);

  // Every dXtY token anywhere (prereq references, notes wiring, etc.) must be a
  // declared task — catches dangling references to nonexistent tasks.
  const dangling = [...new Set(text.match(/\bd\d+t\d+\b/g) || [])].filter((id) => !declared.has(id));
  check(dangling.length === 0, `${label} I1c: no dangling task-ID references${dangling.length ? " (dangling: " + dangling.slice(0, 5).join(",") + ")" : ""}`);

  const missingKeys = REQUIRED_KEYS.filter((k) => !text.includes(`"${k}"`));
  check(missingKeys.length === 0, `${label} I2: all ${REQUIRED_KEYS.length} localStorage keys${missingKeys.length ? " (missing: " + missingKeys.join(",") + ")" : ""}`);

  check(!FORBIDDEN_DAYKEY.test(text), `${label} I3: no toISOString().slice(0,10) day-key pattern`);
  check(text.includes("ReactDOM.createRoot"), `${label} I4: ReactDOM.createRoot present`);

  const vm = text.match(/const SNAPSHOT_VERSION = (\d+);/);
  check(vm && vm[1] === "3", `${label} I5: SNAPSHOT_VERSION === 3 (found ${vm ? vm[1] : "none"})`);
}

// ---- source ----
const srcHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
checkInvariants(srcHtml, "src ");

// ---- dist files exist ----
const DIST_FILES = ["index.html", "app.js", "sw.js", "register-sw.js", "manifest.json", "icon-192.png", "icon-512.png",
  path.join("vendor", "react.production.min.js"), path.join("vendor", "react-dom.production.min.js"), path.join("vendor", "supabase.js")];
for (const f of DIST_FILES) check(fs.existsSync(path.join(DIST, f)), `dist D1: ${f} exists`);
if (failures) { console.error(`\n${failures} check(s) failed — dist incomplete, aborting.`); process.exit(1); }

// ---- dist/app.js invariants ----
const appJs = fs.readFileSync(path.join(DIST, "app.js"), "utf8");
checkInvariants(appJs, "dist");

// ---- source set === dist set (a build can never drop or alter a task) ----
const srcIds = declaredIds(srcHtml);
const distIds = declaredIds(appJs);
const lostInBuild = [...srcIds].filter((id) => !distIds.has(id));
const gainedInBuild = [...distIds].filter((id) => !srcIds.has(id));
check(lostInBuild.length === 0 && gainedInBuild.length === 0,
  `dist I1d: task-ID set identical to source${lostInBuild.length ? " (lost: " + lostInBuild.slice(0, 5).join(",") + ")" : ""}${gainedInBuild.length ? " (gained: " + gainedInBuild.slice(0, 5).join(",") + ")" : ""}`);

// ---- dist/index.html purity ----
const distHtml = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
check(!distHtml.includes("text/babel"), "dist D2a: no text/babel");
check(!distHtml.includes("cdnjs.cloudflare.com"), "dist D2b: no cdnjs URLs");
check(distHtml.includes('src="app.js"'), "dist D2c: loads app.js");
check(distHtml.includes('src="vendor/react.production.min.js"'), "dist D2d: loads vendored react");
check(distHtml.includes('src="vendor/react-dom.production.min.js"'), "dist D2e: loads vendored react-dom");
check((distHtml.match(/<script(?![^>]*\bsrc=)/g) || []).length === 0, "dist D2f: zero inline scripts (CSP script-src 'self' safe)");
check(distHtml.includes('src="register-sw.js"'), "dist D2g: loads externalized SW registration");
check(distHtml.includes('src="vendor/supabase.js"') && !distHtml.includes("jsdelivr"), "dist D2h: loads vendored supabase-js, no jsDelivr");

// ---- dist/sw.js ----
const distSw = fs.readFileSync(path.join(DIST, "sw.js"), "utf8");
check(!distSw.includes('"se-sprint-v1"'), "dist D3a: cache name content-stamped");
check(distSw.includes('"./app.js"') && distSw.includes('"./register-sw.js"'), "dist D3b: shell precaches app.js + register-sw.js");
check(distSw.includes('"./vendor/react.production.min.js"') && distSw.includes('"./vendor/react-dom.production.min.js"'), "dist D3c: shell precaches vendor libs");

// ---- dist/app.js parses ----
const nodeCheck = spawnSync(process.execPath, ["--check", path.join(DIST, "app.js")], { encoding: "utf8" });
check(nodeCheck.status === 0, `dist D4: app.js passes node --check${nodeCheck.status !== 0 ? " — " + (nodeCheck.stderr || "").split("\n")[0] : ""}`);

if (failures) { console.error(`\n${failures} check(s) FAILED.`); process.exit(1); }
console.log("\nAll invariants PASS.");
