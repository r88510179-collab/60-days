#!/usr/bin/env node
// build/merge.test.js — unit tests for the v3 note-merge logic.
// Extracts the REAL buildSnapshot/parseSnapshot/mergeSnapshots/snapshotKey from
// index.html (no duplicated logic to drift) and exercises the conflict rules.
// If the extraction anchors move, this fails loudly — update the anchors then.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function fail(msg) { console.error("TEST FAIL: " + msg); process.exit(1); }
function onceIdx(hay, needle, label) {
  const i = hay.indexOf(needle);
  if (i === -1) fail("anchor not found: " + label);
  if (hay.indexOf(needle, i + 1) !== -1) fail("anchor not unique: " + label);
  return i;
}

const verMatch = html.match(/const SNAPSHOT_VERSION = \d+;[^\n]*/);
if (!verMatch) fail("SNAPSHOT_VERSION line not found");
const start = onceIdx(html, "const EMPTY_LABREF", "EMPTY_LABREF start anchor");
const end = onceIdx(html, "const fmtRelative", "fmtRelative end anchor");
if (end < start) fail("anchor order wrong");
const block = html.slice(start, end);

const api = new Function('"use strict";' + verMatch[0] + "\n" + block +
  "\nreturn { buildSnapshot, parseSnapshot, mergeSnapshots, snapshotKey, SNAPSHOT_VERSION };")();

let n = 0, bad = 0;
function eq(actual, expected, label) {
  n++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log("PASS  " + label); }
  else { console.error(`FAIL  ${label}\n      expected ${e}\n      got      ${a}`); bad++; }
}
function ok(cond, label) { n++; if (cond) console.log("PASS  " + label); else { console.error("FAIL  " + label); bad++; } }

const base = { completed: {}, habitLog: {}, startDate: null, labRef: {}, notes: {}, notesAt: {} };
const S = (o) => ({ ...base, ...o });

// T1 — same note edited on both devices, REMOTE edit is newer -> remote wins
let m = api.mergeSnapshots(
  S({ notes: { d1t1: "local" }, notesAt: { d1t1: "2026-07-10T10:00:00.000Z" } }),
  S({ notes: { d1t1: "remote" }, notesAt: { d1t1: "2026-07-12T10:00:00.000Z" } }));
eq(m.notes.d1t1, "remote", "T1 conflict: newer remote edit wins");
eq(m.notesAt.d1t1, "2026-07-12T10:00:00.000Z", "T1 merged timestamp = winner's");

// T2 — same conflict, LOCAL edit is newer -> local wins
m = api.mergeSnapshots(
  S({ notes: { d1t1: "local" }, notesAt: { d1t1: "2026-07-12T10:00:00.000Z" } }),
  S({ notes: { d1t1: "remote" }, notesAt: { d1t1: "2026-07-10T10:00:00.000Z" } }));
eq(m.notes.d1t1, "local", "T2 conflict: newer local edit wins");

// T3 — regression guard: untimestamped remote-only note (pre-v3 data) survives
m = api.mergeSnapshots(S({}), S({ notes: { d2t1: "old-device note" } }));
eq(m.notes.d2t1, "old-device note", "T3 pre-v3 remote-only note is kept");

// T4 — both untimestamped, conflicting (pure pre-v3) -> local wins (old behavior)
m = api.mergeSnapshots(S({ notes: { d3t1: "local" } }), S({ notes: { d3t1: "remote" } }));
eq(m.notes.d3t1, "local", "T4 pre-v3 tie: local wins (matches old behavior)");

// T5 — local DELETED the note (newer tombstone) vs older remote text -> stays deleted
m = api.mergeSnapshots(
  S({ notesAt: { d4t1: "2026-07-12T10:00:00.000Z" } }),
  S({ notes: { d4t1: "stale text" }, notesAt: { d4t1: "2026-07-10T10:00:00.000Z" } }));
ok(!("d4t1" in m.notes), "T5 newer deletion beats older edit (no resurrection)");
eq(m.notesAt.d4t1, "2026-07-12T10:00:00.000Z", "T5 tombstone timestamp retained");

// T6 — remote tombstone newer than local edit -> deleted here too
m = api.mergeSnapshots(
  S({ notes: { d5t1: "typed offline" }, notesAt: { d5t1: "2026-07-10T10:00:00.000Z" } }),
  S({ notesAt: { d5t1: "2026-07-12T10:00:00.000Z" } }));
ok(!("d5t1" in m.notes), "T6 newer remote deletion replicates");

// T7 — done-flags are a union in both directions, never lost
m = api.mergeSnapshots(S({ completed: { d1t1: true } }), S({ completed: { d2t2: true } }));
ok(m.completed.d1t1 === true && m.completed.d2t2 === true, "T7 completed flags union (can't be lost)");

// T8 — parseSnapshot: v2 payload gets empty notesAt; future version throws
const v2 = api.parseSnapshot(JSON.stringify({ version: 2, completed: {}, habitLog: {}, notes: { d1t1: "x" } }));
eq(v2.notesAt, {}, "T8a v2 snapshot parses with empty notesAt");
let threw = false;
try { api.parseSnapshot(JSON.stringify({ version: 4 })); } catch { threw = true; }
ok(threw, "T8b future snapshot version is rejected with guidance");

// T9 — round trip: buildSnapshot output parses back with notesAt intact
const rt = api.parseSnapshot(api.buildSnapshot(S({ notes: { d6t1: "hi" }, notesAt: { d6t1: "2026-07-12T10:00:00.000Z" } })));
eq(rt.notesAt.d6t1, "2026-07-12T10:00:00.000Z", "T9 snapshot round-trips notesAt");

// T10 — snapshotKey changes when only a timestamp differs (so devices push timestamp updates)
const k1 = api.snapshotKey(S({ notes: { d7t1: "a" }, notesAt: { d7t1: "2026-07-10T10:00:00.000Z" } }));
const k2 = api.snapshotKey(S({ notes: { d7t1: "a" }, notesAt: { d7t1: "2026-07-12T10:00:00.000Z" } }));
ok(k1 !== k2, "T10 snapshotKey covers notesAt");

if (bad) { console.error(`\n${bad}/${n} merge tests FAILED.`); process.exit(1); }
console.log(`\nAll ${n} merge tests PASS.`);
