# EcoReno AI — Claude Code Instructions (Nationwide MVP v4)

> Banana Hacks 2026 | Solo submission | **Claude Code owns the entire coding workflow** (user prefers Opus 5.5, subject to account availability)
> **Read this and `EcoReno_AI_Project_Plan.pdf` before coding.** The uploaded `Banana_Hacks_2026_Scoring_Criteria.pdf` is the authoritative supplied judging rubric. This file is implementation guidance, not an organizer rulebook.

## Mission and scope
Build a working **image-first**, location-aware sustainable home-renovation visualizer. Upload a real house photograph; retrieve **real historical climate estimates for any selected U.S. city**; calculate interpretable metrics; propose feasible interventions; let the user select them; edit the **same uploaded photo**; verify/present differences and explain their climate rationale.

**Geographic scope:** any U.S. city returned by the geocoder, including all 50 states and Washington, D.C. **Demo defaults only:** Irvine, California; Balanced sustainability. **Comparison:** use the same source photograph with a contrasting U.S. city selected by the user (e.g., Seattle). Never use unrelated example images as before/after proof. Primary project type: Category 1 (image generation / image editing / inpainting). Category 2 fine-tuning is NOT required.

## Banana Hacks scoring rubric — equal weight, total 25 points
The supplied rubric gives **five rows, each 1–5 points**. This is the rubric's language summarized accurately, not a promised score:

| Row | What a strong submission demonstrates | Implementation evidence |
|---|---|---|
| **A. Technical Execution & Difficulty** | Real engineering challenges in image AI; rubric cites custom training, fine-tuning **or a multi-step pipeline**; thoughtful model choices; reliable demo | Scene analysis → climate metrics → deterministic recommendation → structured editing instructions → image edit → consistency review; tests and retries |
| **B. Innovation & Creativity** | A fresh / genuinely original twist rather than a generic clone | Real climate-conditioned, property-preserving renovation generation, traceable from numerical evidence to visible change |
| **C. Use of Image AI Theme** | Image AI is the heart; app would not work without it | Uploaded-image transformation and faithful side-by-side proof are the central journey, not an optional illustration |
| **D. Impact & Usefulness** | Clear problem, user, benefit, plausible path beyond weekend | Homeowners can see *possible* location-aware improvements before seeking professional advice; source/limitation transparency |
| **E. Design, Presentation & Demo** | Clean interface and polished output; **demo ≤3 minutes** and clear write-up | One reliable scenario, understandable climate evidence, before/after slider, live deployed app, concise narration |

**Rubric anti-patterns:** thin API wrapper (A ~2), generic home makeover clone (B lower), weather dashboard plus decorative image (C lower), unsupported money/water-savings claims (D credibility), unrelated image pairs or messy demo (E lower). Scores are awarded by judges; do not self-claim 5/5.

## Prioritized MVP (build in this sequence)
1. **End-to-end vertical slice first:** upload house photo, selected U.S. city climate request, one appropriately constrained edit of uploaded image, before/after preview. Verify image-edit API works before building dashboard.
2. **Data credibility:** geocode any U.S. city; fetch Open-Meteo Historical Weather API daily records for Jan 1 2016–Dec 31 2025; compute values deterministically, surface units/date/source, handle missing days. Historical grids may be modeled estimates, not on-site measurements.
3. **Multi-step engineering pipeline:** photo feature inventory (`roof_visible`, `lawn_visible`, `paving_visible`, `windows_visible`, uncertainties); rule-based candidate scoring with applicability gates; user confirmation; structured change/preserve lists; image edit; post-edit consistency check. Log reasoning in readable structured records (not secrets / private photos).
4. **Visible polish:** recommendation cards with actual metric-backed explanation, same-image before/after slider, generation state/retry/error recovery, accessible mobile layout.
5. **Submission:** hosted working demo, public repo, README, 3-minute-or-less demo video, disclosure, screenshots, source links, concise limitations.

