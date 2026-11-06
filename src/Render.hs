module Render (drawState, handleEventGloss) where

import Data.List (isInfixOf, minimumBy)
import Data.Ord (comparing)
import Graphics.Gloss
import Graphics.Gloss.Interface.Pure.Game
  ( Event(..)
  , Key(..)
  , KeyState(..)
  , MouseButton(..)
  , SpecialKey(..)
  )
import Game
  ( GamePhase(..)
  , GunTemplate(..)
  , SimulationState(..)
  , TargetingAlgorithm(..)
  , TargetingMode(..)
  , addGunAtPosition
  , algorithmUpgradeCost
  , availableGuns
  , canAffordGun
  , canPlaceGunAt
  , cycleTargetingMode
  , startNextRound
  , toggleRangeIndicators
  , toggleSimulationSpeed
  , unlockAdvancedAlgorithm
  , upgradeGunAtPosition
  )
import Enemy (Enemy(..), EnemyType(..))
import Gun (Gun(..), distanceToEnemy)
import Bullet (Bullet(..))
import Assets (Assets(..))

-- | Convert simulation state to a Picture, using loaded Kenney sprites.
drawState :: Assets -> SimulationState -> Picture
drawState assets s = case gamePhase s of
  ShopPhase -> Pictures [starrySky t, battlefield, gridLines, pathPic, portalAndBase, towerRanges, gunsPic, placementPreview, sparkles, shopUI, hud]
  CombatPhase -> Pictures [starrySky t, battlefield, gridLines, pathPic, portalAndBase, towerRanges, gunsPic, muzzleFlashes, bulletsPic, enemiesPic, hud, combatBanner]
  GameOver -> Pictures [starrySky t, battlefield, gridLines, pathPic, towerRanges, gunsPic, bulletsPic, enemiesPic, gameOverScreen]
  where
    t = realToFrac (simTime s) :: Float
    gs = simGuns s
    es = simEnemies s
    bs = simBullets s
    flashes = gunMuzzleFlashes s

    -- Deep-space battlefield with soft vignette
    battlefield = Pictures
      [ color (makeColor 0.07 0.08 0.14 1) $ rectangleSolid 1000 600
      , color (makeColor 0.10 0.12 0.20 1) $ rectangleSolid 900 540
      , color (makeColor 0.16 0.20 0.32 1) $ rectangleWire 900 540
      , color (makeColor 1 0.85 0.4 0.06) $ rectangleWire 1000 600
      ]

    gridLines =
      let vertical = [x | x <- [-440,-400..440]]
          horizontal = [y | y <- [-260,-220..260]]
          vLines = map (\x -> Translate x 0 $ color (makeColor 0.3 0.8 1 0.05) $ rectangleSolid 1 540) vertical
          hLines = map (\y -> Translate 0 y $ color (makeColor 0.3 0.8 1 0.05) $ rectangleSolid 900 1) horizontal
      in Pictures (vLines ++ hLines)

    starrySky time =
      let dots = [(i, -450 + fromIntegral ((i*173) `mod` 900), -270 + fromIntegral ((i*97) `mod` 540)) | i <- [0..70 :: Int] ] :: [(Int, Float, Float)]
      in Pictures
           [ Translate x y $ color (makeColor 1 1 1 (0.15 + 0.15 * sin (time*2 + fromIntegral i))) $ circleSolid (1 + fromIntegral (i `mod` 2))
           | (i,x,y) <- dots ]

    sparkles =
      let tw = 0.5 + 0.5 * sin (t*3)
      in Pictures
        [ Translate (-300) 240 $ color (makeColor 1 0.9 0.5 (0.2+0.2*tw)) $ circleSolid 2
        , Translate (100) (-240) $ color (makeColor 0.5 1 1 (0.2+0.2*tw)) $ circleSolid 2
        , Translate (-100) 200 $ color (makeColor 1 0.6 1 (0.15+0.15*tw)) $ circleSolid 1.5
        ]

    pathPic =
      let pts = map (\(x, y) -> (realToFrac x, realToFrac y)) (mapPath s)
          dotsAlong = Pictures (map (\(x, y) -> Translate x y $ color (makeColor 1 0.9 0.6 0.08) $ circleSolid 22) pts)
      in Pictures
           [ color (makeColor 0.25 0.18 0.10 1) $ Line pts  -- dark choc border (under)
           , Translate 0 3 $ color (makeColor 0.85 0.72 0.45 1) $ Line pts -- sandy road top, offset for fake thickness
           , color (makeColor 0.95 0.82 0.55 1) $ Line pts
           , dotsAlong
           , color (makeColor 1 1 1 0.35) $ Pictures (map (\(x, y) -> Translate x y $ circleSolid 3) pts)
           ]

    portalAndBase = case mapPath s of
      [] -> Blank
      path@((sx, sy):_) ->
        let (ex, ey) = last path
            portalScale = 0.5 + 0.04 * sin (t*4)
        in Pictures
          [ Translate (realToFrac sx) (realToFrac sy) $ Pictures
              [ color (makeColor 0.2 1 0.8 0.18) $ circleSolid 34
              , Rotate (t*40) $ scale portalScale portalScale (aPortal assets)
              , Translate (-28) (-30) $ scale 0.08 0.08 $ color (makeColor 0.5 1 0.9 1) $ Text "gremlin hole"
              ]
          , Translate (realToFrac ex) (realToFrac ey) $ Pictures
              [ color (makeColor 0.5 0.8 1 0.15) $ circleSolid 30
              , scale 0.55 0.55 (aCrystal assets)
              , Translate 16 16 $ drawHeart (10 + 2*sin (t*5))
              , Translate (-34) 26 $ scale 0.08 0.08 $ color (makeColor 1 0.8 0.9 1) $ Text "ur crystal (pls protect)"
              ]
          ]

    drawHeart r = Pictures
      [ color (makeColor 1 0.25 0.45 1) $ circleSolid (r*0.55)
      , Translate (r*0.9) 0 $ color (makeColor 1 0.25 0.45 1) $ circleSolid (r*0.55)
      , color (makeColor 1 0.25 0.45 1) $ Polygon [(-r*0.5, -r*0.1),(r*1.4, -r*0.1),(r*0.45, -r)]
      ]

    drawStar r = color (makeColor 1 0.85 0.2 1) $ Polygon
      [ (r*cos a, r*sin a) | a <- [pi/2, pi/2+2*pi/5 .. pi/2+8*pi/5] ]

    placementPreview = case selectedGun s of
      Nothing -> Blank
      Just template ->
        let (mx, my) = mousePosition s
            snapX = fromIntegral (round (mx / 40) :: Int) * 40
            snapY = fromIntegral (round (my / 40) :: Int) * 40
            p = (realToFrac snapX, realToFrac snapY)
            canPlace = canAffordGun template s && canPlaceGunAt p s
            rangeColor = if canPlace then makeColor 0.3 0.9 1 0.12 else makeColor 1 0.3 0.3 0.08
        in Translate snapX snapY $ Pictures
             [ color rangeColor $ circleSolid (realToFrac (templateRange template))
             , color (makeColor 0.4 1 1 0.5) $ circle (realToFrac (templateRange template))
             , ghostPic template
             , color white $ ThickCircle 11 2
             , Translate (-22) 16 $ scale 0.08 0.08 $ color white $ Text (if canPlace then "click = adopt!" else "nope, bad spot!")
             ]

    ghostPic template
      | "Nanny" `isInfixOf` templateName template = color (makeColor 1 1 1 0.7) $ scale 0.32 0.32 (aNannyBase assets)
      | "BRRRT" `isInfixOf` templateName template = color (makeColor 1 1 1 0.7) $ scale 0.32 0.32 (aBrrrt assets)
      | "YEET" `isInfixOf` templateName template = color (makeColor 1 1 1 0.7) $ scale 0.32 0.32 (aYeet assets)
      | otherwise = color (makeColor 1 1 1 0.7) $ scale 0.32 0.32 (aPewBase assets)

    isSniper g = "Nanny" `isInfixOf` gunName g
    isRapid g = "BRRRT" `isInfixOf` gunName g
    isHeavy g = "YEET" `isInfixOf` gunName g

    gunPic g =
      let (xD, yD) = gpos g
          x = realToFrac xD
          y = realToFrac yD
          lvlStars = [Translate (-10 + fromIntegral i * 10) (-20) $ scale 0.6 0.6 $ drawStar 5 | i <- [0 .. gunLevel g - 1]]
          -- Aim the barrel at the nearest gremlin (sprites face up).
          aim = case es of
            [] -> 0
            _ -> let e = minimumBy (comparing (distanceToEnemy g)) es
                 in aimAngle (gpos g) (pos e)
          body
            | isSniper g = Pictures
                [ scale 0.32 0.32 (aNannyBase assets)
                , Rotate aim $ Translate 0 10 $ scale 0.32 0.32 (aNannyBarrel assets)
                ]
            | isRapid g = Rotate aim $ scale 0.32 0.32 (aBrrrt assets)
            | isHeavy g = Rotate aim $ scale 0.32 0.32 (aYeet assets)
            | otherwise = Pictures
                [ scale 0.32 0.32 (aPewBase assets)
                , Rotate aim $ Translate 0 8 $ scale 0.32 0.32 (aPewBarrel assets)
                ]
      in Translate x y $ Pictures
           [ color (makeColor 0 0 0 0.4) $ Translate 2 (-14) $ scale 1 0.45 $ circleSolid 16 -- shadow
           , body
           , Pictures lvlStars
           ]

    towerRanges =
      if showRanges s
        then Pictures $ map drawRange gs
        else Blank
      where
        drawRange ng =
          let (gx, gy) = gpos ng
          in Translate (realToFrac gx) (realToFrac gy) $
               Pictures
                 [ color (makeColor 0.3 0.9 1 0.06) (circleSolid (realToFrac (range ng)))
                 , color (makeColor 0.4 1 1 0.22) (ThickCircle (realToFrac (range ng)) 1.5)
                 ]

    gunsPic = Pictures $ map gunPic gs

    muzzleFlashes = Pictures $ map drawFlash flashes
      where
        drawFlash (gid, _) =
          case filter (\g -> gunId g == gid) gs of
            (g:_) ->
              let (gx, gy) = gpos g
              in Translate (realToFrac gx) (realToFrac gy) $ Pictures
                   [ Rotate (fromIntegral (gid * 47)) $ Translate 0 16 $ scale 0.5 0.5 (aFlame assets)
                   , Translate 0 20 $ scale 0.07 0.07 $ color yellow $ Text "PEW!"
                   ]
            [] -> Blank

    bulletPic bullet =
      let (xD, yD) = bulletPos bullet
          (vx, vy) = bulletVel bullet
          len = sqrt (vx*vx+vy*vy) + 1
          tx = xD - vx/len*18
          ty = yD - vy/len*18
          sprite = if bulletDamage bullet >= 12 then aBulletHeavy assets else aBullet assets
      in Pictures
           [ color (makeColor 1 0.6 0.1 0.5) $ Line [(realToFrac tx, realToFrac ty),(realToFrac xD, realToFrac yD)]
           , Translate (realToFrac xD) (realToFrac yD) $ scale 0.35 0.35 sprite
           ]

    bulletsPic = Pictures $ map bulletPic bs

    enemyPic e =
      let (xD, yD) = pos e
          bob = 2.5 * sin (t*6 + fromIntegral (enemyId e))
          x = realToFrac xD
          y = realToFrac yD + bob
          hpRatio = max 0 (health e / maxHealth e)
          hpCol | hpRatio > 0.6 = makeColor 0.35 1 0.45 1
                | hpRatio > 0.3 = makeColor 1 0.85 0.25 1
                | otherwise = makeColor 1 0.3 0.35 1
          (sprite, sprScale, sizeBase) = case enemyType e of
            Swarm -> (aSwarm assets, 0.4, 7)
            Runner -> (aRunner assets, 0.4, 9)
            Brute -> (aBrute assets, 0.32, 13)
          -- Face along the path toward the next waypoint (sprites face up).
          facing = case drop (targetWaypoint e) (mapPath s) of
            (nx, ny):_ -> aimAngle (pos e) (nx, ny)
            [] -> 0
          label = case enemyType e of
            Swarm -> "zoomie"
            Runner -> "espresso goblin"
            Brute -> "chungus"
      in Translate x y $ Pictures
           [ color (makeColor 0 0 0 0.35) (Translate 2 (-3) $ scale 1 0.5 $ circleSolid (sizeBase + 2))
           , Rotate facing $ scale sprScale sprScale sprite
           , Translate (-11) (sizeBase + 9) $ color (makeColor 0 0 0 0.7) $ rectangleSolid 22 5
           , Translate (-11 + realToFrac (hpRatio * 11)) (sizeBase + 9) $ color hpCol $ rectangleSolid (realToFrac (hpRatio * 22)) 3.5
           , Translate (-14) (-sizeBase-12) $ scale 0.06 0.06 $ color (makeColor 1 1 1 0.7) $ Text label
           , if hpRatio < 0.3 then Translate 8 6 $ scale 0.07 0.07 $ color red $ Text "!!" else Blank
           ]

    enemiesPic = Pictures $ map enemyPic es

    hud = Pictures
      [ Translate (-480) 282 $ color (makeColor 0 0 0 0.55) $ rectangleSolid 210 110
      , Translate (-480) 280 $ scale 0.14 0.14 $ color (makeColor 1 0.9 0.5 1) $ Text $ "ROUND " ++ show (currentRound s) ++ " ~~~"
      , Translate (-480) 260 $ scale 0.13 0.13 $ color yellow $ Text $ "Cash: $" ++ show (points s) ++ " (gremlin tears)"
      , Translate (-480) 242 $ scale 0.13 0.13 $ color (makeColor 1 0.45 0.55 1) $ Text $ "Lives: " ++ show (lives s) ++ " hugs left"
      , Translate (-480) 226 $ scale 0.10 0.10 $ color (makeColor 0.6 1 1 1) $ Text $ "Mood: " ++ targetingModeLabel (targetingMode s)
      , Translate (-480) 212 $ scale 0.09 0.09 $ color (makeColor 0.8 0.8 0.9 1) $ Text $ "Caffeine: x" ++ show (simulationSpeed s) ++ " | Kills: " ++ show (totalKills s)
      , if gamePhase s == CombatPhase
          then Translate (-480) 196 $ scale 0.09 0.09 $ color (makeColor 0.5 1 0.6 1) $ Text $ "Wave: " ++ show (enemiesSpawnedThisRound s) ++ "/" ++ show (enemiesToSpawnThisRound s) ++ " bozos"
          else Blank
      , Translate (-280) (-282) $ scale 0.09 0.09 $ color (makeColor 1 1 1 0.75) $ Text $ funnyTip (currentRound s)
      ]

    combatBanner =
      if simPaused s
        then Translate (-120) 0 $ scale 0.25 0.25 $ color (makeColor 1 1 1 0.85) $ Text "PAUSED (snack break)"
        else Blank

    shopUI = Pictures
      [ Translate 200 0 $ color (makeColor 0.09 0.10 0.18 0.96) $ rectangleSolid 600 600
      , Translate 200 0 $ color (makeColor 0.4 0.9 1 0.35) $ rectangleWire 600 600
      , Translate 30 278 $ scale 0.24 0.24 $ color (makeColor 1 0.88 0.4 1) $ Text "GUN SHOP (no refunds!!)"
      , Translate (-20) 256 $ scale 0.09 0.09 $ color (makeColor 0.7 1 0.9 1) $ Text "certified pew-pew dealers since round 1"
      , Translate (-60) 238 $ scale 0.085 0.085 $ color (makeColor 0.8 0.9 1 1) $ Text "LMB: adopt tower  |  RMB: protein shake (upgrade)"
      , Translate (-60) 224 $ scale 0.08 0.08 $ color (makeColor 0.7 1 0.7 1) $ Text "SPACE pew-time | T gossip | R disco lights | F espresso"
      , Pictures $ zipWith drawGunButton [0 :: Int ..] availableGuns
      , drawAlgorithmUpgrade
      , drawTargetModeButton
      ]

    drawAlgorithmUpgrade =
      let yPos = -208
          isUnlocked = targetingAlgorithm s == HungarianOptimal
          canAfford = points s >= algorithmUpgradeCost
          btnColor
            | isUnlocked = makeColor 0.15 0.55 0.25 0.95
            | canAfford = makeColor 0.55 0.38 0.08 0.95
            | otherwise = makeColor 0.38 0.16 0.16 0.8
      in Pictures
           [ Translate 200 yPos $ color btnColor $ rectangleSolid 540 64
           , Translate 200 yPos $ color (makeColor 1 1 1 0.8) $ rectangleWire 540 64
           , Translate (-30) (yPos + 12) $ scale 0.12 0.12 $ color white $ Text $
               if isUnlocked then "Big Brain Mode: ON" else "Unlock Big Brain Mode"
           , Translate (-30) (yPos - 12) $ scale 0.08 0.08 $ color yellow $ Text $
               if isUnlocked then "turrets now share (aww)" else "teaches turrets sharing $" ++ show algorithmUpgradeCost
           ]

    drawTargetModeButton =
      let yPos = -132
      in Pictures
           [ Translate 200 yPos $ color (makeColor 0.16 0.26 0.45 0.95) $ rectangleSolid 540 58
           , Translate 200 yPos $ color (makeColor 0.55 0.85 1 1) $ rectangleWire 540 58
           , Translate (-30) (yPos + 7) $ scale 0.11 0.11 $ color white $ Text "Target Gossip"
           , Translate (120) (yPos - 10) $ scale 0.095 0.095 $ color yellow $ Text (targetingModeLabel (targetingMode s))
           ]

    gunFlavor idx = case idx of
      0 -> "reliable, like socks"
      1 -> "360 no-scope granny"
      2 -> "caffeine incarnate"
      3 -> "diplomatic solution"
      _ -> "pew?"

    drawGunButton idx template =
      let yPos = 168 - fromIntegral idx * 76
          affordable = canAffordGun template s
          isSelected = case selectedGun s of
            Just chosen -> templateName chosen == templateName template
            Nothing -> False
          btnColor
            | isSelected = makeColor 0.30 0.62 0.95 1
            | affordable = makeColor 0.14 0.38 0.20 0.95
            | otherwise = makeColor 0.38 0.16 0.16 0.75
      in Pictures
           [ Translate 200 yPos $ color btnColor $ rectangleSolid 540 66
           , Translate 200 yPos $ color (makeColor 1 1 1 0.85) $ rectangleWire 540 66
           , Translate (-30) (yPos + 14) $ scale 0.135 0.135 $ color white $ Text (templateName template)
           , Translate (-30) (yPos - 7) $ scale 0.085 0.085 $ color yellow $ Text ("$" ++ show (templateCost template) ++ "  ~ " ++ gunFlavor idx)
           , Translate 90 (yPos - 7) $ scale 0.075 0.075 $ color (makeColor 0.7 0.95 1 1) $ Text ("RNG:" ++ show (round (templateRange template) :: Int))
           , Translate 190 (yPos - 7) $ scale 0.075 0.075 $ color (makeColor 1 0.75 0.75 1) $ Text ("POW:" ++ show (round (templateDamage template) :: Int))
           ]

    gameOverScreen = Pictures
      [ color (makeColor 0.05 0.02 0.08 0.88) $ rectangleSolid 1000 600
      , Translate (-240) 90 $ scale 0.28 0.28 $ color (makeColor 1 0.35 0.5 1) $ Text "BASE GOT SNACC'D!"
      , Translate (-200) 45 $ scale 0.11 0.11 $ color white $ Text "the gremlins are doing victory laps rn"
      , Translate (-200) 15 $ scale 0.12 0.12 $ color (makeColor 1 0.9 0.5 1) $ Text $ "Survived to Round: " ++ show (currentRound s)
      , Translate (-200) (-12) $ scale 0.11 0.11 $ color (makeColor 0.5 1 0.6 1) $ Text $ "Gremlins yeeted: " ++ show (totalKills s)
      , Translate (-200) (-38) $ scale 0.11 0.11 $ color (makeColor 1 0.55 0.55 1) $ Text $ "Base hugs received: " ++ show (totalLeaks s)
      , Translate (-200) (-64) $ scale 0.11 0.11 $ color (makeColor 0.7 0.9 1 1) $ Text $ "Cash vaporized: $" ++ show (totalSpent s)
      , Translate (-200) (-110) $ scale 0.09 0.09 $ color (greyN 0.8) $ Text "Press Q to cry quietly (then replay!)"
      ]

