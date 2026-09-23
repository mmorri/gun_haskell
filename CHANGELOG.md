# Changelog for `sentry-gun`

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to the
[Haskell Package Versioning Policy](https://pvp.haskell.org/).

## Unreleased

### Added
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

## 0.1.0.0 - YYYY-MM-DD