## Nationwide location resolution — non-negotiable
- **Never hardcode Irvine coordinates** as the sole supported city. Irvine is merely one demonstration fixture. Accept arbitrary city text (and optionally ZIP), query geocoding, **filter to country_code=US**, and let the user choose a distinct **city + state** result before analysis (e.g., Portland, OR vs Portland, ME; Springfield, IL vs Springfield, MA).
- Use the selected result's **latitude, longitude, state/admin1, timezone, and stable provider identifier when available**. Do not silently pick the first fuzzy match or accept non-U.S. results. Display what the user selected and allow changes.
- Handle misspellings, duplicate names, no results, API timeout/rate limits, unincorporated places, Alaska/Hawaii, and time zones. If geocoding cannot resolve a city, ask the user to choose another result; **do not fabricate coordinates or climate values**.
- Fetch 2016–2025 daily data for coordinates selected by geocoding; a **single dynamic request path** must power every supported city. Cache by normalized coordinates + date range + variables + API/model settings, not city name alone. Fetch on the server with retry/backoff and request timeouts.
- Keep the climate metrics/renovation rules **location-agnostic**: relevant pathways can include heat, cold, seasonal rain, dryness/ET0, and solar radiation. Do not use broad stereotypes ("Seattle is always rainy") or force differences between cities.
- Do not claim weather grids establish parcel flood zones, wildfire danger, building code, electricity tariffs, shade geometry, structural feasibility or guaranteed ROI; such claims require independent site-specific data.
- Acceptance scenarios: Irvine CA; Seattle WA; Phoenix AZ; Minneapolis MN; Miami FL; Portland OR vs Portland ME; an Alaska or Hawaii city; no-match input; API unavailable. These are **tests**, not preset supported-city whitelist.

## Balanced sustainability recommendation logic
Derive climate indicators from actual data: annual precipitation (mm/year), dry-seasonality, hot-day counts (define threshold!), shortwave radiation (check units), ET0 (mm), and optionally wind. Use a transparent prototype heuristic:

`score = .40 * climate_relevance + .30 * benefit_proxy + .20 * visible_feasibility + .10 * user_preference`

All inputs in 0–100; these are **design heuristics, not scientific coefficients**. Hard-block visually infeasible choices before ranking. Under Balanced, seek relevant mix across **water, energy, heat/stormwater** rather than 3 redundant water changes; never force unhelpful diversity. E.g., lawn → drought-tolerant landscaping if lawn exists and climate evidence supports; roof solar only if visible roof and with site-suitability disclaimer; shade only if placement can be rendered without blocking entry; drainage treatments require precipitation/runoff rationale. **Do not mistake annual precipitation for flood risk.**

Display the exact numerical evidence used in each recommendation; climate numbers must come from response calculations, never invented by an LLM. Explain model/reanalysis uncertainty. Avoid exact predicted savings, permitting, hazard ratings, or engineering claims.

## Home value panel (user decision, 2026-10-09; details in PLAN.md §6b)
Value figures are allowed **only** in this form:
1. Cited comparable homes (RentCast) near the selected location.
2. Our own hedonic regression fit on those comps, showing n, R² and the prediction interval, and falling back to the comp median when the fit is poor.
3. Upgrade premiums only from cited published studies; otherwise show "No reliable published estimate".

Always label it "Illustrative, not an appraisal". Never require a street address. The panel sits below the before/after slider and never displaces the image workflow.

Present it as estimated current value → estimated value with the selected upgrades (a range, itemized per upgrade). Wording rules:
- Say "associated with" or "estimated", never "will increase".
- Include the caveat "Value added is not profit; upgrades cost money."
- Location adaptation uses the data-only site profile in PLAN.md §5b. City names never select design styles.

## Multi-step image AI pipeline (this is the main technical deliverable)
```text
real photo + city + user priority
   -> U.S.-filtered city/state geocoding -> historical daily weather -> computed climate metrics
   -> tentative photo feature inventory (+ user confirm uncertain features)
   -> scored, feasible recommendations -> user selects 1–3
   -> structured edit plan {target areas, additions, preserve, forbidden, climate basis}
   -> image EDIT endpoint with original uploaded photo (optional masks if robust)
   -> consistency review {selected changes visible? geometry/driveway preserved?}
   -> before/after of exact same original + evidence + generation details
```
- Preserve source image immutable and associated with every generation.
- **Preserve** roofline, house geometry, doors, windows, driveway/grass boundaries (unless that *specific* region is edited), viewpoint, lighting, current weather, vegetation outside edit regions, visible wear and neighborhood.
- **Never** turn a grass patch into a new concrete area when recommending drought-tolerant landscaping. Seattle does **not** automatically imply a rainy photo or pristine remodeled house.
- Do not present two unrelated images as before/after. If edit fidelity fails, retry with fewer changes or optional region masks; flag unresolved artifacts honestly.
- Photo scene detection is tentative, not a verified roof inspection; allow user to correct detected features.
- An image-editing model is essential. Climate analytics supports image edits and **must not replace** the main image workflow.

