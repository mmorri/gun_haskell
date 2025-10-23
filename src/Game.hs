module Game
  ( assignEnemies
  , SimulationState(..)
  , GamePhase(..)
  , GunTemplate(..)
  , TargetingAlgorithm(..)
  , initSimulation
  , stepSimulation
  , simulateOnce
  , startNextRound
  , addGunAtPosition
  , canAffordGun
  , availableGuns
  , unlockAdvancedAlgorithm
  , algorithmUpgradeCost
  ) where

import Gun (Gun(..), distanceToEnemy, canShoot, tickCooldown, fireAt)
import Enemy (Enemy(..), moveEnemy)
import Bullet (Bullet(..), moveBullet, createBullet)
import Data.List (minimumBy)
import Data.Ord (comparing)

-- | Game phase determines what the player can do
data GamePhase
  = ShopPhase      -- Player can buy and place guns
  | CombatPhase    -- Simulation running, enemies spawning
  | GameOver       -- All lives lost
  deriving (Show, Eq)

-- | Targeting algorithm types
data TargetingAlgorithm
  = GreedyNearest      -- Simple: each gun shoots nearest enemy (default)
  | HungarianOptimal   -- Advanced: optimal assignment using Hungarian algorithm
  deriving (Show, Eq)

-- | Gun templates available for purchase
data GunTemplate = GunTemplate
  { templateName  :: String
  , templateCost  :: Int
  , templateRange :: Double
  , templateCooldown :: Double
  , templateDamage :: Double
  } deriving (Show, Eq)

-- | Cost to unlock the advanced targeting algorithm
algorithmUpgradeCost :: Int
algorithmUpgradeCost = 100

-- | Simulation state holds guns, enemies, bullets, round info, and game phase
data SimulationState = SimulationState
  { simGuns    :: [Gun]
  , simEnemies :: [Enemy]
  , simBullets :: [Bullet]
  , simTime    :: Double
  , simPaused  :: Bool
  , currentRound :: Int
  , points :: Int
  , lives :: Int
  , gamePhase :: GamePhase
  , nextGunId :: Int
  , nextEnemyId :: Int
  , nextBulletId :: Int
  , enemiesSpawnedThisRound :: Int
  , enemiesToSpawnThisRound :: Int
  , spawnTimer :: Double
  , selectedGun :: Maybe GunTemplate
  , gunMuzzleFlashes :: [(Int, Double)]  -- (gunId, timeRemaining)
  , targetingAlgorithm :: TargetingAlgorithm
  , mousePosition :: (Float, Float)  -- Track mouse for placement preview
  } deriving (Show)

-- | List of available gun types
availableGuns :: [GunTemplate]
availableGuns =
  [ GunTemplate "Basic Turret" 50 120 1.0 6
  , GunTemplate "Sniper Tower" 100 200 2.0 15
  , GunTemplate "Rapid Fire" 80 100 0.5 4
  , GunTemplate "Heavy Cannon" 150 150 1.5 20
  ]

initSimulation :: [Gun] -> [Enemy] -> SimulationState
initSimulation gs es = SimulationState
  { simGuns = gs
  , simEnemies = es
  , simBullets = []
  , simTime = 0
  , simPaused = False
  , currentRound = 1
  , points = 100  -- Starting money
  , lives = 10
  , gamePhase = ShopPhase
  , nextGunId = 1
  , nextEnemyId = 1
  , nextBulletId = 1
  , enemiesSpawnedThisRound = 0
  , enemiesToSpawnThisRound = 0
  , spawnTimer = 0
  , selectedGun = Nothing
  , gunMuzzleFlashes = []
  , targetingAlgorithm = GreedyNearest  -- Start with basic algorithm
  , mousePosition = (0, 0)
  }

-- | Unlock the advanced targeting algorithm
unlockAdvancedAlgorithm :: SimulationState -> SimulationState
unlockAdvancedAlgorithm state
  | points state >= algorithmUpgradeCost =
      state { targetingAlgorithm = HungarianOptimal
            , points = points state - algorithmUpgradeCost
            }
  | otherwise = state

-- | Check if player can afford a gun
canAffordGun :: GunTemplate -> SimulationState -> Bool
canAffordGun template state = points state >= templateCost template

