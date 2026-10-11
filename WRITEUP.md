# EcoReno AI: Devpost write-up (draft, keep under 500 words)

## What it does

EcoReno takes a photo of a house and any U.S. city, then edits that same photo with exterior upgrades that fit the city's climate, like native planting where water is scarce or an evergreen windbreak where winters are long. Each change on the image is pinned to the numbers behind it, drawn from ten years of daily climate data for that place.

## Why I built it

Renovation ideas online ignore climate, and climate advice never shows you your own house. A homeowner in Irvine and one in Minneapolis get the same Pinterest board, even though Irvine's plants need about 36 more inches of water a year than falls as rain and Minneapolis has 149 freezing nights. I wanted a tool that turns that evidence into a picture of your actual home before you call a contractor.

## How it works

The image model is the heart of the app, but it only edits. Everything numeric happens in plain code. A vision model first checks the photo is a house and finds the lawn, roof, paving and windows; the user can correct it. The city's 2016–2025 weather from Open-Meteo becomes 15 metrics and a site profile (Köppen climate type, aridity, plant zone, heating or cooling dominance). A disclosed scoring formula ranks nine upgrades, with hard gates: no lawn means no lawn replacement, and cold climates never get a reflective roof. The chosen upgrades become a structured edit plan, sent to Gemini without any numbers or city names so it can't fall back on stereotypes. A second vision call reviews the edit against the plan, a model-free pixel diff measures what changed outside the targets, and a failed check triggers one stricter retry. Problems that remain are shown, not hidden.

The same photo can be re-run for a second city. On real data, Irvine gets native planting, solar and awnings, while Minneapolis gets a windbreak, a rain garden and a rain barrel.

## Home value

A value panel trains our own survey-weighted regression on U.S. Census microdata for the area and compares it with the Census Bureau's published median. Upgrade premiums come only from published studies (Lawrence Berkeley National Laboratory for solar); weaker evidence is shown but not added. It's labeled as an estimate, not an appraisal.

## What it won't claim

Climate numbers describe a grid cell, not a lot. It doesn't predict savings, check permits or rate flood risk, and every image is marked as an AI concept.

## What's next

County hazard data from FEMA, so wildfire-prone areas get fire-safe gravel instead of bark mulch, and a version that water utilities could embed in their turf-replacement rebate programs.

## Built with

Next.js, TypeScript, Google Gemini (image editing, vision analysis, review), Open-Meteo, U.S. Census APIs, Vitest. I built this solo during the event with Claude Code as my coding assistant for planning, code, tests and review.
