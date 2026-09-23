# Sentry Gun: Pew-Pew Defense Deluxe

A tower defense game written in Haskell using Gloss — now with 200% more sparkles and 100% more gremlins!

Protect ur base (pls) from the Zoomie Gremlins pouring out of the gremlin hole.

## Highlights

- Round-based gameplay with escalating mixed enemy waves
- Starry battlefield, sandy candy road, pulsing portal + beating-heart base
- Googly-eyed turrets with distinct personalities + level stars
- Derpy enemies with faces, health bars, and emotional damage (`!!` when low)
- Neon bullet tracers, starburst muzzle flashes with `PEW!`
- Grid-based tower placement with path/overlap validation
- Tower upgrades aka protein shakes (right-click in shop phase)
- Target Gossip modes: Closest Bozo / Front of Conga Line / Bully the Smoll / Big Chungus First
- Big Brain Mode™ upgrade for global tower-enemy matching
- Funny rotating tips, pause snack-break screen, tragic `BASE GOT SNACC'D!` game over
- Fast-forward espresso mode (`F`) and disco range lights (`R`)

## Enemy Types

- **Zoomie Gremlin (Swarm)**: fragile, fast, low reward. Says "zoom".
- **Espresso Goblin (Runner)**: medium health, very fast, sweating.
- **Dump Truck Chungus (Brute)**: tanky, armored, splits into smaller units on death like bad gossip. Wears a tiny crown.

## Gun Types

- **Pew-Pew Turret** ($50): reliable, like socks. Balanced all-rounder.
- **No-Scope Nanny** ($100): 360 no-scope granny. High range + damage, slow.
- **BRRRT Machine** ($80): caffeine incarnate. Short range, low damage, high fire rate.
- **YEET Cannon** ($150): diplomatic solution. Medium range, high burst.

## How to Play

1. In **Shop Phase**, click a tower button then click the battlefield to adopt it.
2. Press **SPACE** to unleash the wave.
3. During combat, towers shoot automatically (pew pew!).
4. Between rounds, buy towers, right-click to feed them steroids, and tune targeting gossip.
5. Survive as many rounds as possible before base gets snacc'd.

## Controls

- **Mouse Left**: select tower / place tower (click = adopt!)
- **Mouse Right (shop phase)**: upgrade tower under cursor
- **SPACE**: start round (shop) / pause for snacks (combat)
- **T**: cycle target gossip
- **R**: toggle disco range lights
- **F**: toggle espresso speed (1x/2x)
- **Q**: cry quietly

## Build

```bash
stack build
stack run
```

Note: On Linux, you may need OpenGL/GLUT dev libs for Gloss:
`sudo apt install freeglut3-dev libgl1-mesa-dev libglu1-mesa-dev`

Note: On Ubuntu 25.10+ (binutils 2.44+, no `ld.gold`), the build uses `-optl-fuse-ld=bfd`
(already set in `sentry-gun.cabal`). If linking fails with `cannot find 'ld'`, build with:
`stack build --ghc-options="-optl-fuse-ld=bfd"`

## License

BSD-3-Clause
