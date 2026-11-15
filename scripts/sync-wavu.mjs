// Pulls the Tekken 8 roster from Wavu Wiki into src/data/tekken8-roster.json.
// Run it with: npm run sync:roster
import { writeFileSync } from "node:fs";

const API = "https://wavu.wiki/w/api.php";
const UA = "t8.yiliya.studio/0.1 (roster sync script)";

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const tpl = await api({ action: "parse", page: "Template:CharSelectT8", prop: "wikitext" });
const wikitext = tpl.parse.wikitext["*"];
const characters = [...wikitext.matchAll(/\{\{CharSelectCharT8\|([^|}]+)\|([^|}]+)/g)].map((m) => ({
  name: m[1].trim(),
  slug: m[2].trim(),
}));
if (characters.length < 30) throw new Error(`Roster parse looks wrong (${characters.length} characters)`);

const out = {
  source: "https://wavu.wiki/t/Template:CharSelectT8",
  syncedAt: new Date().toISOString().slice(0, 10),
  characters,
};
writeFileSync("src/data/tekken8-roster.json", JSON.stringify(out, null, 2) + "\n");
console.log(`${characters.length} characters.`);
