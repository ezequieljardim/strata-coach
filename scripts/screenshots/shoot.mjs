// Screenshots of the demo dashboard through the Chrome DevTools Protocol (no extra deps).
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const chrome = spawn(CH, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--remote-debugging-port=9333",
  `--user-data-dir=${OUT}/../chrome-cdp`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch("http://127.0.0.1:9333/json")).json()).find((t) => t.type === "page"); } catch {}
  await sleep(200);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const js = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true });

async function shot(name, { hash = "", scheme = "light", height = 1100, after = "" }) {
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height, deviceScaleFactor: 2, mobile: false });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
  await send("Page.navigate", { url: "about:blank" }); await sleep(300);
  await send("Page.navigate", { url: `http://localhost:4590/alex${hash ? "#" + hash : ""}` });
  await sleep(2500);
  if (after) { await js(after); await sleep(1200); }
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  console.log(name);
}
await send("Page.enable");
await shot("progress", { height: 1000 });
await shot("progress-dark", { scheme: "dark", height: 1000 });
await shot("calendar", { hash: "calendar", height: 900 });
await shot("day-detail", { hash: "calendar", height: 1500,
  after: `(() => { const c=[...document.querySelectorAll('.dayCell.done')].pop(); c && c.click(); })()` });
await shot("knee", { hash: "tracked:knee", height: 1000 });
await shot("runs-dark", { hash: "runs", scheme: "dark", height: 1100 });
await shot("context", { hash: "context", height: 1000 });
await shot("history", { hash: "history", height: 1000 });
ws.close(); chrome.kill();
