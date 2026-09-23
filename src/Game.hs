module Game
  ( assignEnemies
  , SimulationState(..)
  , GamePhase(..)
  , GunTemplate(..)
  , TargetingAlgorithm(..)
  , TargetingMode(..)
  , initSimulation
  , stepSimulation
  , simulateOnce
  , startNextRound
  , addGunAtPosition
  , canAffordGun
  , canPlaceGunAt
  , availableGuns
  , unlockAdvancedAlgorithm
  , algorithmUpgradeCost
  , toggleRangeIndicators
  , toggleSimulationSpeed
  , cycleTargetingMode
  , upgradeGunAtPosition
  ) where

import Bullet (Bullet(..), createBullet, moveBullet)
import Data.List (minimumBy, partition)
import Data.Ord (comparing)
import Enemy (Enemy(..), EnemyType(..), distance, enemyReachedGoal, moveEnemyAlongPath)
import Gun (Gun(..), canUpgrade, distanceToEnemy, tickCooldown, upgradeCost, upgradeGun)

-- | Game phase determines what the player can do.
data GamePhase
  = ShopPhase
  | CombatPhase
  | GameOver
  deriving (Show, Eq)

-- | Algorithm-level enemy assignment policy.
data TargetingAlgorithm
  = GreedyNearest
  | HungarianOptimal
  deriving (Show, Eq)

-- | Priority rules for selecting which enemy to shoot.
data TargetingMode
  = TargetNearest
  | TargetFirst
  | TargetWeakest
  | TargetStrongest
  deriving (Show, Eq, Enum, Bounded)

-- | Gun templates available for purchase.
data GunTemplate = GunTemplate
  { templateName :: String
  , templateCost :: Int
  , templateRange :: Double
  , templateCooldown :: Double
  , templateDamage :: Double
  } deriving (Show, Eq)

algorithmUpgradeCost :: Int
algorithmUpgradeCost = 100

-- | Simulation state for gameplay and UI.
data SimulationState = SimulationState
  { simGuns :: [Gun]
  , simEnemies :: [Enemy]
  , simBullets :: [Bullet]
  , simTime :: Double
  , simPaused :: Bool
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
  , spawnQueue :: [EnemyType]
  , selectedGun :: Maybe GunTemplate
  , gunMuzzleFlashes :: [(Int, Double)]
  , targetingAlgorithm :: TargetingAlgorithm
  , targetingMode :: TargetingMode
  , mousePosition :: (Float, Float)
  , mapPath :: [(Double, Double)]
  , showRanges :: Bool
  , simulationSpeed :: Double
  , totalKills :: Int
  , totalLeaks :: Int
  , totalSpent :: Int
  } deriving (Show)

availableGuns :: [GunTemplate]
availableGuns =
  [ GunTemplate "Pew-Pew Turret" 50 120 1.0 6
  , GunTemplate "No-Scope Nanny" 100 210 2.0 15
  , GunTemplate "BRRRT Machine" 80 95 0.45 4
  , GunTemplate "YEET Cannon" 150 150 1.4 20
  ]

defaultPath :: [(Double, Double)]
defaultPath =
  [ (-430, -210)
  , (-320, -120)
  , (-180, -140)
  , (-40, -40)
  , (100, 20)
  , (250, 80)
  , (420, 180)
  ]

initSimulation :: [Gun] -> [Enemy] -> SimulationState
initSimulation gs es = SimulationState
  { simGuns = gs
  , simEnemies = es
  , simBullets = []
  , simTime = 0
  , simPaused = False
  , currentRound = 1
  , points = 100
  , lives = 15
  , gamePhase = ShopPhase
  , nextGunId = 1
  , nextEnemyId = 1
  , nextBulletId = 1
  , enemiesSpawnedThisRound = 0
  , enemiesToSpawnThisRound = 0
  , spawnTimer = 0
  , spawnQueue = []
  , selectedGun = Nothing
  , gunMuzzleFlashes = []
  , targetingAlgorithm = GreedyNearest
  , targetingMode = TargetNearest
  , mousePosition = (0, 0)
  , mapPath = defaultPath
  , showRanges = True
  , simulationSpeed = 1.0
  , totalKills = 0
  , totalLeaks = 0
  , totalSpent = 0
  }

