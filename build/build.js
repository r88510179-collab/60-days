#!/usr/bin/env node
// build/build.js — compiles the single-file source into dist/ for deployment.
//
// What it does (and why):
//   1. Extracts the <script type="text/babel"> block from index.html and
//      compiles it ONCE with @babel/standalone (same preset the browser uses),
//      so production never ships Babel or compiles JSX at runtime.
//   2. Rewrites the three CDN <script> tags to the vendored React/ReactDOM
//      UMD builds in vendor/ (integrity-verified copies of npm 18.2.0),
//      removing the cdnjs dependency and the open SRI finding.
//   3. Emits dist/sw.js with a content-stamped cache name and a precache
//      shell that includes app.js and the vendored libraries.
//   4. Copies manifest + icons. dist/ is the complete deployable site.
//
// Every text anchor is asserted to appear EXACTLY once — if the source
// drifts, the build fails loudly instead of emitting something wrong.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Babel = require("@babel/standalone");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

function fail(msg) { console.error("BUILD FAIL: " + msg); process.exit(1); }
function once(hay, needle, label) {
  const first = hay.indexOf(needle);
  if (first === -1) fail("anchor not found: " + label);
  if (hay.indexOf(needle, first + 1) !== -1) fail("anchor not unique: " + label);
  return first;
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

// ---- 1. extract + compile the JSX block ------------------------------------
const OPEN = '<script type="text/babel">';
const END_MARK = 'ReactDOM.createRoot(document.getElementById("root")).render(<App/>);';
const openIdx = once(html, OPEN, "babel open tag");
const endMarkIdx = once(html, END_MARK, "createRoot end marker");
if (endMarkIdx < openIdx) fail("end marker precedes open tag");
const closeIdx = html.indexOf("</script>", endMarkIdx);
if (closeIdx === -1) fail("babel close tag not found after end marker");

const jsx = html.slice(openIdx + OPEN.length, closeIdx);
const appJs = Babel.transform(jsx, { presets: ["react"] }).code;

// ---- 2. assemble dist/index.html --------------------------------------------
let out =
  html.slice(0, openIdx) +
  '<script src="app.js"></script>' +
  html.slice(closeIdx + "</script>".length);

const CDN_REACT = '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>';
const CDN_RDOM  = '<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>';
const CDN_BABEL = '<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>\n';

once(out, CDN_REACT, "react CDN tag");
out = out.replace(CDN_REACT, '<script src="vendor/react.production.min.js"></script>');
once(out, CDN_RDOM, "react-dom CDN tag");
out = out.replace(CDN_RDOM, '<script src="vendor/react-dom.production.min.js"></script>');
once(out, CDN_BABEL, "babel CDN tag");
out = out.replace(CDN_BABEL, "");

const CDN_SUPA = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.3/dist/umd/supabase.js"></script>';
once(out, CDN_SUPA, "supabase CDN tag");
out = out.replace(CDN_SUPA, '<script src="vendor/supabase.js"></script>');

// ---- 2b. externalize the inline SW-registration script -----------------------
// The only inline <script> in the source. Moving it to a file lets the CSP use
// script-src 'self' with no inline allowances and no hash maintenance.
const REG_BODY = 'if ("serviceWorker" in navigator) {\n  window.addEventListener("load", () => {\n    navigator.serviceWorker.register("sw.js").catch(() => {});\n  });\n}\n';
const REG_BLOCK = "<script>\n" + REG_BODY + "</script>";
once(out, REG_BLOCK, "inline SW registration block");
out = out.replace(REG_BLOCK, '<script src="register-sw.js"></script>');

// ---- 3. service worker: stamp cache name + extend precache shell ------------
const swSrc = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const hash = crypto.createHash("sha256").update(appJs).update(out).digest("hex").slice(0, 10);

const CACHE_LINE = 'const CACHE = "se-sprint-v1";';
const SHELL_LINE = 'const SHELL = ["./", "./index.html", "./manifest.json"];';
once(swSrc, CACHE_LINE, "sw cache-name line");
once(swSrc, SHELL_LINE, "sw shell line");

const swOut = swSrc
  .replace(CACHE_LINE, `const CACHE = "se-sprint-${hash}"; // content-stamped by build/build.js`)
  .replace(SHELL_LINE, 'const SHELL = ["./", "./index.html", "./app.js", "./register-sw.js", "./manifest.json", "./vendor/react.production.min.js", "./vendor/react-dom.production.min.js", "./vendor/supabase.js"];');

// ---- 4. emit dist/ ------------------------------------------------------------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "vendor"), { recursive: true });
fs.writeFileSync(path.join(DIST, "index.html"), out);
fs.writeFileSync(path.join(DIST, "app.js"), appJs);
fs.writeFileSync(path.join(DIST, "sw.js"), swOut);
fs.writeFileSync(path.join(DIST, "register-sw.js"), REG_BODY);
for (const f of ["manifest.json", "icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
}
for (const f of ["react.production.min.js", "react-dom.production.min.js", "supabase.js"]) {
  fs.copyFileSync(path.join(ROOT, "vendor", f), path.join(DIST, "vendor", f));
}

console.log(`build OK — dist/ ready · cache se-sprint-${hash} · app.js ${(appJs.length / 1024).toFixed(1)} KB · index.html ${(out.length / 1024).toFixed(1)} KB`);
