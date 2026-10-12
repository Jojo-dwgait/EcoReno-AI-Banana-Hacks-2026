/** Diagnostic: shows the FLUX.1 Kontext Space's API (endpoints and parameters). Run: npx tsx scripts/probe-hf-space.mts */
import { Client } from "@gradio/client";
try {
  process.loadEnvFile(".env.local");
} catch {
  /* shell env */
}
const space = process.env.HF_EDIT_SPACE || "black-forest-labs/FLUX.1-Kontext-Dev";
const token = process.env.HF_TOKEN?.trim() as `hf_${string}` | undefined;
const client = await Client.connect(space, token ? { hf_token: token } : {});
const api = await client.view_api();
for (const [name, ep] of Object.entries(api.named_endpoints)) {
  console.log(`endpoint ${name}`);
  for (const p of ep.parameters) console.log(`  in  ${p.parameter_name ?? p.label}: ${JSON.stringify(p.python_type).slice(0, 120)}${p.parameter_has_default ? ` = ${JSON.stringify(p.parameter_default)}` : ""}`);
  for (const r of ep.returns) console.log(`  out ${r.label}: ${JSON.stringify(r.python_type).slice(0, 120)}`);
}