unlockAdvancedAlgorithm :: SimulationState -> SimulationState
unlockAdvancedAlgorithm state
  | targetingAlgorithm state == HungarianOptimal = state
  | points state >= algorithmUpgradeCost =
      state
        { targetingAlgorithm = HungarianOptimal
        , points = points state - algorithmUpgradeCost
        , totalSpent = totalSpent state + algorithmUpgradeCost
        }
  | otherwise = state

canAffordGun :: GunTemplate -> SimulationState -> Bool
canAffordGun template state = points state >= templateCost template

toggleRangeIndicators :: SimulationState -> SimulationState
toggleRangeIndicators s = s { showRanges = not (showRanges s) }

toggleSimulationSpeed :: SimulationState -> SimulationState
toggleSimulationSpeed s =
  s { simulationSpeed = if simulationSpeed s < 1.5 then 2.0 else 1.0 }

cycleTargetingMode :: SimulationState -> SimulationState
cycleTargetingMode s =
  let mode = targetingMode s
      nextMode
        | mode == maxBound = minBound
        | otherwise = succ mode
  in s { targetingMode = nextMode }

canPlaceGunAt :: (Double, Double) -> SimulationState -> Bool
canPlaceGunAt position state =
  inBounds position
    && not (occupied position (simGuns state))
    && not (intersectsPath position (mapPath state))
  where
    inBounds (x, y) = abs x <= 450 && abs y <= 270
    occupied p gs = any (\g -> distance p (gpos g) < 30) gs

    intersectsPath p path =
      let segments = zip path (drop 1 path)
      in any (\(a, b) -> pointToSegmentDistance p a b < 28) segments

addGunAtPosition :: GunTemplate -> (Double, Double) -> SimulationState -> SimulationState
addGunAtPosition template position state
  | canAffordGun template state && canPlaceGunAt position state =
      let newGun =
            Gun
              { gunId = nextGunId state
              , gunName = templateName template
              , gpos = position
              , range = templateRange template
              , cooldownTime = templateCooldown template
              , currentCd = 0
              , damagePerShot = templateDamage template
              , gunLevel = 1
              }
      in state
           { simGuns = newGun : simGuns state
           , points = points state - templateCost template
           , nextGunId = nextGunId state + 1
           , totalSpent = totalSpent state + templateCost template
           }
  | otherwise = state

upgradeGunAtPosition :: (Double, Double) -> SimulationState -> SimulationState
upgradeGunAtPosition clickPos state
  | gamePhase state /= ShopPhase = state
  | otherwise =
      case findClosestGun clickPos (simGuns state) of
        Nothing -> state
        Just g
          | not (canUpgrade g) -> state
          | points state < upgradeCost g -> state
          | otherwise ->
              let upgraded = upgradeGun g
                  replaceGun old new = map (\x -> if gunId x == gunId old then new else x)
                  cost = upgradeCost g
              in state
                   { simGuns = replaceGun g upgraded (simGuns state)
                   , points = points state - cost
                   , totalSpent = totalSpent state + cost
                   }
  where
    findClosestGun p gs =
      let candidates = filter (\g -> distance p (gpos g) <= 18) gs
      in case candidates of
           [] -> Nothing
           _ -> Just (minimumBy (comparing (distance p . gpos)) candidates)

-- | Calculate enemies for a round.
enemiesForRound :: Int -> Int
enemiesForRound roundNum = 6 + (roundNum - 1) * 3