-- | Rotation (Gloss degrees, counterclockwise) to aim a sprite that faces
-- up (+y) from one point at another.
aimAngle :: (Double, Double) -> (Double, Double) -> Float
aimAngle (fx, fy) (tx, ty)
  | dx == 0 && dy == 0 = 0
  | otherwise = realToFrac (-(atan2 dx dy * 180 / pi))
  where
    dx = tx - fx
    dy = ty - fy

funnyTip :: Int -> String
funnyTip r = case r `mod` 6 of
  0 -> "Tip: Brutes split like bad gossip - finish them twice!"
  1 -> "Tip: BRRRT goes brrrr. Trust."
  2 -> "Tip: Right-click = protein shake for turrets."
  3 -> "Tip: Chungus hates being bullied first. Do it."
  4 -> "Tip: Snipers need coffee too. Protect them."
  5 -> "Tip: The gremlin hole is NOT a petting zoo."
  _ -> "Tip: Pew responsibly."

handleEventGloss :: Event -> SimulationState -> SimulationState
handleEventGloss (EventMotion (x, y)) s = s { mousePosition = (x, y) }
handleEventGloss (EventKey (SpecialKey KeySpace) Down _ _) s
  | gamePhase s == ShopPhase = startNextRound s
  | gamePhase s == CombatPhase = s { simPaused = not (simPaused s) }
  | otherwise = s
