# EcoReno AI: Progress

Execution log for PLAN.md (v4). Newest status first.

## Status: Sat Oct 10, ~11:00 AM PDT
Started at 10:45 AM instead of 8:30 AM (about 2¼ h behind PLAN.md §8). Recovery plan:
1. Build all keyless work first (Open-Meteo needs no key): setup, geocode, climate, site profile, tests, upload + slider UI.
2. The Gemini spike + generate route follow as soon as the key is in `.env.local` (expected ~11:45 AM). **CP1 moves to ~1:00 PM.**
3. Absorb the remaining delay from M5 polish time and the cut order in PLAN.md §8 (2050 mode is already expected to be cut).

## Done
- [x] Next.js 16.4 + TypeScript strict + Tailwind 4 + ESLint + Vitest + zod + tsx; git initialized (`main`)
- [x] `.gitignore` excludes env files, photos, PDFs, zip
- [x] `lib/http.ts`: timeout + exponential backoff on 429/5xx/network; 4xx not retried
- [x] `lib/geocode.ts` + `GET /api/geocode`: U.S.-only (50 states + DC), "City, ST" parsing, dedupe, exact-name ranking, no auto-pick
- [x] `lib/openMeteo.ts`: 2016–2025 archive, 8 daily variables, unit verification, land-cell selection, cache key on coordinates + window + variables + settings
- [x] `lib/climateMetrics.ts`: 15 metrics with coverage/quality; missing days never imputed
- [x] `lib/siteProfile.ts`: Köppen (Peel 2007), UNEP aridity, approximate hardiness zone, thermal dominance, bands
- [x] `POST /api/climate`: validated input, cached, structured logs
- [x] 49 unit tests passing; `tsc --noEmit` clean

## In progress
- [ ] Fixture recording for 9 acceptance cities (`npm run fixtures`)
- [ ] Upload (resize + EXIF strip), city picker, climate panel, slider UI

## Next
- [ ] Gemini key → `scripts/spike-edit.ts` → `/api/generate` (CP1)
- [ ] Photo candidates (free-licensed) for approval

## Verified commands
- `npm test` → 49 passed
- `npm run typecheck` → clean

## Decisions made during build
- Climate cache: own `KeyValueCache` (memory now, Upstash at deploy). Next's `use cache` doesn't persist on serverless and resets per deploy.
- Thermal dominance: cooling if CDD ≥ HDD; heating if HDD ≥ 2×CDD; else mixed.
