# Sentry Gun Tower Defense

A tower defense game written in Haskell using the Gloss graphics library.

## Features

- **Round-based gameplay** with increasing difficulty
- **4 different gun types** with unique stats
- **Point system** - earn money by killing enemies
- **Visual bullet system** with muzzle flash effects
- **Grid-based gun placement** with live preview
- **Hungarian Algorithm upgrade** - unlock optimal gun-enemy targeting for $100
- **Progressive difficulty** - enemies get bigger and more numerous each round

## Gun Types

- **Basic Turret** ($50) - Balanced all-around turret
- **Sniper Tower** ($100) - Long range, high damage, slow fire rate
- **Rapid Fire** ($80) - Short range, low damage, very fast
- **Heavy Cannon** ($150) - Medium range, very high damage

## Upgrades

- **Hungarian Targeting Algorithm** ($100) - Optimizes gun-enemy assignment for maximum efficiency

## How to Play

1. **Shop Phase**: Click guns to select, then click battlefield to place them
2. Press **SPACE** to start the combat round
3. **Combat Phase**: Watch your guns automatically shoot enemies
4. Earn points for each kill
5. Return to shop between rounds to buy more guns or upgrades
6. Survive as long as possible!

## Building and Running

### Prerequisites

- Stack (Haskell build tool)
- On Windows: freeglut DLL (automatically downloaded during first build)

### Build

```bash
stack build
```

### Run

```bash
stack run
```

## Controls

- **Mouse**: Select guns and place them on battlefield
- **SPACE**: Start round (in shop) / Pause (in combat)
- **Q**: Quit

## Technical Features

- Pure functional Haskell implementation
- Gloss-based 2D graphics
- Real-time bullet physics
- Optimal assignment algorithm (Hungarian method)
- Grid snapping for precise placement
- Live placement preview with range visualization

## License

BSD-3-Clause
