// Full-page screenshots over raw CDP, so render proof needs no extra dependency.
//
// Playwright's browser cache is on this machine but the package is not in
// node_modules, and adding one to take pictures would be a heavy way to do a
// light thing. Node's global WebSocket plus Chrome's DevTools Protocol is
// enough: Emulation.setDeviceMetricsOverride gives an exact viewport width, and
// Page.captureScreenshot with captureBeyondViewport gets the whole document
// rather than a fold-height crop.
//
// Usage: node scripts/shot.mjs <base-url> <out-dir> <width> <name=path> ...

import { writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const CHROME = join(
  homedir(),
  "Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"
);

const [base, outDir, widthArg, ...pairs] = process.argv.slice(2);
const width = Number(widthArg);
const PORT = 9333 + (width % 100);

mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  `--window-size=${width},900`,
  "about:blank",
]);
chrome.stderr.on("data", () => {}); // CVDisplayLink noise on macOS

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome did not expose a debugging target");
}

const ws = new WebSocket(await targetWsUrl());
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height: 900,
  deviceScaleFactor: 1,
  mobile: width < 768,
});

for (const pair of pairs) {
  const [name, path] = pair.split("=");
  await send("Page.navigate", { url: base + path });
  await sleep(1800);
  // captureBeyondViewport renders the whole document WITHOUT scrolling, so the
  // IntersectionObserver in <Reveal> never fires and every revealed section
  // photographs as blank white. Scroll the page through once to trip the
  // observers, come back to the top, then let the 700ms transitions land.
  await send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `(async () => {
      const step = Math.round(window.innerHeight * 0.6);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 900));
    })()`,
  });
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const file = join(outDir, `${name}-${width}.png`);
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("wrote", file);
}

ws.close();
chrome.kill();