waveForRound :: Int -> [EnemyType]
waveForRound roundNum =
  let total = enemiesForRound roundNum
      bruteCount = min (total `div` 3) (max 0 (roundNum - 2))
      runnerCount = min (total - bruteCount) (1 + roundNum)
      swarmCount = max 0 (total - bruteCount - runnerCount)
      swarms = replicate swarmCount Swarm
      runners = replicate runnerCount Runner
      brutes = replicate bruteCount Brute
  in interleave [swarms, runners, brutes]
  where
    interleave xs =
      case filter (not . null) xs of
        [] -> []
        ys -> map (\(z:_) -> z) ys ++ interleave (map (\(_:zs) -> zs) ys)

startNextRound :: SimulationState -> SimulationState
startNextRound state =
  let queue = waveForRound (currentRound state)
  in state
       { gamePhase = CombatPhase
       , enemiesToSpawnThisRound = length queue
       , enemiesSpawnedThisRound = 0
       , spawnQueue = queue
       , spawnTimer = 0
       , simTime = 0
       , selectedGun = Nothing
       }

-- | Assignment helper for CLI/demo output.
assignEnemies :: [Gun] -> [Enemy] -> [(Int, Maybe Int)]
assignEnemies gs es = map (\e -> (enemyId e, fmap gunId (bestGun TargetNearest gs e))) es

bestGun :: TargetingMode -> [Gun] -> Enemy -> Maybe Gun
bestGun mode gs e =
  let ready = filter (\ng -> currentCd ng <= 0 && distanceToEnemy ng e <= range ng) gs
      inRange = filter (\ng -> distanceToEnemy ng e <= range ng) gs
      pick xs = minimumBy (comparing (pairCost mode)) xs
      pairCost TargetNearest g = distanceToEnemy g e
      pairCost TargetFirst g = distanceToEnemy g e - damagePerShot g * 0.05
      pairCost TargetWeakest g = health e + distanceToEnemy g e * 0.1 - damagePerShot g * 0.2
      pairCost TargetStrongest g = negate (health e) + distanceToEnemy g e * 0.1
  in case ready of
       [] -> if null inRange then Nothing else Just (pick inRange)
       _ -> Just (pick ready)

spawnEnemyOfType :: SimulationState -> EnemyType -> Enemy
spawnEnemyOfType state et =
  let eid = nextEnemyId state + enemiesSpawnedThisRound state
      path = mapPath state
      startPos = case path of
        [] -> (-430, -210)
        (p:_) -> p
      nextWp = if length path > 1 then 1 else 0
      roundScale = 1 + fromIntegral (currentRound state - 1) * 0.12
      mkEnemy hp spd rew arm =
        Enemy
          { enemyId = eid
          , pos = startPos
          , health = hp * roundScale
          , maxHealth = hp * roundScale
          , speed = spd * (1 + fromIntegral (currentRound state - 1) * 0.02)
          , reward = rew
          , armor = arm
          , enemyType = et
          , targetWaypoint = nextWp
          }
  in case et of
       Swarm -> mkEnemy 8 75 6 0.0
       Runner -> mkEnemy 14 105 10 0.05
       Brute -> mkEnemy 45 55 18 0.22

stepSimulation :: Double -> SimulationState -> SimulationState
stepSimulation dt s
  | simPaused s = s
  | gamePhase s == ShopPhase = s
  | gamePhase s == GameOver = s
  | gamePhase s == CombatPhase = combatStep (dt * simulationSpeed s) s
  | otherwise = s