### Suggested prompt template
"Edit the UPLOADED home photograph. Apply ONLY: {selected precise renovation list}. Target: {visible areas}. Preserve original building geometry, roofline, window/door placement, driveway and paths except specified areas, camera angle, lighting, condition, dirt/wear, neighborhood, and weather. Never cosmetically renovate unrelated areas. Retain ordinary realistic imperfections. Do not invent additional structures. The result is a concept image, not a construction plan."

## Proposed stack and code shape
- Next.js, React, TypeScript, Tailwind; Next server routes; Vercel. Use one image-edit provider whose editing quality can be tested early.
- Open-Meteo Geocoding + Historical Weather APIs; data utilities independently testable; deterministic ranking. Optional vision-capable API for photo analysis.
- Keep API keys only server-side; `.env.local` excluded; upload type/size validated; do not log uploaded photos or user addresses.

```text
app/page.tsx
app/api/geocode/route.ts
app/api/climate/route.ts
app/api/analyze-photo/route.ts
app/api/generate/route.ts
components/{PropertyUpload,ClimateEvidence,RecommendationCards,BeforeAfterSlider}.tsx
lib/{openMeteo,climateMetrics,recommendationEngine,renovationPrompt,imageEditClient,consistencyCheck}.ts
tests/{geocoding,climateMetrics,recommendationEngine,editPlan}.test.ts
```

## Rubric-based acceptance gates
- **A:** Demonstrate a functioning multi-step chain and explain WHY image editing, data extraction, scoring, and preservation checks are separately required. Unit-test climate units, missing values, thresholds, applicability gates; demonstrate error handling. Avoid a mostly static API wrapper.
- **B:** For one same house photo, two user-selected U.S. cities' actual retrieved values produce defensibly different chosen edits. Do not force contrasts if measured conditions do not support them.
- **C:** The core deliverable is an edited image derived from the user's original, not a weather dashboard accompanied by stock/generated houses.
- **D:** Clearly identify homeowner as user, the pain point (renovation ideas not locally climate-aware), practical benefit, and constraints (not site survey, no assured savings, no regulatory verification).
- **E:** Working deployed link, attractive but truthful photo output, same-house slider, legible evidence, ≤180-second video; verify all links/demo from fresh browser.

## Demo script — target ≤170 seconds, leave margin
- **0–20s:** Real homeowner need; show original imperfect house and any-U.S.-city availability.
- **20–50s:** Select Irvine, CA from nationwide city search and show real climate metrics / sourced date range.
- **50–80s:** Ranked interventions with numbers and photo applicability.
- **80–120s:** Generate / show faithful edit and before-after slider; name the image AI steps.
- **120–150s:** Search/select a second U.S. city on the exact SAME original; show data-justified differences (pre-generate and disclose if needed).
- **150–170s:** Architecture, usefulness, limitations, GitHub/deployment.

## Hackathon compliance / source verification
The **supplied scoring rubric** says 5 rows × 5 points = 25 and demo ≤3 minutes. Existing planning sources report organizer guidance: project built in event window; public GitHub timestamps; AI assistance disclosure; event site and Devpost allegedly forbid same-project cross-submission. **Verify current event/Devpost rules with organizers/portal before relying on them.** Published deadline information conflicts (one source says Oct 11 11:59 PM EDT = **8:59 PM PDT**; another says Oct 11 11:59 PM AoE). Treat **8:59 PM PDT** as conservative submission cutoff unless portal confirms different. Target submission by **7:30 PM PDT**. Pre-event planning text is context, not permission to submit prebuilt code.

Event: https://www.bananahacks.tech/ | Devpost: https://banana-hacks-1111.devpost.com/ | Open-Meteo: https://open-meteo.com/en/docs/historical-weather-api