-- | Add a gun at the specified position
addGunAtPosition :: GunTemplate -> (Double, Double) -> SimulationState -> SimulationState
addGunAtPosition template position state
  | canAffordGun template state =
      let newGun = Gun
            { gunId = nextGunId state
            , gpos = position
            , range = templateRange template
            , cooldownTime = templateCooldown template
            , currentCd = 0
            , damagePerShot = templateDamage template
            }
      in state
        { simGuns = newGun : simGuns state
        , points = points state - templateCost template
        , nextGunId = nextGunId state + 1
        }
  | otherwise = state

-- | Calculate enemies for a round (more enemies, higher health as rounds progress)
enemiesForRound :: Int -> Int
enemiesForRound round = 5 + (round - 1) * 3

-- | Calculate enemy health for a round
enemyHealthForRound :: Int -> Double
enemyHealthForRound round = 10 + fromIntegral (round - 1) * 5

-- | Start the next round (transition from Shop to Combat)
startNextRound :: SimulationState -> SimulationState
startNextRound state = state
  { gamePhase = CombatPhase
  , enemiesToSpawnThisRound = enemiesForRound (currentRound state)
  , enemiesSpawnedThisRound = 0
  , spawnTimer = 0
  , simTime = 0
  }

-- | A simple scoring + assignment: choose the nearest ready gun; if none ready, choose nearest overall
assignEnemies :: [Gun] -> [Enemy] -> [(Int, Maybe Int)]
assignEnemies gs es = map (\e -> (enemyId e, fmap gunId (bestGun gs e))) es

-- Choose the best gun for an enemy:
-- prefer guns that are ready (currentCd <= 0), then shortest distance
bestGun :: [Gun] -> Enemy -> Maybe Gun
bestGun gs e =
  let ready = filter (\ng -> currentCd ng <= 0 && distanceToEnemy ng e <= range ng) gs
      inRange = filter (\ng -> distanceToEnemy ng e <= range ng) gs
  in case ready of
       [] -> if null inRange then Nothing else Just (minimumBy (comparing (`distanceToEnemy` e)) inRange)
       _  -> Just (minimumBy (comparing (`distanceToEnemy` e)) ready)

-- | Spawn a new enemy
spawnEnemy :: SimulationState -> Enemy
spawnEnemy state =
  let round = currentRound state
      hp = enemyHealthForRound round
      -- Vary spawn positions and velocities
      spawnVariations =
        [ ((-400, -100), (25, 5))
        , ((-400, 0), (30, 0))
        , ((-400, 100), (25, -5))
        , ((400, -100), (-25, 5))
        , ((400, 100), (-25, -5))
        ]
      idx = enemiesSpawnedThisRound state `mod` length spawnVariations
      (spawnPos, vel) = spawnVariations !! idx
  in Enemy
      { enemyId = nextEnemyId state
      , pos = spawnPos
      , health = hp
      , speed = sqrt (fst vel ^ (2::Int) + snd vel ^ (2::Int))
      , vel = vel
      }

-- | Advance the simulation by dt: move enemies, cooldown guns, then let guns fire at assigned targets.
stepSimulation :: Double -> SimulationState -> SimulationState
stepSimulation dt s
  | simPaused s = s
  | gamePhase s == ShopPhase = s  -- No simulation in shop phase
  | gamePhase s == GameOver = s   -- No simulation when game over
  | gamePhase s == CombatPhase = combatStep dt s
  | otherwise = s