combatStep :: Double -> SimulationState -> SimulationState
combatStep dt s =
  let -- Spawn enemies over time.
      spawnInterval = 0.65
      newSpawnTimer = spawnTimer s + dt
      shouldSpawn = newSpawnTimer >= spawnInterval && not (null (spawnQueue s))
      (spawnedEnemies, spawnedTypes, timerAfterSpawn) =
        case (shouldSpawn, spawnQueue s) of
          (True, et:rest) -> ([spawnEnemyOfType s et], rest, newSpawnTimer - spawnInterval)
          _ -> ([], spawnQueue s, newSpawnTimer)

      allEnemies = simEnemies s ++ spawnedEnemies

      -- Move enemies along path and remove those that reached goal.
      movedEnemies = map (moveEnemyAlongPath dt (mapPath s)) allEnemies
      (escapedEnemies, activeEnemies) = partition (enemyReachedGoal (mapPath s)) movedEnemies
      livesLost = length escapedEnemies

      -- Tick cooldowns.
      gsTicked = map (tickCooldown dt) (simGuns s)

      -- Fire phase.
      (gs', newBullets, newFlashes) =
        firePhaseBullets (targetingAlgorithm s) (targetingMode s) (mapPath s) gsTicked activeEnemies (nextBulletId s)

      -- Move and collide bullets.
      movedBullets = map (moveBullet dt) (simBullets s ++ newBullets)
      (bulletsAfterHits, enemiesAfterHits, deadEnemies) = processBulletCollisions movedBullets activeEnemies

      -- Brutes split into swarms when killed.
      spawnedOnDeath = concatMap splitOnDeath deadEnemies
      allPostHitEnemies = enemiesAfterHits ++ spawnedOnDeath

      -- Muzzle flashes.
      updatedFlashes = map (\(gid, t) -> (gid, t - dt)) (gunMuzzleFlashes s ++ newFlashes)
      activeFlashes = filter (\(_, t) -> t > 0) updatedFlashes

      pointsEarned = sum (map reward deadEnemies)
      newLives = lives s - livesLost
      roundDone = null allPostHitEnemies && null spawnedTypes
      newPhase =
        if newLives <= 0
          then GameOver
          else if roundDone
            then ShopPhase
            else CombatPhase
      newRound =
        if newPhase == ShopPhase && gamePhase s == CombatPhase
          then currentRound s + 1
          else currentRound s

  in s
       { simGuns = gs'
       , simEnemies = allPostHitEnemies
       , simBullets = bulletsAfterHits
       , simTime = simTime s + dt
       , spawnTimer = timerAfterSpawn
       , spawnQueue = spawnedTypes
       , enemiesSpawnedThisRound = enemiesSpawnedThisRound s + length spawnedEnemies
       , nextEnemyId = nextEnemyId s + length spawnedEnemies + length spawnedOnDeath
       , nextBulletId = nextBulletId s + length newBullets
       , points = points s + pointsEarned
       , lives = newLives
       , gamePhase = newPhase
       , currentRound = newRound
       , gunMuzzleFlashes = activeFlashes
       , totalKills = totalKills s + length deadEnemies
       , totalLeaks = totalLeaks s + livesLost
       }
  where
    splitOnDeath e
      | enemyType e /= Brute = []
      | otherwise =
          let mkChild offset nid =
                Enemy
                  { enemyId = nid
                  , pos = (fst (pos e) + offset, snd (pos e) - offset)
                  , health = max 6 (maxHealth e * 0.18)
                  , maxHealth = max 6 (maxHealth e * 0.18)
                  , speed = speed e * 1.4
                  , reward = 5
                  , armor = 0
                  , enemyType = Swarm
                  , targetWaypoint = targetWaypoint e
                  }
              n1 = nextEnemyId s
              n2 = nextEnemyId s + 1
          in [mkChild (-8) n1, mkChild 8 n2]

firePhaseBullets :: TargetingAlgorithm -> TargetingMode -> [(Double, Double)] -> [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
firePhaseBullets algo mode path guns enemies startBulletId =
  case algo of
    GreedyNearest -> greedyTargeting mode path guns enemies startBulletId
    HungarianOptimal -> optimalTargeting mode path guns enemies startBulletId

greedyTargeting :: TargetingMode -> [(Double, Double)] -> [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
greedyTargeting mode path guns enemies startBulletId =
  let (gs, bs, fs, _) = go guns [] [] startBulletId
  in (gs, bs, fs)
  where
    go [] accBullets accFlashes bid = ([], accBullets, accFlashes, bid)
    go (g:gs) accBullets accFlashes bulletId =
      let candidates = filter (\e -> distanceToEnemy g e <= range g) enemies
          (g', newBullets, newFlashes, nextId) =
            if currentCd g > 0 || null candidates
              then (g, [], [], bulletId)
              else
                let target = minimumBy (comparing (pairCost mode path g)) candidates
                    fired = g { currentCd = cooldownTime g }
                    bullet = createBullet bulletId (gunId g) (gpos g) (pos target) (damagePerShot g)
                    flash = (gunId g, 0.1)
                in (fired, [bullet], [flash], bulletId + 1)
          (restGuns, restBullets, restFlashes, finalId) =
            go gs (accBullets ++ newBullets) (accFlashes ++ newFlashes) nextId
      in (g' : restGuns, restBullets, restFlashes, finalId)

optimalTargeting :: TargetingMode -> [(Double, Double)] -> [Gun] -> [Enemy] -> Int -> ([Gun], [Bullet], [(Int, Double)])
optimalTargeting mode path guns enemies startBulletId =
  let readyGuns = filter (\g -> currentCd g <= 0) guns
      restingGuns = filter (\g -> currentCd g > 0) guns
      cappedEnemies = take 12 $ sortByThreat path enemies
      cappedGuns = take 10 readyGuns
      assignments = if length cappedGuns * length cappedEnemies <= 80
        then exactAssignment mode path cappedGuns cappedEnemies
        else uniqueGreedyAssignments mode path cappedGuns cappedEnemies
      (firedGuns, bullets, flashes, nextId) = processAssignments assignments startBulletId
      firedIds = map (gunId . fst) assignments
      untouchedReady = filter (\g -> gunId g `notElem` firedIds) readyGuns
      allGuns = firedGuns ++ untouchedReady ++ restingGuns
  in nextId `seq` (allGuns, bullets, flashes)

processAssignments :: [(Gun, Enemy)] -> Int -> ([Gun], [Bullet], [(Int, Double)], Int)
processAssignments [] bid = ([], [], [], bid)
processAssignments ((g, e):rest) bulletId =
  let g' = g { currentCd = cooldownTime g }
      bullet = createBullet bulletId (gunId g) (gpos g) (pos e) (damagePerShot g)
      flash = (gunId g, 0.1)
      (restGuns, restBullets, restFlashes, finalId) = processAssignments rest (bulletId + 1)
  in (g' : restGuns, bullet : restBullets, flash : restFlashes, finalId)

exactAssignment :: TargetingMode -> [(Double, Double)] -> [Gun] -> [Enemy] -> [(Gun, Enemy)]
exactAssignment mode path guns enemies = snd (go guns enemies)
  where
    go [] es = (0, [])
    go (g:gs) es =
      let skip = go gs es
          options =
            [ let (costTail, asgTail) = go gs (filter (\x -> enemyId x /= enemyId e) es)
              in (pairCost mode path g e + costTail, (g, e) : asgTail)
            | e <- es
            , distanceToEnemy g e <= range g
            ]
          allChoices = skip : options
      in minimumBy (comparing fst) allChoices

uniqueGreedyAssignments :: TargetingMode -> [(Double, Double)] -> [Gun] -> [Enemy] -> [(Gun, Enemy)]
uniqueGreedyAssignments mode path guns enemies = go guns enemies []
  where
    go [] _ acc = acc
    go _ [] acc = acc
    go (g:gs) es acc =
      let candidates = filter (\e -> distanceToEnemy g e <= range g) es
      in if null candidates
           then go gs es acc
           else
             let e = minimumBy (comparing (pairCost mode path g)) candidates
                 remaining = filter (\x -> enemyId x /= enemyId e) es
             in go gs remaining ((g, e) : acc)

pairCost :: TargetingMode -> [(Double, Double)] -> Gun -> Enemy -> Double
pairCost mode path g e =
  case mode of
    TargetNearest -> distanceToEnemy g e
    TargetFirst -> remainingPathDistance path e * 0.8 + distanceToEnemy g e * 0.4 - speed e * 0.25
    TargetWeakest -> health e + distanceToEnemy g e * 0.2
    TargetStrongest -> (1000 - health e * 6) + distanceToEnemy g e * 0.2

sortByThreat :: [(Double, Double)] -> [Enemy] -> [Enemy]
sortByThreat path =
  sortWith (\e -> remainingPathDistance path e - speed e * 0.25 - health e * 0.02)

sortWith :: Ord b => (a -> b) -> [a] -> [a]
sortWith f = map snd . sortPairs . map (\x -> (f x, x))
  where
    sortPairs = foldr insert []
    insert x [] = [x]
    insert x (y:ys)
      | fst x <= fst y = x : y : ys
      | otherwise = y : insert x ys

remainingPathDistance :: [(Double, Double)] -> Enemy -> Double
remainingPathDistance path e
  | null path = 0
  | targetWaypoint e >= length path = 0
  | otherwise =
      let fromPos = pos e
          nextPoint = path !! targetWaypoint e
          initial = distance fromPos nextPoint
          rest = zip (drop (targetWaypoint e) path) (drop (targetWaypoint e + 1) path)
      in initial + sum [distance a b | (a, b) <- rest]

processBulletCollisions :: [Bullet] -> [Enemy] -> ([Bullet], [Enemy], [Enemy])
processBulletCollisions bullets enemies =
  let (activeBullets, damageEvents) = foldr checkBullet ([], []) bullets
      enemyDamages = aggregateDamage damageEvents []
      (updatedEnemies, deadEnemies) = applyDamages enemyDamages enemies [] []
  in (activeBullets, updatedEnemies, deadEnemies)
  where
    checkBullet bullet (accBullets, accEvents) =
      let (bx, by) = bulletPos bullet
          outOfBounds = abs bx > 620 || abs by > 420
          hitEnemy = firstHit bullet enemies
      in case hitEnemy of
           Just e -> (accBullets, (enemyId e, bulletDamage bullet) : accEvents)
           Nothing ->
             if outOfBounds
               then (accBullets, accEvents)
               else (bullet : accBullets, accEvents)

    firstHit b = pick b . filter (collides b)
    pick _ [] = Nothing
    pick b xs = Just (minimumBy (comparing (distance (bulletPos b) . pos)) xs)

    collides b e =
      let d = distance (bulletPos b) (pos e)
      in d < 10

    aggregateDamage [] acc = acc
    aggregateDamage ((eid, dmg):rest) acc =
      let updated = addDamage eid dmg acc
      in aggregateDamage rest updated

    addDamage eid dmg [] = [(eid, dmg)]
    addDamage eid dmg ((k, v):xs)
      | eid == k = (k, v + dmg) : xs
      | otherwise = (k, v) : addDamage eid dmg xs

    applyDamages _ [] alive dead = (reverse alive, reverse dead)
    applyDamages dmgs (e:es) alive dead =
      let incoming = sum [d | (eid, d) <- dmgs, eid == enemyId e]
          effective = incoming * (1 - armor e)
          newHealth = health e - effective
          e' = e { health = newHealth }
      in if newHealth <= 0
           then applyDamages dmgs es alive (e : dead)
           else applyDamages dmgs es (e' : alive) dead

pointToSegmentDistance :: (Double, Double) -> (Double, Double) -> (Double, Double) -> Double
pointToSegmentDistance (px, py) (x1, y1) (x2, y2)
  | x1 == x2 && y1 == y2 = distance (px, py) (x1, y1)
  | otherwise =
      let dx = x2 - x1
          dy = y2 - y1
          t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
          t' = max 0 (min 1 t)
          proj = (x1 + t' * dx, y1 + t' * dy)
      in distance (px, py) proj

simulateOnce :: [Gun] -> [Enemy] -> IO ()
simulateOnce gs es = do
  let asg = assignEnemies gs es
  putStrLn "Assignments (enemyId -> maybe gunId):"
  mapM_ print asg
