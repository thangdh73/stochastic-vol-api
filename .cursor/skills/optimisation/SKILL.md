---
name: optimisation
description: Use this skill when improving performance, reducing latency, reducing bundle size, optimising queries, improving memory use, or making the app more responsive.
---

# Optimisation Skill

## Principle

Do not optimise blindly.

First identify the likely bottleneck, then make the smallest measurable improvement.

## Classify the Bottleneck

Classify as:

- frontend rendering
- API latency
- database query
- file I/O
- memory pressure
- bundle size
- build time
- repeated work
- caching issue

## Evidence First

Look for:

- unnecessary re-renders
- repeated API calls
- N+1 database queries
- large payloads
- missing indexes
- synchronous blocking work
- expensive loops
- large dependencies
- unbounded queries

## Recommended Fixes

Prefer:

- pagination
- caching
- batching
- lazy loading
- query indexes
- memoisation only where useful
- reducing payload size
- avoiding unnecessary dependencies
- streaming large data where appropriate

## Measurement

Suggest how to measure:

- browser performance tools
- React Profiler
- Network tab
- Lighthouse
- query timing logs
- EXPLAIN plan
- request timing middleware
- bundle analyser

## Final Output

```text
Optimisation Summary:
- Bottleneck:
- Evidence:
- Change:
- Expected improvement:
- How to measure:
- Risks:
- Next optimisation:
```
