# Changelog for `sentry-gun`

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the
[Haskell Package Versioning Policy](https://pvp.haskell.org/).

## Unreleased

### Added
- HTML5 web port (`web/`) in TypeScript + Canvas: self-contained build, touch support,
  procedural audio, meta-progression, achievements, and an itch.io packaging script.
- Web superpowers: an A-10 strafing run with player-chosen start/end points (`Q`) and a
  five-marine drop with five seconds of high fire rate (`E`). Both scale with wave number.
- Headless balance simulator and a set of generated screenshots/cover art in `docs/`.
- Path-based enemy navigation and mixed enemy wave composition.
- Enemy archetypes (Swarm/Runner/Brute) with armor, rewards, and split-on-death behavior.
- Tower upgrades up to level 3.
- Targeting priorities and controls to cycle them at runtime.
- Simulation speed toggle and range-indicator toggle.
- End-of-run stats on game over screen.

### Changed
- Placement rules now enforce map bounds, no-overlap, and no-path-blocking checks.
- Targeting algorithm upgrade now enables global assignment for ready towers.
- Bullet collision processing rewritten to apply deterministic aggregated damage.

### Fixed
- Escape handling and round transitions now rely on path completion rather than screen-edge checks.
- GHC warnings in `Render.hs` (partial `head`, ambiguous numeric defaults, shadowed binding) and
  a redundant Gloss import in `Main.hs`.

## 0.1.0.0 - YYYY-MM-DD
