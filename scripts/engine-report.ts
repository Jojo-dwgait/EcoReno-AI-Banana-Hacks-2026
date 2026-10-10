/** Shows ranked recommendations per fixture city for a typical full-feature photo. Run: npx tsx scripts/engine-report.ts [priority] */
import { recommend, type Priority } from "../lib/recommendationEngine";
import { plantingPalette } from "../lib/regionalStyle";
import { fixtureSlugs, loadFixtureProfile } from "../tests/fixtures";
import { fullInventory } from "../tests/inventoryFixtures";

const priority = (process.argv[2] as Priority) ?? "balanced";
for (const slug of fixtureSlugs()) {
  const profile = loadFixtureProfile(slug);
  const recs = recommend({ profile, inventory: fullInventory(), priority });
  const picks = recs.filter((r) => r.preselected).map((r) => r.id);
  console.log(`\n${profile.place.label} [${profile.classes.koppen?.code}, ${profile.classes.aridityClass}, zone ${profile.classes.hardinessZone?.label}, ${profile.classes.thermalDominance}] palette=${plantingPalette(profile).key}`);
  console.log(`  picks: ${picks.join(", ") || "(none)"}`);
  for (const r of recs) {
    const b = r.breakdown;
    console.log(`  ${r.preselected ? "*" : " "} ${r.id.padEnd(17)} ${String(r.score).padStart(5)}  climate ${String(b.climate).padStart(5)}${r.blockedReason ? `  BLOCKED: ${r.blockedReason}` : r.lowRelevance ? "  (low relevance)" : ""}`);
  }
}
