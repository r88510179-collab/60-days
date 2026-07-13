#!/usr/bin/env node
// build/render.test.js — runtime smoke tests for the COMPILED app (dist/).
// Boots dist/app.js + vendored React in jsdom and asserts the app actually
// mounts and behaves. Runs in CI and in the Vercel build (jsdom is a
// devDependency; Vercel installs devDependencies during builds).

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIST = path.join(__dirname, "..", "dist");
const read = (f) => fs.readFileSync(path.join(DIST, f), "utf8");

let n = 0, bad = 0;
function ok(cond, label) { n++; if (cond) console.log("PASS  " + label); else { console.error("FAIL  " + label); bad++; } }

function boot(seed) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',
    { runScripts: "outside-only", pretendToBeVisual: true, url: "https://example.test/" });
  const w = dom.window;
  w.fetch = () => Promise.reject(new Error("offline test"));   // no live Gist calls
  for (const [k, v] of Object.entries(seed)) w.localStorage.setItem(k, JSON.stringify(v));
  w.eval(read(path.join("vendor", "react.production.min.js")));
  w.eval(read(path.join("vendor", "react-dom.production.min.js")));
  w.eval(read("app.js"));
  return w;
}
const settle = (ms = 300) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // --- Case 1: fresh sprint with progress, never exported -> app mounts, nudge shows
  let w = boot({ "se-start": "2026-07-01", "se-done": { d1t1: true } });
  await settle();
  let html = w.document.getElementById("root").innerHTML;
  ok(html.length > 5000, `app mounts (root innerHTML ${html.length} chars)`);
  ok(html.includes("Security Engineering Sprint"), "header renders");
  ok(html.includes("last manual backup"), "backup nudge shows (no sync cfg, progress, never exported)");

  // --- Case 2: gist sync configured -> nudge hidden
  w = boot({ "se-start": "2026-07-01", "se-done": { d1t1: true }, "se-sync": { enabled: true, token: "x", gistId: "y" } });
  await settle();
  ok(!w.document.getElementById("root").innerHTML.includes("last manual backup"), "nudge hidden when gist sync configured");

  // --- Case 3: recent backup -> hidden; stale backup -> shows
  w = boot({ "se-start": "2026-07-01", "se-done": { d1t1: true }, "se-exported": new Date(Date.now() - 2 * 86400000).toISOString() });
  await settle();
  ok(!w.document.getElementById("root").innerHTML.includes("last manual backup"), "nudge hidden when backed up 2 days ago");

  w = boot({ "se-start": "2026-07-01", "se-done": { d1t1: true }, "se-exported": new Date(Date.now() - 9 * 86400000).toISOString() });
  await settle();
  ok(w.document.getElementById("root").innerHTML.includes("last manual backup"), "nudge shows when backup is 9 days old");

  // --- Case 4: Stats tab exists and the Stats view renders on click
  w = boot({ "se-start": "2026-07-01", "se-done": { d1t1: true, d1t2: true } });
  await settle();
  const statsBtn = [...w.document.querySelectorAll("button")].find((b) => b.textContent === "Stats");
  ok(!!statsBtn, "Stats tab present in nav");
  if (statsBtn) {
    statsBtn.click();
    await settle(200);
    html = w.document.getElementById("root").innerHTML;
    ok(html.includes("Current pace"), "Stats view: pace card renders");
    ok(html.includes("Phase progress"), "Stats view: phase burndown renders");
    ok(html.includes("last 14 days"), "Stats view: habit heatmap renders");
  } else { n += 3; bad += 3; }

  if (bad) { console.error(`\n${bad}/${n} render tests FAILED.`); process.exit(1); }
  console.log(`\nAll ${n} render tests PASS.`);
})().catch((e) => { console.error("TEST RUN ERROR: " + e.message); process.exit(1); });