## Claude Code operating contract — sole coding agent
The user will do **all coding and technical execution in Claude Code**; **do not delegate tasks to Codex or assume another coding assistant will review your work**. Claude is responsible for planning, architecture, file edits, API integration, tests, debugging, deployment support, security checks, code review, and submission-readiness checks. The user owns final feature priorities, credential setup, external account actions, and final Devpost submission.

### How to work
1. **Read context first:** This file, `EcoReno_AI_Project_Plan.pdf`, and `Banana_Hacks_2026_Scoring_Criteria.pdf` if present. Treat the judging PDF as authoritative for the scoring rubric; check organizer pages separately for event rules and deadlines.
2. **Inspect the repository and environment before modifying anything.** Identify the existing stack, scripts, tools, and environment variables. Do not replace working code without reason.
3. **Plan briefly, then execute in coherent vertical slices.** Start with one image actually edited from the user's uploaded photo; add live city search and historical climate data; then recommendations and validation. Prefer a working, testable end-to-end feature to multiple incomplete screens.
4. **Be autonomous on ordinary implementation decisions** (folder structure, naming, components, tests, refactors), but ask before material changes in product scope, paid API/provider choices, deploying publicly, deleting user work, or using live credentials. Do not fabricate tool results or claim a successful build without running it.
5. **Run checks yourself.** After each slice, run the relevant tests, lint, TypeScript build, and a manual/automated happy-path check where possible. Inspect failures and repair them; do not stop after generating code. Run an independent review pass of your own changes with attention to secrets, API error handling, data units and timezone, fidelity, and accessibility.
6. **Keep version control useful.** Make small descriptive commits during the event window, avoid committing `.env.local` or user photos, and preserve an intelligible repository history. Respect official rules and confirm any uncertain requirement before acting on it.
7. **Communicate concisely.** At meaningful checkpoints, report what changed, which commands/tests actually passed, what remains broken or unverified, and the next priority. Keep a running task checklist. Preserve working context between Claude Code sessions in a small `PROGRESS.md` (completed, pending, blockers, key architectural decisions, verified commands), updating it only when useful.
8. **Manage the user's Claude Max usage efficiently.** The user prefers Opus 5.5 for this hackathon, when available. Reserve expensive reasoning for architecture, tricky bugs, and fidelity problems; minimize unnecessary large-file rereads, speculative rewrites, and parallel-agent overhead. Never promise a particular model or usage allowance.

### Required self-review checklist
- **Climate:** Verify real Open-Meteo responses, units, 2016–2025 date coverage, missing-day handling, historical-estimate labeling, caching, and city/state disambiguation. Include test scenarios across the U.S., not only Irvine.
- **Image AI:** Confirm the generated result derives from the **same uploaded photograph**. Inspect actual original/output pairs for structure, boundaries, weather, wear, and unrequested edits. Flag unresolved artifacts instead of pretending that image fidelity is guaranteed.
- **Engineering:** Test input validation, rate limits/timeouts, API failures, retries, and key security. Prevent excessive image costs and avoid logging personal images.
- **Rubric:** Prove the pipeline is more than a single-API wrapper, the image transformation is central, the user problem is clear, and the <=3-minute demo explains the actual work.
- **Release:** Check production build and live route, responsive layout, accessible controls, README, evidence sources, reproducibility, and actual submission rules. Clearly distinguish completed work from proposed future features.

### First message to Claude Code
> Read `CLAUDE.md`, `EcoReno_AI_Project_Plan.pdf`, and `Banana_Hacks_2026_Scoring_Criteria.pdf` if available. You are the **sole coding agent** for EcoReno AI: own planning, implementation, tests, debugging, code review, and deployment preparation. First inspect the repo, then give me a concise ordered plan mapped to the five judging criteria. Build and prove one working same-photo image-editing vertical slice before polishing UI. Next add nationwide U.S. city geocoding, real 2016–2025 climate estimates, deterministic climate recommendations, and an image-fidelity review. Test as you go and show verified results. Ask before paid services, destructive changes, or public deployment. Keep a small `PROGRESS.md` to make session handoffs reliable. Do not involve Codex or another coding agent.
