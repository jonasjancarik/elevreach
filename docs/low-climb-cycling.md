---
title: Low-Climb Cycling Model
read_when:
  - adjusting ride presets, cycling copy, or effort metrics
---

# Low-Climb Cycling Model

## Current promise

- Safe claim: topographic ease; low-climb reach
- Unsafe claim: guaranteed easy ride
- Why: current model prices uphill only, on terrain grid only

## Current product shape

- Primary ride lens: climb budget
- Ride presets should bind two things:
  - uphill budget
  - trip radius
- Reason: "easy" depends on climb and distance, not climb alone

## Default surface

- Main UI: trip radius slider plus round-trip uphill budget slider
- Default hidden assumptions: 5 km straight-line radius; terrain-only least-uphill path
- Advanced UI: boundary scope, radius, one-way vs round-trip, alternate terrain lenses

These defaults are product heuristics, not hard scientific cutoffs.

## Copy guardrails

- Say `least-uphill terrain path`, not `easy route`
- Say `terrain-only`, `no street network yet`, `distance not priced yet`
- Say `long flat detours may still qualify`
- Say `short steep ramps may be blurred by DEM resolution`

## V2 metric

Goal: route cost should reflect what casual riders notice.

Use street or bike graph. Price each edge with:

- base distance cost
- uphill meters cost
- steepness penalty for edges above comfort thresholds
- optional surface / stairs / traffic penalties later

Practical output:

- reachable area for preset rider types
- route score for chosen origin-destination pair
- climb per km alongside total climb

## Non-goals

- engineering-grade elevation promises
- claiming all highlighted cells are equally comfortable
- using citywide climb budget without a distance bound for casual cycling
