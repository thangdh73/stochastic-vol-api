---
name: release
description: Use this skill when preparing a release, version bump, changelog, deployment checklist, production readiness review, or release notes.
---

# Release Skill

## Purpose

Prepare the project for a safe release.

## Release Checks

Check:

- tests pass
- build passes
- lint/typecheck pass if available
- changelog updated
- README updated
- environment variables documented
- no secrets committed
- migrations checked
- deployment config checked
- rollback plan noted

## Semantic Versioning

Use:

- PATCH for bug fixes
- MINOR for backwards-compatible features
- MAJOR for breaking changes

## Release Notes Template

```md
# Release <version>

## Highlights

## Added

## Changed

## Fixed

## Migration Notes

## Known Issues

## Validation
```

## Checklist

```text
Release Checklist:
- [ ] Tests pass
- [ ] Build passes
- [ ] Typecheck/lint pass
- [ ] Changelog updated
- [ ] README updated
- [ ] Environment variables documented
- [ ] No secrets committed
- [ ] Database migrations checked
- [ ] Rollback plan noted
- [ ] Known issues documented
```

## Final Output

```text
Release Summary:
- Version:
- Release type:
- Key changes:
- Validation:
- Remaining blockers:
```
