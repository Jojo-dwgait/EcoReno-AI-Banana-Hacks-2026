# EcoReno AI: Master Plan (v4, start to finish)

Banana Hacks 2026, solo. Plan v4, written Sat Oct 10 2026, ~12:45 AM PDT; it supersedes v1–v3. This file is the source of truth for scope and decisions. `PROGRESS.md` (created at M0) tracks execution.

---

## 0. Key dates (all PDT)

| Moment | Time |
|---|---|
| Hacking opened | Fri Oct 9, 5:45 PM |
| Build starts (M0) | **Sat Oct 10, 8:30 AM** |
| First public deploy | Sat Oct 10, by 11:30 PM |
| **Feature freeze** | **Sun Oct 11, 3:00 PM** |
| **Submit target** | **Sun Oct 11, 7:30 PM** |
| Hard deadline (conservative) | Sun Oct 11, 8:59 PM. The schedule page says 11:59 PM EDT and the prizes page says AoE; we plan to the earlier one |
| Winners announced | Mon Oct 12, 3:00 PM PDT. **Keep the live link working through judging** |

---

## 1. The idea on one page

**One-liner:** See *your* house redesigned for *your* climate: the same photo, edited, with the numbers behind every change.

**Problem:** Renovation inspiration (Pinterest, HGTV, generic AI makeovers) ignores local climate, and climate advice ("use drought-tolerant plants") never shows homeowners what that means for their house. People can't picture it, can't connect it to evidence, and don't act.

**Users:**
- **Primary:** a U.S. homeowner considering exterior upgrades.
- **Secondary**, using the same flow: renters (renter-friendly mode), home buyers checking a listing's climate fit, agents and sellers (with a disclosed concept watermark), landscapers, solar installers, and water utilities running rebate programs.

**Benefit:** A faithful concept image of their own home, 10 years of local climate evidence for each change, a cited value estimate, and next-step links, all before paying anyone.

### Core principles (every feature is checked against these)

| # | Principle | Means in practice | Rubric |
|---|---|---|---|
| 1 | **Image-first** | The product is an edit of the user's own photo. Climate data steers the edit; it never replaces it | C |
| 2 | **Faithful** | Same house, angle, light, weather and wear; only selected areas change. Failures are shown, never hidden | A, D, E |
| 3 | **Evidence-traced** | Every visible change links to a computed number or a cited source. No LLM ever writes a number | B, D |
| 4 | **Data, not stereotypes** | Adaptation comes from the site profile's numbers, never from a city's name | B |
| 5 | **Honest claims** | Estimates are labeled. No savings, permit or parcel-hazard claims, and never "will increase value" | D |
| 6 | **Open to anyone** | Any U.S. city, no login, plain language, accessible web app | D, E |

### What a judge should remember
1. "It edited the **same house** differently for two climates, and showed exactly why."
2. "Every change had a **number and a source**, and it **checked its own edit**."
3. "I'd actually use this before calling a contractor."

---

## 2. Rubric strategy (5 rows × 5 points)

| Row | 5-point descriptor (rubric) | Our proof | Demo moment | Write-up line |
|---|---|---|---|---|
| **A** Technical | Real engineering with image AI, multi-step pipeline, thoughtful model choices, works reliably | 8-stage pipeline: vision analysis → geocode → climate → site profile → scoring → edit plan → image edit → review + pixel change map, with auto-retry, tests and a measured fidelity table | Live stepper naming each stage; change-map toggle | "Three model roles plus deterministic stages; measured fidelity: X% of changes visible, Y% pixel drift" |
| **B** Innovation | Genuinely new, unexpected combination, surprises the judge | Same photo, different climates, visibly different edits (planting palette, trees, roof), each traced to a number. Pins on the image link to the evidence | Side-by-side climate comparison of the same house | "Climate data becomes a visual design brief for a real photo" |
| **C** Image AI | Without it the product stops working; "image everything" | Image at every stage: photo in → features gate the recommendations → edit of the same photo → vision review → pixel diff | The slider reveal | "Remove the image model and nothing is left" |
| **D** Impact | Real problem, clear user and benefit, path beyond the weekend | Homeowner user; value estimate before → after; next-step links (incentives by state, EPA WaterSense); honest limits | Value panel (≤15 s) + limits line | Rebate-program and contractor-proposal path; Open-Meteo commercial tier for scale |
| **E** Design / demo | Clean UI, polished output, ≤3-min demo, clear write-up | Photo-first markup + field-report change log; flawless judge path; ≤170 s video; ≤500-word write-up | The whole video | — |

**The judge path is the product.** Judges "test live demos where they can." Most will open the link and click the sample house. So:
- Landing → "Try a sample house" → full result **from cache in under 3 seconds** → "Try another city" runs live.
- This path gets built in M5 and tested from a fresh browser in M8.