handleEventGloss (EventKey (Char 'r') Down _ _) s = toggleRangeIndicators s
handleEventGloss (EventKey (Char 'f') Down _ _) s = toggleSimulationSpeed s
handleEventGloss (EventKey (Char 't') Down _ _) s = cycleTargetingMode s
handleEventGloss (EventKey (MouseButton LeftButton) Down _ (x, y)) s
  | gamePhase s == ShopPhase =
      case selectedGun s of
        Nothing -> selectGunFromShop x y s
        Just template -> placeGunOnField template x y s
  | otherwise = s
handleEventGloss (EventKey (MouseButton RightButton) Down _ (x, y)) s
  | gamePhase s == ShopPhase = upgradeGunAtPosition (realToFrac x, realToFrac y) s
  | otherwise = s
handleEventGloss (EventKey (Char 'q') Down _ _) s = s
handleEventGloss _ s = s

selectGunFromShop :: Float -> Float -> SimulationState -> SimulationState
selectGunFromShop x y s
  | x >= -70 && x <= 470 = checkButtons
  | otherwise = s
  where
    checkButtons =
      let algoYPos = -208
          algoYMin = algoYPos - 32
          algoYMax = algoYPos + 32
          modeYPos = -132
          modeYMin = modeYPos - 29
          modeYMax = modeYPos + 29
      in if y >= algoYMin && y <= algoYMax
           then if targetingAlgorithm s == GreedyNearest && points s >= algorithmUpgradeCost
             then unlockAdvancedAlgorithm s
             else s
           else if y >= modeYMin && y <= modeYMax
             then cycleTargetingMode s
             else checkGunButtons 0 availableGuns

    checkGunButtons :: Int -> [GunTemplate] -> SimulationState
    checkGunButtons _ [] = s
    checkGunButtons idx (template:rest) =
      let yPos = 168 - fromIntegral idx * 76
          yMin = yPos - 33
          yMax = yPos + 33
      in if y >= yMin && y <= yMax && canAffordGun template s
           then s { selectedGun = Just template }
           else checkGunButtons (idx + 1) rest

placeGunOnField :: GunTemplate -> Float -> Float -> SimulationState -> SimulationState
placeGunOnField template x y s =
  let snapX = fromIntegral (round (x / 40) :: Int) * (40 :: Float)
      snapY = fromIntegral (round (y / 40) :: Int) * (40 :: Float)
      p = (realToFrac snapX, realToFrac snapY)
      newState = addGunAtPosition template p s
  in if points newState /= points s
       then newState { selectedGun = Nothing }
       else s

targetingModeLabel :: TargetingMode -> String
targetingModeLabel mode = case mode of
  TargetNearest -> "Closest Bozo"
  TargetFirst -> "Front of Conga Line"
  TargetWeakest -> "Bully the Smoll"
  TargetStrongest -> "Big Chungus First"
