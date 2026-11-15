// Takes screenshots of the editor and downloads each export, to check nothing looks broken.
// Run it with: npm run build && node scripts/snapshot.mjs <outDir>
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith("--")) ?? "snapshots");
mkdirSync(outDir, { recursive: true });

// A made-up dusk skyline, so the test doesn't need game art
const TEST_BACKGROUND = `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440">
  <defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1b2a6b"/><stop offset=".55" stop-color="#c2477a"/><stop offset="1" stop-color="#ffb35c"/></linearGradient></defs>
  <rect width="2560" height="1440" fill="url(#g)"/>
  <circle cx="1900" cy="900" r="220" fill="#ffe7a8"/>
  <path d="M0 1100H180V820H320V960H460V700H600V1000H780V860H920V620H1060V980H1240V780H1400V1040H1560V740H1700V1000H1880V880H2040V660H2200V960H2380V820H2560V1440H0Z" fill="#141022"/>
</svg>`;

// No shell, so kill() really stops the server
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", "4179", "--strictPort"], { stdio: "pipe" });
await new Promise((resolveReady, reject) => {
  server.stdout.on("data", (d) => String(d).includes("4179") && resolveReady());
  server.stderr.on("data", (d) => process.stderr.write(d));
  server.on("exit", (code) => reject(new Error(`vite preview exited (${code}) — is port 4179 in use?`)));
});

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));

  await page.goto("http://localhost:4179/");
  await page.waitForFunction(
    () =>
      !document.querySelector(".scaled-frame .art-placeholder") &&
      [...document.querySelectorAll(".scaled-frame img")].every((i) => i.complete && i.naturalWidth > 0),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, "editor.png") });

  async function exportAs(tab, formatLabel, name) {
    await page.getByRole("tab", { name: tab }).click();
    await page.locator(".format-select .select-trigger").click();
    await page.getByRole("option", { name: formatLabel }).click();
    await page.waitForTimeout(300);
    const t0 = Date.now();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PNG" }).click()]);
    await dl.saveAs(join(outDir, name));
    console.log(`${name}: ${Date.now() - t0}ms`);
  }
  await exportAs("Standings", "16:9 · 1920×1080", "standings-16x9.png");
  await exportAs("Standings", "4:5 · 1080×1350", "standings-4x5.png");

  await page.getByRole("button", { name: /^Style/ }).click();
  await page.getByRole("button", { name: "Choose background" }).click();
  await page.locator(".bg-popup input[type=file]").setInputFiles({ name: "test-stage.svg", mimeType: "image/svg+xml", buffer: Buffer.from(TEST_BACKGROUND) });
  await page.locator(".scaled-frame .bg-photo img").waitFor();
  const blur = page.getByRole("slider", { name: "Blur" });
  await blur.focus();
  for (let i = 0; i < 4; i++) await blur.press("ArrowRight");
  await page.screenshot({ path: join(outDir, "editor-background.png") });
  await exportAs("Standings", "16:9 · 1920×1080", "standings-bg-16x9.png");
  await exportAs("Standings", "4:5 · 1080×1350", "standings-bg-4x5.png");

  await page.getByRole("tab", { name: "Text post" }).click();
  console.log("--- text post ---\n" + (await page.locator(".textpost textarea").inputValue()));

  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  process.exit(process.exitCode ?? 0);
}