**Award categories** (every project is considered for all of them):
- **Best Creative Tool:** primary target.
- **Most Surprising Output:** the same-house comparison across climates.
- **People's Choice:** a shareable comparison image, posted in Discord on demo day.

---

## 3. User experience

### 3.1 Screens
1. **Start:** upload a photo or "Try a sample house". One-line privacy note.
2. **Location:** city search → U.S.-only results with state and county → explicit pick (Portland, OR vs Portland, ME). Priority: **Balanced** (default) · Save water · Stay cool · Manage rain. Renter-friendly toggle (P2).
3. **Review:** climate evidence panel (2016–2025, units, source, coverage) with site-profile badges (climate type, aridity, plant zone, heating vs cooling). Detected features appear as editable chips with confidence. Photos that aren't a house exterior are rejected politely.
4. **Choose:** ranked cards (score breakdown, evidence chain, where in the photo). Top picks are preselected; the user keeps 1–3.
5. **Generate:** live stepper: Planning edit → Editing your photo → Checking fidelity → (Retrying with a narrower edit) → Done.
6. **Result:**
   - Before/after slider with numbered pins.
   - Change-log cards below the slider.
   - Fidelity report with a change-map toggle.
   - Value panel.
   - "Compare another city" on the same photo, side by side.
   - Download a watermarked concept sheet.
   - Next-step links.

### 3.2 Design system (decided): photo-first markup + field-report change log
- **Hero:** full-width slider. Numbered pins on the changed areas, drawn like an architect's markup (thin lines, small markers).
- **Change log:** one card per pin, numbered to match. Each card: what changed · where · what was preserved · evidence chain (metric, units, years, source) · fidelity status (✓ / ⚠). Clicking a pin scrolls to its card; hovering a card highlights its pin.
- **Type:** monospace for numbers, plain sans-serif for prose. Restrained earthy palette with one accent. Light and dark themes.
- **Avoid:** purple gradients, glow, emoji icons, the centered hero with three feature cards, and the cream-serif-sage "tasteful default".
- **Components:** `PhotoInput`, `CityPicker`, `PriorityPicker`, `ClimateEvidence`, `ProfileBadges`, `FeatureChips`, `RecommendationCard`, `PipelineStepper`, `BeforeAfterSlider`, `Pin`, `ChangeCard`, `FidelityReport`, `ChangeMap`, `ValuePanel`, `CompareView`.

### 3.3 Accessibility (checked in M5 and M8)
Scope (decided Oct 10): **desktop web app only**. No mobile-specific features or phone testing; the existing responsive Tailwind layout stays as-is but isn't a QA target.
- WCAG AA contrast in both themes.
- Slider works with arrow keys and exposes `aria-valuenow`.
- Visible focus on every control; labels on every input.
- Alt text for the edited image comes from the reviewer's description.
- Reduced motion is respected.

---

## 4. Architecture

### 4.1 Pipeline
```text
photo ──► [1] scene analysis (Gemini vision, JSON) ─► house gate · features · boxes · confidence
                                                        │ user confirms/corrects
city ───► [2] geocode (Open-Meteo, U.S. only, explicit pick)
              └► [3] climate (Open-Meteo archive 2016–2025) ─► [4] site profile (metrics + classes)
                                                        ▼
                    [5] scoring (gates → relevance · benefit · feasibility · preference → Balanced)
                                                        │ user selects 1–3
                                                        ▼
                    [6] edit plan {changes, targets, regional style, preserve, forbidden}
                                                        ▼
                    [7] image edit (original photo in) ─► normalize to original size
                                                        ▼
                    [8] review: vision checklist + pixel change map ─► ≤1 narrower retry
                                                        ▼
        result: slider + pins + change log + fidelity + value panel + compare city
```

### 4.2 Model roles (Gemini via the `@google/genai` SDK; exact model IDs verified in M0)
| Role | Model | Why | Output |
|---|---|---|---|
| Scene analyst | Gemini Flash (vision) | Native bounding boxes; structured output; free tier | JSON validated with zod |
| Editor | Gemini image model (Nano Banana family) behind the `imageEditClient` adapter | Strong edit-in-place; free tier if available. Swaps to the credits provider, or to fal FLUX Kontext if fidelity fails. **No spend without approval** | Edited image |
| Reviewer | Gemini Flash (vision), plus the pixel change map as a check that uses no model | Checklist per change and per preserved element; the change map covers the "grading its own homework" gap | JSON verdict + heatmap |
| Everything else | Deterministic TypeScript | Geocoding filter, metrics, classes, scoring, explanations, prompt assembly, value math | Typed objects |