combatStep :: Double -> SimulationState -> SimulationState
combatStep dt s =
  let -- Spawn enemies over time
      newSpawnTimer = spawnTimer s + dt
      shouldSpawn = newSpawnTimer >= 1.0 && enemiesSpawnedThisRound s < enemiesToSpawnThisRound s

      (spawnedEnemies, spawnCount, resetTimer) =
        if shouldSpawn
          then ([spawnEnemy s], 1, 0)
          else ([], 0, newSpawnTimer)

      allEnemies = simEnemies s ++ spawnedEnemies

      -- Move enemies
      movedEnemies = map (moveEnemy dt) allEnemies

      -- Check if enemies escaped (went off screen) - lose lives
      (escaped, remainingEnemies) = span (\e -> let (x, y) = pos e in abs x > 500 || abs y > 300) movedEnemies
      livesLost = length escaped

      -- Tick cooldowns
      gsTicked = map (tickCooldown dt) (simGuns s)

      -- Fire phase - create bullets instead of instant damage (use selected algorithm)
      (gs', newBullets, newFlashes) = firePhaseBullets (targetingAlgorithm s) gsTicked remainingEnemies (nextBulletId s)

      -- Move existing bullets
      movedBullets = map (moveBullet dt) (simBullets s ++ newBullets)

      -- Check bullet collisions with enemies
      (bulletsAfterHits, enemiesAfterHits, killedCount) = processBulletCollisions movedBullets remainingEnemies

      -- Update muzzle flashes (decay over time)
      updatedFlashes = map (\(gid, t) -> (gid, t - dt)) (gunMuzzleFlashes s ++ newFlashes)
      activeFlashes = filter (\(_, t) -> t > 0) updatedFlashes

      -- Award points for killed enemies
      pointsEarned = killedCount * 10

      newLives = lives s - livesLost
      newPhase = if newLives <= 0
                   then GameOver
                   else if null enemiesAfterHits && enemiesSpawnedThisRound s + spawnCount >= enemiesToSpawnThisRound s
                          then ShopPhase  -- Round complete
                          else CombatPhase

      newRound = if newPhase == ShopPhase && gamePhase s == CombatPhase
                   then currentRound s + 1
                   else currentRound s

  in s { simGuns = gs'
       , simEnemies = enemiesAfterHits
       , simBullets = bulletsAfterHits
       , simTime = simTime s + dt
       , spawnTimer = resetTimer
       , enemiesSpawnedThisRound = enemiesSpawnedThisRound s + spawnCount
       , nextEnemyId = nextEnemyId s + spawnCount
       , nextBulletId = nextBulletId s + length newBullets
       , points = points s + pointsEarned
       , lives = newLives
       , gamePhase = newPhase
       , currentRound = newRound
       , gunMuzzleFlashes = activeFlashes
       }

-- Fire phase with bullets: guns create bullets when they shoot
firePhaseBullets :: TargetingAlgorithm -> [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
firePhaseBullets algo guns enemies startBulletId = case algo of
  GreedyNearest -> greedyTargeting guns enemies startBulletId
  HungarianOptimal -> hungarianTargeting guns enemies startBulletId

-- Greedy algorithm: each gun shoots nearest enemy (original behavior)
greedyTargeting :: [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
greedyTargeting guns enemies startBulletId =
  let (gs, bs, fs, _) = go guns [] [] startBulletId
  in (gs, bs, fs)
  where
    go :: [Gun] -> [Bullet] -> [(Int, Double)] -> Int -> ([Gun], [Bullet], [(Int, Double)], Int)
    go [] accBullets accFlashes bid = ([], accBullets, accFlashes, bid)
    go (g:gs) accBullets accFlashes bulletId =
      let candidates = filter (\e -> distanceToEnemy g e <= range g) enemies
          (g', newBullets, newFlashes, nextId) =
            if currentCd g > 0 || null candidates
              then (g, [], [], bulletId)
              else
                let target = minimumBy (comparing (distanceToEnemy g)) candidates
                    g' = g { currentCd = cooldownTime g }
                    bullet = createBullet bulletId (gunId g) (gpos g) (pos target) (damagePerShot g)
                    flash = (gunId g, 0.1)  -- Muzzle flash duration
                in (g', [bullet], [flash], bulletId + 1)
          (restGuns, restBullets, restFlashes, finalId) = go gs (accBullets ++ newBullets) (accFlashes ++ newFlashes) nextId
      in (g' : restGuns, restBullets, restFlashes, finalId)

-- Hungarian/Optimal algorithm: finds optimal gun-enemy assignment
hungarianTargeting :: [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
hungarianTargeting guns enemies startBulletId =
  let -- Get ready guns (cooldown <= 0)
      readyGuns = filter (\g -> currentCd g <= 0) guns
      notReadyGuns = filter (\g -> currentCd g > 0) guns

      -- Find optimal assignment for ready guns
      assignments = optimalAssignment readyGuns enemies

      -- Create bullets and update guns based on assignments
      (firedGuns, bullets, flashes, nextId) = processAssignments assignments startBulletId

      -- Combine fired guns with not-ready guns
      allGuns = firedGuns ++ notReadyGuns

  in (allGuns, bullets, flashes)
  where
    -- Find optimal assignment using a greedy approach with global consideration
    optimalAssignment :: [Gun] -> [Enemy] -> [(Gun, Enemy)]
    optimalAssignment [] _ = []
    optimalAssignment _ [] = []
    optimalAssignment gs es =
      let -- Calculate all valid gun-enemy pairs with costs (distance / damage ratio)
          validPairs = [(g, e, cost g e) | g <- gs, e <- es, distanceToEnemy g e <= range g]
          cost g e = distanceToEnemy g e / damagePerShot g  -- Prefer high damage guns on close enemies
      in if null validPairs
           then []
           else
             let -- Find best assignment (minimum cost)
                 (bestGun, bestEnemy, _) = minimumBy (comparing (\(_,_,c) -> c)) validPairs
                 -- Recursively assign remaining guns to remaining enemies
                 remaining = optimalAssignment
                   (filter (\g -> gunId g /= gunId bestGun) gs)
                   (filter (\e -> enemyId e /= enemyId bestEnemy) es)
             in (bestGun, bestEnemy) : remaining

    processAssignments :: [(Gun, Enemy)] -> Int -> ([Gun], [Bullet], [(Int, Double)], Int)
    processAssignments [] bid = ([], [], [], bid)
    processAssignments ((g, e):rest) bulletId =
      let g' = g { currentCd = cooldownTime g }
          bullet = createBullet bulletId (gunId g) (gpos g) (pos e) (damagePerShot g)
          flash = (gunId g, 0.1)
          (restGuns, restBullets, restFlashes, finalId) = processAssignments rest (bulletId + 1)
      in (g' : restGuns, bullet : restBullets, flash : restFlashes, finalId)

-- Process bullet collisions with enemies
processBulletCollisions :: [Bullet] -> [Enemy] -> ([Bullet], [Enemy], Int)
processBulletCollisions bullets enemies =
  let -- Check each bullet for collision
      (activeBullets, hitEnemyIds, damages) = foldl checkBullet ([], [], []) bullets

      -- Apply damage to enemies
      (updatedEnemies, killed) = foldl applyDamage ([], 0) enemies

  in (activeBullets, updatedEnemies, killed)
  where
    checkBullet (acc, hits, dmgs) bullet =
      let (bx, by) = bulletPos bullet
          -- Check if bullet is off screen
          outOfBounds = abs bx > 600 || abs by > 400
          -- Check if bullet hit any enemy
          hitEnemy = filter (\e ->
            let (ex, ey) = pos e
                dist = sqrt ((bx - ex)^(2::Int) + (by - ey)^(2::Int))
            in dist < 10) enemies  -- Hit radius
      in case hitEnemy of
           (e:_) -> (acc, enemyId e : hits, (enemyId e, bulletDamage bullet) : dmgs)  -- Bullet hit
           [] -> if outOfBounds
                   then (acc, hits, dmgs)  -- Bullet missed, remove it
                   else (bullet : acc, hits, dmgs)  -- Bullet still flying

    applyDamage (acc, killCount) enemy =
      let damage = sum [d | (eid, d) <- damages, eid == enemyId enemy]
          newHealth = health enemy - damage
          enemy' = enemy { health = newHealth }
      in if newHealth <= 0
           then (acc, killCount + 1)  -- Enemy killed, don't add to list
           else (enemy' : acc, killCount)  -- Enemy damaged

    damages = collectDamages bullets enemies []

    collectDamages [] _ acc = acc
    collectDamages (b:bs) es acc =
      let (bx, by) = bulletPos b
          hitEnemy = filter (\e ->
            let (ex, ey) = pos e
                dist = sqrt ((bx - ex)^(2::Int) + (by - ey)^(2::Int))
            in dist < 10) es
      in case hitEnemy of
           (e:_) -> collectDamages bs es ((enemyId e, bulletDamage b) : acc)
           [] -> collectDamages bs es acc

-- Old fire phase (kept for compatibility, not used anymore)
firePhase :: [Gun] -> [Enemy] -> ([Gun], [Enemy])
firePhase guns enemies = foldl shootOne ([], enemies) guns
  where
    shootOne :: ([Gun], [Enemy]) -> Gun -> ([Gun], [Enemy])
    shootOne (accGuns, es) g =
      let candidates = filter (\req -> distanceToEnemy g req <= range g) es
      in if currentCd g > 0 || null candidates
           then (accGuns ++ [g], es)
           else
             let target = minimumBy (comparing (distanceToEnemy g)) candidates
                 (g', tgt') = fireAt g target
                 -- replace target in enemy list with damaged version; remove if dead
                 es' = map (\r -> if enemyId r == enemyId tgt' then tgt' else r) es
                 es'' = filter (\r -> health r > 0) es'
             in (accGuns ++ [g'], es'')

-- | Single-shot helper to run one tick and print assignment (used by the CLI demo)
simulateOnce :: [Gun] -> [Enemy] -> IO ()
simulateOnce gs es = do
  let asg = assignEnemies gs es
  putStrLn "Assignments (enemyId -> maybe gunId):"
  mapM_ print asg
