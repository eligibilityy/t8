// Screenshots every character's built-in art in the standings, 8 at a time.
// Run it with: node scripts/check-art.mjs <outDir> [--only=clive,jin]
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith("--")) ?? "art-check");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");
mkdirSync(outDir, { recursive: true });

const roster = JSON.parse(readFileSync("src/data/tekken8-roster.json", "utf8")).characters;
const have = new Set(Object.keys(JSON.parse(readFileSync("src/data/published-art.json", "utf8")).characters));
const names = roster.filter((c) => have.has(c.slug) && (!only || only.includes(c.slug))).map((c) => c.name);
const batches = [];
for (let i = 0; i < names.length; i += 8) batches.push(names.slice(i, i + 8));

const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "4181", "--strictPort"], { stdio: "pipe" });
await new Promise((ok, fail) => {
  server.stdout.on("data", (d) => String(d).includes("4181") && ok());
  server.on("exit", (c) => fail(new Error(`vite exited (${c})`)));
});
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 1700, height: 1100 } })).newPage();
  await page.goto("http://localhost:4181/");
  await page.waitForFunction(() => localStorage.getItem("fgc-graphics:state:v1"));
  for (const [b, batch] of batches.entries()) {
    await page.evaluate((batch) => {
      const s = JSON.parse(localStorage.getItem("fgc-graphics:state:v1"));
      s.entries.forEach((e, i) => (e.characters = batch[i] ? [{ name: batch[i] }] : [{ name: "" }]));
      localStorage.setItem("fgc-graphics:state:v1", JSON.stringify(s));
    }, batch);
    await page.reload();
    await page.waitForFunction(
      () => [...document.querySelectorAll(".scaled-frame img")].every((i) => i.complete && i.naturalWidth > 0),
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(500);
    for (const label of ["16:9 · 1920×1080", "4:5 · 1080×1350"]) {
      await page.locator(".format-select .select-trigger").click();
      await page.getByRole("option", { name: label }).click();
      await page.waitForTimeout(400);
      const file = join(outDir, `${b + 1}-standings-${label.split(" ")[0].replace(":", "x")}.png`);
      await page.locator(".scaled-frame").screenshot({ path: file });
    }
    console.log(`batch ${b + 1}: ${batch.join(", ")}`);
  }
} finally {
  await browser.close();
  server.kill();
  process.exit(0);
}