### 4.3 Repo layout (repo root = this folder; PDFs, zip and photos are gitignored)
```text
app/page.tsx                      app/api/{geocode,climate,analyze-photo,recommend,generate,home-value,hazards}/route.ts
components/*.tsx                  (section 3.2 list)
lib/openMeteo.ts                  fetch, retry/backoff, timeouts, cache keys
lib/climateMetrics.ts             metrics + coverage (pure)
lib/siteProfile.ts                Köppen, aridity, hardiness zone, HDD/CDD dominance, bands (pure)
lib/interventions.ts              catalog + gates + relevance functions + style descriptors
lib/recommendationEngine.ts       scoring + Balanced selection (pure)
lib/renovationPrompt.ts           edit plan → prompt (no numbers, no city names)
lib/imageEditClient.ts            provider adapter (Gemini now; credits / fal later)
lib/visionClient.ts               scene analysis + review (structured)
lib/consistencyCheck.ts           review orchestration + retry policy
lib/changeMap.ts                  pixel diff (runs in the browser canvas)
lib/homeValue.ts                  comps → regression → cited premiums (pure math + RentCast client)
lib/cache.ts · lib/rateLimit.ts   Upstash Redis (in-memory fallback in dev)
data/premiums.json                cited value studies (verified before use)
tests/*.test.ts                   Vitest; fixtures in tests/fixtures/
scripts/{spike-edit,record-fixtures,fidelity-eval,smoke}.ts
```

### 4.4 API routes
| Route | In → out | Notes |
|---|---|---|
| `GET /api/geocode?q=` | text → U.S. candidates `{id, name, admin1, admin2, lat, lon, tz, population}` | Filter `country_code=US`; never auto-pick |
| `POST /api/climate` | `{lat, lon, tz}` → `SiteProfile` | Cache key: rounded coordinates + window + variables + model; timeout + retry/backoff |
| `POST /api/analyze-photo` | image → `FeatureInventory` | Never stored or logged |
| `POST /api/recommend` | `{profile, features, priority, renterMode}` → `Recommendation[]` | Pure function; the route exists for structured logging |
| `POST /api/generate` | `{image, editPlan}` → `{image, review, attempts}` | Rate-limited; `maxDuration` set; ≤2 attempts |
| `POST /api/home-value` (P1) | `{lat, lon, beds?, baths?, sqft?, type, upgrades}` → `ValueEstimate` | RentCast; cached hard; fixtures in dev |
| `GET /api/hazards` (P2) | `{state, county}` → FEMA National Risk Index ratings | County-level, labeled |

### 4.5 Core data contracts (sketch)
```ts
type Sourced<T> = { value: T | null; unit: string; source: string; period?: string; granularity: 'grid'|'county'|'city'; quality: 'ok'|'partial'|'unavailable' };
type SiteProfile = { place: {id, name, state, county, lat, lon, gridLat, gridLon, elevationM};
  metrics: { annualPrecipMm, annualEt0Mm, waterDeficitMm, dryMonths, hotDays, extremeHeatDays, freezeDays,
             cdd, hdd, heavyRainDays, solarKwhM2Day, snowfallCm, windMaxMeanKmh }: Record<string, Sourced<number>>;
  classes: { koppen, aridityIndex, aridityClass, hardinessZone, thermalDominance, solarBand, rainBand, snowBand };
  hazards?: Record<string, Sourced<string>>; projection2050?: Record<string, Sourced<number>> };
type FeatureInventory = { isResidentialExterior: boolean; features: Record<'roof'|'lawn'|'paving'|'windows'|'downspout'|'openYard'|'wall',
  { visible: boolean; confidence: number; box?: [number, number, number, number] }>; propertyType; stories; uncertainties: string[] };
type Recommendation = { id; category: 'water'|'heat'|'energy'|'stormwater'; score; breakdown: {climate, benefit, feasibility, preference};
  evidence: Array<{metric: string; value: string; why: string}>; targetBox?; renterFriendly: boolean; blockedReason?: string };
type EditPlan = { changes: Array<{id, instruction, targetArea, styleDescriptors: string[]}>; preserve: string[]; forbidden: string[]; climateBasis: string[] };
type ReviewResult = { perChange: Array<{id, status: 'visible'|'partial'|'missing'}>; perPreserve: Array<{item, kept: boolean}>;
  unrequestedChanges: string[]; verdict: 'pass'|'retry'|'flag'; altText: string };
type ValueEstimate = { comps: Comp[]; model: {n, r2, predictors}; current: {low, mid, high}; perUpgrade: Array<{id, low?, high?, source?}>;
  withUpgrades: {low, high}; caveats: string[] };
```

---

## 5. Data and logic

