# Session log: planning and build, Oct 9–10, 2026

This is the record of the first working session on EcoReno AI, written so a judge, a teammate, or a later session can see what was decided, why, and what's actually been verified. Times are Pacific. The project was built with Claude Code as the coding assistant; the person making the product calls was the solo entrant.

## Where things stand (Sat Oct 10, 8:30 PM)

Everything that doesn't need an API key is built, tested and committed: nationwide city search, ten years of climate data per city, the climate classifications, the recommendation engine, the edit-planning and review pipeline, the result screen, city comparison, the home-value model, renter mode, next-step links, and a house picker with a real-photo gallery. 130 unit tests pass, the production build succeeds, and a local production server answers correctly.

The image-editing core has not run yet. It needs a Gemini API key, and until it runs, the claim that the edits are faithful is untested. That is the main open risk going into Sunday.

## Friday evening: planning

The session started from three documents: `CLAUDE.md`, an earlier plan PDF, and the organizers' one-page judging rubric (five rows, five points each). The first job was checking the event's own pages, because the earlier plan flagged a deadline conflict. It's still there: the schedule page says submissions close at 11:59 PM EDT on Sunday, the prizes page says 11:59 PM AoE. The plan uses the earlier time (8:59 PM Pacific). The pages also said a working link is preferred over a polished video and that the write-up is capped at 500 words, which turned the live demo into the main deliverable.

One finding shaped the architecture early. Open-Meteo's free tier counts a ten-year daily request as roughly 261 calls, and hosted apps share outbound IP addresses, so climate data had to be cached persistently rather than fetched per visit.

The plan went through four versions in conversation. The decisions that stuck:

| Decision | Choice | Why |
|---|---|---|
| Image editor | Gemini image model behind a swappable adapter, free tier first | Cheapest credible option; hackathon compute credits may arrive, and a fallback (FLUX Kontext) stays possible without rewriting |
| Photo analysis and review | Gemini vision, plus a pixel-difference check that uses no model | Keeps cost near zero; the pixel check covers the "model grading its own work" gap |
| Home value | Official Census microdata, our own weighted regression, the Census median, cited premiums only | Value figures without evidence would hurt credibility; RentCast listings were considered and replaced (commercial data, monthly cap) |
| Location model | A site profile computed only from data | City names never pick a design; the profile's numbers do |
| Platform | Desktop web app | Scope control |
| House photos | Live search of free-licensed photos plus six curated sample homes, plus upload | Judges rarely have a house photo handy. Listing sites were ruled out: no public API, scraping breaks their terms, the photos are copyrighted, and editing identifiable homes for sale raises privacy problems |
| Look | Photo-first markup over a field-report change log | Matches the "every change has a reason" idea |

The session also included some workstation prep (freeing disk space on the development machine), which isn't recorded here.

## Saturday: the build

Work started at 10:45 AM, about two hours later than planned. With no API keys available yet, the order was flipped: everything keyless first, then the model-dependent parts written ahead so they'd be ready to run.

| Time | Commit | What landed |
|---|---|---|
| 10:56 | `834ac2f` | Next.js 16.4 scaffold; U.S.-only city search; climate fetch with retries and unit checks; 15 metrics; Köppen, aridity, plant zone and heating/cooling classification; real recorded data for nine test cities |
| 10:57 | `b1c7e27` | County labels fixed for Connecticut's planning regions and names that already include "County" |
| 11:01 | `d83788d` | Gemini adapters for editing, analysis and review; output resized to the original's pixels; the edit-prompt template |
| 11:04 | `aafa1fc` | Recommendation engine: nine upgrades, hard gates, disclosed weights, the Balanced selection rule, regional style table |
| 11:06 | `048ceb5` | Analysis and generation routes; review and one stricter retry; rate limits |
| 11:07 | `f7f31b0` | Real pipeline stages streamed to the browser; the model-free change map |
| 11:09 | `6105b63` | Full interface: feature chips, recommendation cards with score breakdowns, progress stepper, result view with pins |
| 11:10 | `3452d58` | Same-photo comparison across two cities |
| 11:11 | `d6d15a2` | Redis-backed cache and rate limits for deployment |
| 11:12 | `095fe1a` | Sample-house mode with saved results |
| 12:30 | `e8b1b23` | Scope cut to desktop web only |
| 12:50 | `3c85c29` | Design pass with the `unslop-ui` skill: new type system, accent color, corner scale |
| 13:07 | `6ded336` | Home-value model on official Census data |
| 18:11 | `2a747c9` | Manual feature marking when photo analysis is unavailable |
| 18:12 | `8890e84` | Renter mode |
| 18:13 | `b9649cf` | Official next-step links (EPA, DOE, DSIRE by state), each checked to load |
| 18:14 | `186941f` | README and Devpost write-up drafts, checked with the `unslop-text` skill |
| 20:17 | `09d75d4` | House picker: Unsplash photo search, six-home gallery, upload |

## What the real data showed

The recorded 2016–2025 data for the test cities came out consistent with what's known about them, which was the first sanity check on the metric code:

| City | Climate type | Approx. plant zone | Notable |
|---|---|---|---|
| Phoenix, AZ | BWh (hot desert) | 10a | 169 days a year at 90 °F or more, 101 at 100 °F or more |
| Irvine, CA | Csa (hot-summer Mediterranean), semi-arid | 10b | Water deficit about 36 in/yr, 8 dry months |
| Minneapolis, MN | Dfa (hot-summer continental) | 4b | 149 freezing nights, 93 cm of snow a year |
| Seattle, WA | Csb (warm-summer Mediterranean) | 9a | Rain exceeds plant demand |
| Miami, FL | Af (tropical) | 11a | Cooling demand 4,388 °F·days a year |

The engine's Balanced picks for a typical house photo differ in ways that follow the numbers: Irvine gets native planting, rooftop solar and window awnings; Minneapolis gets an evergreen windbreak, a rain garden and a rain barrel, and a reflective roof is blocked there because it would raise winter heating needs.

## Problems found and fixed

Two data quirks changed the logic. Gridded data under-counts hot days at the coast (Miami shows 14 a year), so heat relevance uses the stronger of hot days and cooling degree days. The plant zone computed from gridded data runs warm where cold snaps are sharp (Anchorage computes as 6a; the USDA map says about 4b to 5a), so the app labels it approximate and the README lists it as a limitation.

The Census API now requires a key for every request; that was found by probing before any code depended on it. Several Department of Energy pages that would have been next-step links return 404, so they were replaced with pages that load. One of the first candidate demo photos looked like a 3D builder rendering rather than a real house, so it was dropped.

The pre-publish check found two build problems that development mode never showed. The production build failed inside the Google Fonts loader for IBM Plex Sans; loading it as a variable font fixed it. And the build's probe of GET routes was being caught by the app's own error handler and logged as a crash; reading the request before the handler fixed that.

## Verified, and not yet verified

Verified: 130 unit tests (including real recorded data for nine cities), typecheck, lint, the production build, a local production server, live city search, live climate data for several cities, the Census geography lookup in seven states, the sample gallery, and the fallback paths when keys are missing.

Not yet verified: any real Gemini edit, analysis or review; the home-value model on real Census records; Unsplash search with a real key; deployment. The README's fidelity table is marked pending instead of filled in.

## Next steps

Add the Gemini, Census and Unsplash keys to `.env.local`, then run the first real edit (`scripts/spike-edit.mts`), tune the prompt on real output, pre-generate results for the two featured sample homes, measure fidelity on five photos, and deploy. The full schedule, checkpoints and cut order are in `PLAN.md`; the running status is in `PROGRESS.md`.
