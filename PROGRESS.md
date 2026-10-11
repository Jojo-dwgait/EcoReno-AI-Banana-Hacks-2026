# EcoReno AI: Progress

Execution log for PLAN.md (v4). Newest status first.

## Status: Sat Oct 10, 6:15 PM PDT
All keyless work is built and tested (126 tests). **Still blocked on keys** (Gemini + Census) for CP1 (first real edit) and the real-data check of the value model. Since 1 PM: home-value model on official Census data, renter mode, manual feature marking fallback, verified next-step links, unslop-ui and unslop-text passes, README + WRITEUP drafts.

## Done
- [x] Scaffold: Next.js 16.4, TS strict, Tailwind 4, Vitest, zod, tsx, git (`main`), repo email = GitHub noreply
- [x] Nationwide geocoding (U.S.-only, explicit pick, CT planning regions, county labels)
- [x] Climate: 2016–2025 Open-Meteo archive, 15 metrics with coverage, unit checks, retry/backoff, cache
- [x] Site profile: Köppen, aridity, approximate hardiness zone, thermal dominance, bands
- [x] 9 real-city fixtures recorded; engine and profile tested on real data
- [x] Recommendation engine: 9 interventions, gates, disclosed weights, Balanced selection, regional style table
- [x] Edit plan + prompt (no numbers or place names), scene text sanitized
- [x] Gemini adapter (edit + vision analysis + review), output normalization to original pixels
- [x] Generate pipeline: edit → review → ≤1 strict retry → keep better; streamed NDJSON stages
- [x] Model-free pixel change map (browser) with drift outside target areas
- [x] Rate limits (per visitor + global daily)
- [x] UI: photo upload, city picker, climate evidence, feature chips, recommendation cards with score breakdown, stepper, result with pins + change log + fidelity report + watermarked download + prompt transparency
- [x] Home value: Census Geocoder (verified 7 states) + ACS PUMS weighted regression + B25077 + verified premium tiers (LBNL solar direct; USDA trees and Henry 1994 related)
- [x] Renter mode; manual feature marking when analysis is unavailable; next-step links (EPA, DOE, DSIRE)
- [x] Design pass (unslop-ui): Barlow Semi Condensed / IBM Plex Sans / IBM Plex Mono, International Orange accent, radius scale
- [x] README.md + WRITEUP.md (474 words) drafts, unslop-text clean
- [x] 126 tests passing; typecheck + lint clean

## Blocked / waiting on you
- [ ] `GEMINI_API_KEY` and `CENSUS_API_KEY` in `.env.local` → run spike: `npx tsx --conditions=react-server scripts/spike-edit.mts photos/<file>.jpg --list-models`
- [ ] Approve demo photo download (candidates: Unsplash 81ckTA9FXEE [preferred], L8SsHskRWIE, Ny6ZtbducqU)

## Next
- [ ] CP1: real edit on the demo photo; check output size/aspect, one-call vs chained, fidelity
- [ ] Tune prompts on real outputs; contrast run Irvine vs Minneapolis
- [ ] Sample-house path from cache; compare-cities view
- [ ] Deploy (Vercel) + Upstash rate limit/cache

## Verified commands
- `npm test` → 111 passed · `npm run typecheck` → clean · `npx eslint .` → clean
- `npx tsx scripts/profile-report.ts` · `npx tsx scripts/engine-report.ts [priority]`

## Decisions made during build
- Climate cache: own `KeyValueCache` (memory now, Upstash at deploy); Next's `use cache` doesn't persist on serverless.
- Thermal dominance: cooling if CDD ≥ HDD; heating if HDD ≥ 2×CDD; else mixed.
- Heat relevance = max(hot-day ramp, CDD ramp): gridded data under-counts coastal hot days (Miami: 14/yr vs CDD 4,388).
- Hardiness zone from reanalysis runs warm where cold snaps are sharp (Anchorage 6a vs USDA ~4b–5a) → labeled "approximate; may be colder".
- Engine runs client-side (pure, instant); the server recomputes the profile for generation instead of trusting the client.
- Contrast city from data: Minneapolis (most different on every axis); Phoenix as a third.