### 5.1 Climate fetch and metrics
- **Request:** `archive-api.open-meteo.com/v1/archive`, 2016-01-01 → 2025-12-31, `timezone=<tz>`. Daily variables (9, so the request isn't double-counted):
  - `temperature_2m_max`, `temperature_2m_min`, `temperature_2m_mean`
  - `precipitation_sum`, `snowfall_sum`
  - `shortwave_radiation_sum`, `et0_fao_evapotranspiration`
  - `wind_speed_10m_max`
  - plus a land-cell setting if the archive supports it
- **Units:** internally °C, mm, MJ/m² and km/h; displayed in °F and inches by default with a toggle.
- **Metrics:**
  - Annual precipitation; annual ET₀; water deficit (ET₀ − P).
  - Dry months/yr: months where mean P < 0.5 × ET₀.
  - Hot days: Tmax ≥ 90 °F. Extreme heat days: Tmax ≥ 100 °F. Freeze days: Tmin ≤ 32 °F.
  - CDD/HDD per year (base 65 °F).
  - Heavy-rain days: ≥ 1 in. This is runoff context, **not flood risk**.
  - Solar: kWh/m²/day (MJ ÷ 3.6).
  - Snowfall per year; mean of the annual maximum wind.
- **Coverage:** valid days ÷ expected days, per variable. Below 90% the metric is flagged; values are never imputed.
- **Labels:** "Modeled historical estimates (reanalysis), not on-site measurements", plus source link, retrieval date, grid coordinates and elevation.
- **Free-tier budget:** each 10-year request costs ~261 call-equivalents. The persistent cache is mandatory; acceptance cities are pre-warmed.

### 5.2 Site profile classes (pure, unit-tested)
- **Köppen** (Peel et al. 2007 rules) from monthly mean T and P:
  - A: coldest month ≥ 18 °C.
  - B: precipitation below the aridity threshold (`20·T̄ + 0/140/280`, by rain seasonality).
  - C: coldest month 0–18 °C. D: coldest month < 0 °C. E: hottest month < 10 °C.
  - Plus the s/w/f and a/b/c sub-letters.
- **Aridity index** = P / ET₀. Classes: hyper-arid < 0.05 < arid < 0.20 < semi-arid < 0.50 < dry sub-humid < 0.65 ≤ humid.
- **Hardiness zone (approximate):** mean of each year's lowest Tmin in °F, mapped to `zone = floor((T + 60) / 10) + 1`, with "a" for the lower half of the band and "b" for the upper. Labeled "approximate (10-year)".
- **Thermal dominance:** cooling if CDD ≥ 0.6 × HDD, heating if HDD ≥ 2 × CDD, else mixed.
- **Bands:** solar (low < 3.5 ≤ mid < 4.5 ≤ high kWh/m²/day), rain (heavy-rain days), snow (annual snowfall).

### 5.3 Recommendation engine
`score = 0.40·climate_relevance + 0.30·benefit_proxy + 0.20·visible_feasibility + 0.10·user_preference`, each 0–100. These are disclosed design heuristics, not science. Hard gates run before ranking.

| Intervention | Category | Gate (confirmed features) | Climate relevance (starting breakpoints, tuned on fixtures) | Benefit | Renter |
|---|---|---|---|---|---|
| Lawn → regional native planting + mulch | Water | `lawn` | 0.7·lin(deficit 0→800 mm) + 0.3·lin(dry months 0→6) | 80 | Partial |
| Rooftop solar (illustrative) | Energy | `roof` with a camera-facing plane | lin(solar 3.0→5.5 kWh/m²/day) | 85 | No |
| Cool roof | Heat | `roof`, thermal ≠ heating | lin(CDD 500→3000) | 60 | No |
| Shade tree (deciduous if heating or mixed) | Heat | `openYard`, entry not blocked | lin(hot days 10→120) | 70 | No |
| Window awnings / shade sail | Heat | `windows` | 0.6·lin(hot days) + 0.4·lin(solar) | 55 | Sail: yes |
| Rain garden | Stormwater | `openYard` | 0.7·lin(heavy-rain days 2→15) + 0.3·lin(P 300→1300 mm) | 65 | No |
| Permeable pavers (same footprint) | Stormwater | `paving` | lin(heavy-rain days 2→15) | 50 | No |
| Rain barrels | Water | `wall` (downspout helps) | 0.5·lin(dry months 1→6) + 0.5·lin(P 200→800 mm) | 40 | Yes |
| Evergreen windbreak | Energy | `openYard` at the side | 0.6·lin(HDD 2000→8000) + 0.4·lin(freeze days 20→150) | 50 | No |

- **Feasibility:** feature confidence × 100; a user-confirmed feature counts as 100.
- **Preference:** Balanced gives every category 50. A focused priority gives its category 100 and the rest 30.
- **Balanced selection:** take the top score, then add the best item from an uncovered category only if it scores ≥ 55 and is within 15 points of the redundant alternative. Never force diversity the data doesn't support.
- **Renter mode (P2):** filter to renter-friendly items and use the removable variants (shade sail, containers, rain barrel).
- **Card copy:** templated from metrics. LLMs never write numbers.

### 5.4 Regional adaptation table (profile → visual descriptors for the prompt)
| Profile condition | Descriptor |
|---|---|
| Aridity arid/hyper-arid + zone ≥ 9 | desert-adapted succulents, agave-like rosettes, decomposed-granite and gravel ground cover |
| Semi-arid or dry sub-humid, Köppen Cs or B | drought-tolerant native shrubs, ornamental grasses, gravel mulch |
| Humid + zone ≤ 6 | native prairie grasses, coneflower-type perennials, shredded-bark mulch |
| Humid + zone ≥ 9 | lush native flowering shrubs and broadleaf plants, mulch beds |
| Otherwise | mixed native perennials and grasses, bark mulch |
| Heating or mixed thermal | shade tree is **deciduous** (bare in winter) |
| Cooling | shade tree is broad-canopy; roof tone light (only if the cool roof is selected) |
| County wildfire rating high (P2) | **gravel, not bark, within ~5 ft of the house** |
| Rain band high | rain garden shown as a shallow planted depression with river rock at the inlet |

No species names unless verified. The prompt receives descriptors only.

### 5.5 Home value model (P1)
- **Comps:** RentCast valuation endpoint at the city's center point, using property type and stories from the photo plus optional beds/baths/sqft. Show 5–10 comps with sources.
- **Regression:** `log(price) ~ log(sqft) + beds + baths + age`; `log(price) ~ log(sqft)` when n < 12; comp median when R² < 0.3 or n < 6. Show n, R², the interval, and RentCast's own estimate as a sanity check.
- **Framing:** estimated current value → estimated value with the selected upgrades, as a range itemized per upgrade, mirroring the slider.
  - Only cited premiums count (`data/premiums.json`, each verified before use; solar is the main one).
  - Others say "No reliable published estimate".
  - Always say "associated with" / "estimated", never "will increase".
  - Always include "Value added is not profit; upgrades cost money"; show cost ranges only where cited.
  - Label "Illustrative, not an appraisal".
- **Budget:** 50 free requests/month. Cache by rounded coordinates + attributes; fixtures in dev; pre-warm the demo; fall back gracefully at the cap.

### 5.6 Stretch layers (P2, in this order)
1. **Renter-friendly mode** (~1 h): a filter plus removable variants.
2. **FEMA National Risk Index** (~2 h):
   - County ratings (wildfire, drought, heat wave, riverine flooding, hurricane, winter weather) from the public FEMA service. Always labeled "county-level, not your lot".
   - Drives the fire-safe mulch descriptor and adds context lines to cards.
   - One-time data access needs your approval.
3. **2050 mode** (~3–4 h, likely cut):
   - Open-Meteo climate projections, 3 models. Compare each model's 2041–2050 against its own 2016–2025 and apply the delta to the historical metrics.
   - Labeled "high-emissions scenario, 3-model median"; re-ranks and offers a second edit.

---

## 6. Image pipeline

- **Edit plan → prompt:** CLAUDE.md template + `changes` (instruction + target area + regional descriptors) + `preserve` + `forbidden`. **No numbers, no city names.**
  - Preserve: roofline, windows/doors, driveway footprint, camera angle, lighting, weather, wear, neighbors.
  - Forbidden: new concrete, new structures, repainting, sky or weather change.
- **One call vs chained:** default is one call with ≤3 changes, plus a targeted follow-up only for changes the review marks missing. Confirmed or changed in M0.
- **Normalization:** resize or crop every output to the original's dimensions and aspect ratio before the slider and change map. Return JPEG/WebP so responses stay under 4.5 MB.
- **Review:** the vision checklist returns `ReviewResult` and alt text.
- **Change map** (browser canvas, free):
  - Downscale both images to 512 px, blur, compute a per-pixel color difference, threshold it.
  - Render a heatmap and report the % changed overall and the % changed outside target boxes.
- **Retry policy:**
  - Missing change, or geometry/preserve failure → retry once with fewer changes or stronger preserve wording.
  - Still failing → show the result with the issues listed.
  - Never show an unrelated image as an "after".
- **Masks:** only if M0/M4 show prompt-only edits spilling into protected areas.
- **Disclosure:** the downloaded concept sheet carries a "AI concept, not actual property" watermark and names the model that made the image.

---

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Privacy | Photos processed in memory only; never stored, logged or committed. Client re-encode strips EXIF/GPS. No street address ever. Privacy note says Gemini's free tier may use inputs to improve Google products |
| Security | Keys server-only; `.env.local` gitignored; secret scan before the repo goes public. Upload validation: type (JPEG/PNG/HEIC→JPEG), ≤ 10 MB before resize, dimensions. Text inside an uploaded photo is treated as data; structured outputs only |
| Cost / abuse | Upstash Redis rate limit: per-visitor (~5 generations/hour) + global daily cap. Sample house served from cache. ≤2 edit attempts per request. Live link open with limits; at the cap, show an honest message + sample results |
| Performance budget | Cached climate < 300 ms; uncached < 6 s; analysis < 8 s; edit < 40 s; review < 10 s; sample-house result < 3 s |
| Errors (typed codes) | `GEOCODE_NO_MATCH`, `GEOCODE_UNAVAILABLE`, `CLIMATE_UNAVAILABLE`, `CLIMATE_PARTIAL`, `NOT_A_HOUSE`, `ANALYSIS_FAILED`, `EDIT_QUOTA`, `EDIT_FAILED`, `REVIEW_FAILED`, `RATE_LIMITED`, `VALUE_UNAVAILABLE`. Each has user copy and a recovery action |
| Logging | Structured JSON per stage: request id, stage, model id, duration, outcome. Never images, coordinates beyond the city id, or keys |

---

## 8. Build schedule (milestones)

Each milestone ends with tests passing and a commit. Times are PDT.

### Saturday Oct 10
| Time | Milestone | Tasks | Done when | Rubric |
|---|---|---|---|---|
| 8:30–10:00 | **M0 Setup + fidelity spike** | `git init`; Next.js + TS strict + Tailwind + Vitest + zod; `.gitignore` (env, photos, PDFs, zip); `.env.example`; `PROGRESS.md`. Verify Gemini model IDs and free-tier limits. Find 3 free-licensed photo candidates (you approve the download). Run `scripts/spike-edit.ts` on 1 photo × 2 plans; record latency and output size/aspect; one-call vs chained | A real edited version of the sample photo is saved locally, with notes in `PROGRESS.md` | A, C |
| 10:00–1:30 | **M1 Vertical slice** | `PhotoInput` (resize ≤ 1536 px, re-encode, validate); `/api/geocode` + `CityPicker` (U.S. filter, disambiguation); `/api/climate` (fetch + basic metrics); `/api/generate` with a fixed simple plan; `BeforeAfterSlider` | Locally: photo → pick Irvine → generate → slider shows **the same photo edited** | C, A |
| 1:30–2:00 | Lunch + **CP1** | | | |
| 2:00–4:30 | **M2 Climate + site profile** | All metrics with coverage and units; °F/°C; `siteProfile.ts` (Köppen, aridity, zone, dominance, bands); retry/backoff/timeouts; cache; `record-fixtures.ts` for the acceptance cities; unit tests; **choose the contrast city from data** | Tests pass; Phoenix/Miami/Minneapolis/Seattle/Anchorage classes as expected; contrast city picked | A, B, D |
| 4:30–7:30 | **M3 Analysis + recommendations** | `/api/analyze-photo` (house gate, features, boxes); `FeatureChips` with correction; `interventions.ts` + engine + Balanced; `RecommendationCard` with evidence chain; tests (gates, determinism, Phoenix ≠ Seattle, no forced diversity) | Correct features on the sample photo; different top picks for Irvine vs the contrast city | A, B, C |
| 7:30–8:00 | Dinner + **CP2** | | | |
| 8:00–11:30 | **M4 Edit plan, review, result, deploy** | `renovationPrompt.ts` with regional descriptors; normalization; review + retry; `changeMap.ts`; result screen with pins + change log + fidelity report. **Create the GitHub repo (private) + first Vercel deploy**; Upstash cache + rate limit; env vars in Vercel | The deployed URL runs the full pipeline for Irvine end to end | A, C, E |
| 11:30 | **CP3** → sleep | | | |

### Sunday Oct 11
| Time | Milestone | Tasks | Done when | Rubric |
|---|---|---|---|---|
| 7:30–10:30 | **M5 Judge path + polish** | Pre-generate sample results (Irvine + contrast city); "Try a sample house" from cache; `CompareView` (same photo, 2–3 cities, plus a shareable comparison image); error states for every code; a11y pass; watermarked concept-sheet download; next-step links | Fresh browser: sample result < 3 s; compare works live | B, E, D |
| 10:30–1:00 | **M6 Value panel** | Verify cited studies → `premiums.json`; RentCast client with fixtures; regression; `ValuePanel` (current → with upgrades, itemized, caveats) | Value panel renders for the demo cities with sources; graceful fallback at the cap | D |
| 1:00–1:30 | Lunch + **CP4** | | | |
| 1:30–3:00 | **M7 Stretch** | Renter mode → FEMA National Risk Index → (2050 only if well ahead) | Each shipped stretch item is tested and labeled | B, D |
| **3:00** | **FEATURE FREEZE** | Bug fixes only after this point | | |
| 3:00–3:45 | **M8a Eval + bug bash** | `fidelity-eval.ts`: 5 photos × 2 plans → README table; full QA checklist (section 9) | Table filled; no P0 bugs | A |
| 3:45–4:45 | **M8b Docs** | README (section 12), architecture diagram, screenshots, credits and licenses, AI disclosure | README complete | E |
| 4:45–6:15 | **M8c Demo video** | Record in Screen Studio from pre-generated results; your narration; ≤ 170 s; upload unlisted | Video ≤ 3:00, uploaded | E |
| 6:15–7:00 | **M8d Write-up + verification** | ≤ 500-word write-up; Devpost fields; fresh-browser test of the live link; secret scan; **make the repo public (with your OK)** | Every item in section 13 checked | E |
| **7:00–7:30** | **Submit** | Buffer to 8:59 PM | Submitted | — |

### Checkpoints and cut lines
| Checkpoint | Question | If no |
|---|---|---|
| **CP1** Sat 1:30 PM | Does the same-photo edit work on Gemini's free tier? | Immediately decide on credits or a paid fallback (your approval). If still blocked at 2:30 PM, cut the value panel to win back time |
| **CP2** Sat 8:00 PM | Analysis + engine done? | Cut the change map (keep the vision review); pins become numbered cards only |
| **CP3** Sat 11:30 PM | Deployed? | Sunday starts with deployment before anything else |
| **CP4** Sun 1:30 PM | Value panel done? | Ship comps + cited premiums without the regression, or cut the panel |
| **Freeze** Sun 3:00 PM | — | No new features, no exceptions |

**Cut order, first to go:** 2050 mode → FEMA hazards → renter mode → value regression → value panel → pins → change map → auto-retry.

**Never cut:** the same-photo edit, real climate data, the evidence on recommendations, the slider, the deployed link, the sample-house path.

---

## 9. Testing and evaluation

- **Unit (Vitest):**
  - Climate metrics: units, missing days, thresholds, leap years, coverage.
  - Site profile: Köppen for fixture cities; aridity, zone and dominance boundaries.
  - Geocode filtering: U.S.-only, Portland OR/ME, Springfield IL/MA, no-match.
  - Engine: gates, determinism, contrast between cities, no forced diversity, renter filter.
  - Edit plan: preserve and forbidden lists present; no numbers or city names in the prompt.
  - Value math: regression fallback rules, premium itemization, caveats present.
- **Integration (mocked fetch):** timeout / 429 / 500 → retry → typed error for Open-Meteo, Gemini and RentCast.
- **Fixtures:** real recorded Open-Meteo responses for Irvine, Seattle, Phoenix, Minneapolis, Miami, Portland OR, Portland ME, Anchorage and Honolulu (recorded once via script, committed).
- **Smoke (`npm run smoke`, live APIs):** the acceptance cities, plus a no-match string and a forced provider failure.
- **Fidelity eval:** 5 photos × 2 plans through the full pipeline → % of changes visible, % pixel change outside targets, retries, and latency, published in the README.
- **Manual QA checklist (M5, M8):**
  - Fresh incognito desktop browser (Chrome + Safari); light and dark mode; keyboard-only run.
  - Slow network; a non-house photo; a HEIC upload.
  - Rate limit reached; quota reached; RentCast cap reached.
- **Before each commit:** `tsc --noEmit`, lint, tests.

## 10. Deployment
- GitHub repo `ecoreno-ai`, private until M8d, then public with your OK.
- Vercel project linked to the repo. Env vars set in the Vercel dashboard by you: `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RENTCAST_API_KEY`.
- `maxDuration` on the generate route (verify the plan limit).
- Pre-warm the cache for the demo cities after each deploy.
- Keep the deployment, keys and quotas alive through Mon Oct 12 judging; don't push risky changes after submission.

## 11. Demo video script (target ≤ 170 s)
| Time | Shot | Narration (gist) |
|---|---|---|
| 0:00–0:15 | Sample house photo on the start screen | "Renovation ideas ignore your climate. EcoReno shows *your* house redesigned for *your* climate, with the numbers behind every change." |
| 0:15–0:40 | Type "Portland" → OR and ME shown → choose Irvine, CA; climate panel + profile badges | "Any U.S. city. Ten years of real data: semi-arid, plant zone 10, 1-inch storms are rare…" |
| 0:40–1:05 | Feature chips → ranked cards → pick 2–3 | "It reads the photo (lawn, roof, windows) and only suggests what fits this house and this climate." |
| 1:05–1:40 | Stepper → slider reveal → pins → change log → change-map toggle | "Same photo, edited. Every pin links to its evidence, and the app checks its own edit: here's exactly what changed." |
| 1:40–2:10 | Compare: same photo, contrast city, side by side | "Same house in [contrast city]: different data, different design. No stereotypes, just numbers." |
| 2:10–2:25 | Value panel | "Comparable homes and cited studies estimate what these upgrades are associated with. Not an appraisal." |
| 2:25–2:50 | Architecture diagram → limits → URL + repo | "Three model roles plus deterministic stages. It's a concept tool, not a site survey. Try it at…" |

## 12. Write-up and README outlines
- **Devpost write-up (≤ 500 words):**
  - What it is (~60 words) · the problem and who it's for (~70) · how it works: pipeline and model roles (~150).
  - What's new (~60) · honesty and limits (~60) · what's next (~50) · built with + AI-assistance disclosure (~50).
- **README:**
  - Hero GIF/screenshot · live link · what and why · how it works (diagram + model roles) · fidelity eval table.
  - Data sources and licenses: Open-Meteo (CC BY 4.0), Copernicus ERA5 attribution, CMIP6 (if 2050 ships), FEMA National Risk Index (if shipped), RentCast, photo credit.
  - Setup (env vars, scripts) · tests · limitations · AI-assistance disclosure (built with Claude Code) · license.

## 13. Submission checklist
- [ ] Live URL works from a fresh incognito desktop browser (sample path + one live run)
- [ ] Repo public; history shows commits inside the event window; secret scan clean; no photos of private homes
- [ ] Video ≤ 3:00, unlisted link works logged-out
- [ ] Write-up ≤ 500 words (counted)
- [ ] Screenshots, credits, licenses, AI disclosure
- [ ] Devpost fields complete (you confirm any extra portal fields)
- [ ] Submitted by 7:30 PM PDT; screenshot of the confirmation
- [ ] After submitting: Discord post with the comparison image for People's Choice; keep the link alive through Monday

---

## 14. Risks
| Risk | Mitigation |
|---|---|
| Gemini free tier refuses image edits or has a tiny quota | Found in M0. Credits form; paid fallback only with approval; cached sample path always works |
| Editor alters geometry or invents structures | Preserve/forbidden lists; review + retry; masks as fallback; issues flagged on screen |
| Output size/aspect differs from the input | Normalize in M0/M4 |
| Open-Meteo 429 from shared Vercel IPs | Persistent cache; pre-warmed fixtures; honest retry message |
| Quota drained by a heavy user before judges arrive | Per-visitor limit + daily cap; sample from cache |
| Two cities produce the same picks | Contrast city chosen from data in M2; never forced |
| Value regression on few comps | Fallback rules; n and R² shown; "not an appraisal" |
| Value panel crowds out the image (weaker Row C) | Below the slider; ≤ 15 s in the demo |
| Solo time pressure | Checkpoints, cut order, freeze, deploy Saturday |

## 15. Decisions log
| Topic | Decision |
|---|---|
| Image editor | Gemini image model (free tier) behind an adapter; credits provider when available; fal FLUX Kontext as fidelity fallback; **no spend without approval** |
| Vision (analysis + review) | Gemini free tier + pixel change map as the model-independent check |
| Home value | Comps + our regression + cited premiums; current → with-upgrades framing; "associated with", never "will increase"; cost caveat |
| Location | Data-only site profile; city center point only (no ZIP) |
| Hazards | FEMA National Risk Index, county-level, P2 |
| Stretch | Renter mode → FEMA hazards → 2050 mode |
| Demo photo | Free-licensed real photo; your own house only for private tests |
| Live link | Open with limits; cached sample house |
| Look | Photo-first markup + field-report change log |
| Platform (Oct 10) | Desktop web app only; no mobile-specific work |

## 16. Inputs and accounts (yours)
| When | Item |
|---|---|
| M0 | Google AI Studio key → paste into `.env.local` yourself; approve photo downloads |
| Any time | Hackathon compute-credits form when it appears (tell me the provider) |
| M4 | Vercel account; Upstash Redis account (free); OK to create the private GitHub repo with `gh` |
| M6 | RentCast Developer key (free) |
| M7 | OK for FEMA data access, if we reach it |
| M8 | Narration for the video; OK to make the repo public; final Devpost submission |

## 17. Out of scope
Accounts, payments, utility-savings claims, permits or building code, parcel hazard maps, structural feasibility, fine-tuning, ZIP/address input, a Spanish UI, masks (unless needed).
