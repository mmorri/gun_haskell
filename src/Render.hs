module Render (drawState, handleEventGloss) where

import Graphics.Gloss
import Graphics.Gloss.Interface.Pure.Game (Event(..), Key(..), SpecialKey(..), KeyState(..), MouseButton(..))
import Game (SimulationState(..), GamePhase(..), GunTemplate(..), TargetingAlgorithm(..), availableGuns, addGunAtPosition, startNextRound, canAffordGun, unlockAdvancedAlgorithm, algorithmUpgradeCost)
import Enemy (Enemy(..))
import Gun (Gun(..))
import Bullet (Bullet(..))

-- | Convert simulation state to a Picture
drawState :: SimulationState -> Picture
drawState s = case gamePhase s of
  ShopPhase -> Pictures [battlefield, gunsPic, placementPreview, shopUI, hud]
  CombatPhase -> Pictures [battlefield, ranges, gunsPic, muzzleFlashes, bulletsPic, enemiesPic, hud]
  GameOver -> Pictures [battlefield, gunsPic, bulletsPic, enemiesPic, gameOverScreen]
  where
    gs = simGuns s
    es = simEnemies s
    bs = simBullets s
    flashes = gunMuzzleFlashes s

    -- Draw battlefield boundary
    battlefield = Pictures
      [ color (greyN 0.15) $ rectangleWire 1000 600
      , color (greyN 0.08) $ rectangleSolid 900 540  -- Darker background for play area
      ]

    -- Placement preview when gun is selected in shop
    placementPreview = case selectedGun s of
      Nothing -> Blank
      Just template ->
        let (mx, my) = mousePosition s
            -- Snap to grid (40 pixel grid)
            snapX = fromIntegral (round (mx / 40) :: Int) * 40
            snapY = fromIntegral (round (my / 40) :: Int) * 40
            inBounds = abs snapX <= 450 && abs snapY <= 270
            canPlace = canAffordGun template s && inBounds
            previewColor = if canPlace
                             then makeColor 0.3 0.8 0.3 0.4  -- Green if can place
                             else makeColor 0.8 0.3 0.3 0.4  -- Red if can't
            rangeColor = if canPlace
                           then makeColor 0.3 0.6 1 0.15
                           else makeColor 0.8 0.3 0.3 0.1
        in if inBounds || abs mx < 500  -- Show preview if mouse is near battlefield
             then Translate snapX snapY $ Pictures
               [ -- Range circle
                 color rangeColor $ circleSolid (realToFrac (templateRange template))
               , color (makeColor 0.3 0.6 1 0.3) $ circle (realToFrac (templateRange template))
                 -- Gun preview
               , color previewColor $ circleSolid 10
               , color (if canPlace then green else red) $ circle 10
                 -- Crosshair
               , color white $ Pictures
                   [ Line [(-15, 0), (15, 0)]
                   , Line [(0, -15), (0, 15)]
                   ]
               ]
             else Blank

    -- Gun rendering with better appearance
    gunPic g = Translate x y $ Pictures
      [ color (dark blue) (circleSolid 10)
      , color (light blue) (circleSolid 7)
      , color (makeColor 0.3 0.3 0.4 1) (circle 10)
      , color white (circleSolid 2)
      ]
      where (xD,yD) = gpos g
            x = realToFrac xD
            y = realToFrac yD

    -- Range indicators (semi-transparent circles)
    ranges = Pictures $ map (\ng ->
      let (gx,gy) = gpos ng
      in Translate (realToFrac gx) (realToFrac gy) $
        Pictures [ color (makeColor 0.2 0.5 1 0.05) (circleSolid (realToFrac (range ng)))
                 , color (makeColor 0.3 0.6 1 0.3) (circle (realToFrac (range ng)))
                 ]) gs

    gunsPic = Pictures $ map gunPic gs

    -- Muzzle flash effects
    muzzleFlashes = Pictures $ map drawFlash flashes
      where
        drawFlash (gid, _) =
          case filter (\g -> gunId g == gid) gs of
            (g:_) -> let (gx, gy) = gpos g
                         x = realToFrac gx
                         y = realToFrac gy
                     in Translate x y $ Pictures
                       [ color (makeColor 1 0.9 0.3 0.8) (circleSolid 12)
                       , color (makeColor 1 0.7 0 0.6) (circleSolid 8)
                       , color yellow (circleSolid 4)
                       ]
            [] -> Blank

    -- Bullet rendering (yellow/orange projectiles)
    bulletPic bullet = Translate x y $ Pictures
      [ color yellow (circleSolid 3)
      , color orange (circle 3)
      , color (makeColor 1 1 0.8 0.5) (circleSolid 5)  -- Glow effect
      ]
      where (xD, yD) = bulletPos bullet
            x = realToFrac xD
            y = realToFrac yD

    bulletsPic = Pictures $ map bulletPic bs

    -- Enemy rendering (size and color based on health)
    enemyPic e = Translate x y $ Pictures
      [ color (makeColor 0.8 0 0 0.3) (circleSolid (realToFrac $ 8 + health e / 4))  -- Outer glow
      , color (makeColor 0.9 0.1 0.1 1) (circleSolid (realToFrac $ 5 + health e / 5))
      , color (makeColor 1 0.3 0 1) (circle (realToFrac $ 5 + health e / 5))
      , color (makeColor 1 0.5 0.2 1) (circleSolid 2)  -- Center highlight
      ]
      where (xD,yD) = pos e
            x = realToFrac xD
            y = realToFrac yD

    enemiesPic = Pictures $ map enemyPic es

    -- HUD for combat phase
    hud = Pictures
      [ Translate (-480) 280 $ scale 0.15 0.15 $ color white $ Text $ "Round: " ++ show (currentRound s)
      , Translate (-480) 260 $ scale 0.15 0.15 $ color yellow $ Text $ "Points: $" ++ show (points s)
      , Translate (-480) 240 $ scale 0.15 0.15 $ color red $ Text $ "Lives: " ++ show (lives s)
      , if gamePhase s == CombatPhase
          then Translate (-480) 220 $ scale 0.12 0.12 $ color green $ Text $ "Enemies: " ++ show (length es) ++ "/" ++ show (enemiesToSpawnThisRound s)
          else Blank
      ]

    -- Shop UI
    shopUI = Pictures
      [ -- Background panel
        Translate 200 0 $ color (makeColor 0.1 0.1 0.15 0.95) $ rectangleSolid 600 600
        -- Title
      , Translate 50 280 $ scale 0.25 0.25 $ color (makeColor 1 0.9 0.4 1) $ Text "GUN SHOP"
      , Translate (-50) 250 $ scale 0.12 0.12 $ color (makeColor 0.7 0.9 1 1) $ Text "Click gun -> Click battlefield to place"
      , Translate (-50) 230 $ scale 0.12 0.12 $ color (makeColor 0.4 1 0.6 1) $ Text "Press SPACE to start round"
        -- Gun buttons
      , Pictures $ zipWith drawGunButton [0..] availableGuns
        -- Algorithm upgrade button
      , drawAlgorithmUpgrade
        -- Instructions
      , Translate (-80) (-260) $ scale 0.08 0.08 $ color (greyN 0.6) $ Text "Grid snapping enabled for precise placement"
      ]

    drawAlgorithmUpgrade =
      let yPos = -190
          isUnlocked = targetingAlgorithm s == HungarianOptimal
          canAfford = points s >= algorithmUpgradeCost
          btnColor = if isUnlocked
                       then makeColor 0.15 0.5 0.15 0.9  -- Green if unlocked
                       else if canAfford
                         then makeColor 0.5 0.35 0.05 0.9  -- Gold if affordable
                         else makeColor 0.35 0.15 0.15 0.7  -- Dark red if too expensive
          borderColor = if isUnlocked
                          then makeColor 0.3 0.8 0.3 1
                          else if canAfford
                            then makeColor 0.9 0.7 0.2 1
                            else makeColor 0.6 0.3 0.3 1
      in Pictures
        [ -- Button background
          Translate 200 yPos $ color btnColor $ rectangleSolid 540 75
          -- Button border
        , Translate 200 yPos $ color borderColor $ rectangleWire 540 75
          -- Title
        , Translate (-30) (yPos + 18) $ scale 0.16 0.16 $ color white $ Text $
            if isUnlocked
              then "Hungarian Algorithm - ACTIVE"
              else "Hungarian Targeting Upgrade"
          -- Description
        , Translate (-30) (yPos - 5) $ scale 0.09 0.09 $ color yellow $ Text $
            if isUnlocked
              then "Optimal assignment enabled"
              else "$" ++ show algorithmUpgradeCost
        , Translate (-30) (yPos - 20) $ scale 0.07 0.07 $ color (greyN 0.7) $ Text $
            if isUnlocked
              then "Your guns use optimal targeting strategy"
              else "Optimizes gun-enemy matching for efficiency"
        ]

    drawGunButton idx template =
      let yPos = 180 - fromIntegral idx * 85
          affordable = canAffordGun template s
          isSelected = case selectedGun s of
            Just t -> templateName t == templateName template
            Nothing -> False
          btnColor = if isSelected
                       then makeColor 0.3 0.6 0.9 1  -- Blue if selected
                       else if affordable
                         then makeColor 0.15 0.35 0.15 0.9  -- Dark green if affordable
                         else makeColor 0.35 0.15 0.15 0.7  -- Dark red if not affordable
          borderColor = if isSelected
                          then makeColor 0.5 0.8 1 1
                          else if affordable
                            then makeColor 0.3 0.6 0.3 1
                            else makeColor 0.6 0.3 0.3 1
      in Pictures
        [ -- Button background
          Translate 200 yPos $ color btnColor $ rectangleSolid 540 75
          -- Button border
        , Translate 200 yPos $ color borderColor $ rectangleWire 540 75
          -- Gun name
        , Translate (-30) (yPos + 18) $ scale 0.18 0.18 $ color white $ Text $ templateName template
          -- Stats
        , Translate (-30) (yPos - 5) $ scale 0.1 0.1 $ color yellow $ Text $
            "$" ++ show (templateCost template) ++ " "
        , Translate 60 (yPos - 5) $ scale 0.08 0.08 $ color (makeColor 0.7 0.9 1 1) $ Text $
            "Range:" ++ show (round $ templateRange template :: Int)
        , Translate (-30) (yPos - 20) $ scale 0.08 0.08 $ color (makeColor 1 0.7 0.7 1) $ Text $
            "Dmg:" ++ show (round $ templateDamage template :: Int) ++
            "  CD:" ++ show (templateCooldown template) ++ "s"
        ]

    -- Game over screen
    gameOverScreen = Pictures
      [ color (makeColor 0 0 0 0.7) $ rectangleSolid 1000 600
      , Translate (-150) 50 $ scale 0.3 0.3 $ color red $ Text "GAME OVER"
      , Translate (-180) 0 $ scale 0.15 0.15 $ color white $ Text $ "Final Round: " ++ show (currentRound s)
      , Translate (-180) (-30) $ scale 0.15 0.15 $ color yellow $ Text $ "Final Score: $" ++ show (points s)
      , Translate (-150) (-80) $ scale 0.12 0.12 $ color green $ Text "Press Q to quit"
      ]

-- | Handle Gloss events
handleEventGloss :: Event -> SimulationState -> SimulationState
-- Track mouse movement
handleEventGloss (EventMotion (x, y)) s = s { mousePosition = (x, y) }
-- Space key: start round if in shop phase, otherwise toggle pause
handleEventGloss (EventKey (SpecialKey KeySpace) Down _ _) s
  | gamePhase s == ShopPhase = startNextRound s
  | gamePhase s == CombatPhase = s { simPaused = not (simPaused s) }
  | otherwise = s

-- Mouse click handling
handleEventGloss (EventKey (MouseButton LeftButton) Down _ (x, y)) s
  | gamePhase s == ShopPhase =
      case selectedGun s of
        Nothing -> selectGunFromShop x y s  -- No gun selected, try to select from shop
        Just template -> placeGunOnField template x y s  -- Gun selected, try to place it
  | otherwise = s

-- Quit on 'q'
handleEventGloss (EventKey (Char 'q') Down _ _) s = s

-- Ignore other events
handleEventGloss _ s = s

-- | Check if click is on a gun shop button and select it
selectGunFromShop :: Float -> Float -> SimulationState -> SimulationState
selectGunFromShop x y s
  | x >= -70 && x <= 470 = checkButtons  -- Updated to new shop panel x range
  | otherwise = s
  where
    checkButtons =
      -- First check algorithm upgrade button
      let algoYPos = -190
          algoYMin = algoYPos - 37
          algoYMax = algoYPos + 37
      in if y >= algoYMin && y <= algoYMax
           then tryUnlockAlgorithm
           else checkGunButtons 0 availableGuns

    tryUnlockAlgorithm =
      if targetingAlgorithm s == GreedyNearest && points s >= algorithmUpgradeCost
        then unlockAdvancedAlgorithm s
        else s

    checkGunButtons _ [] = s
    checkGunButtons idx (template:rest) =
      let yPos = 180 - fromIntegral idx * 85  -- Updated for new layout
          yMin = yPos - 37
          yMax = yPos + 37
      in if y >= yMin && y <= yMax && canAffordGun template s
           then s { selectedGun = Just template }
           else checkGunButtons (idx + 1) rest

-- | Place selected gun on the battlefield
placeGunOnField :: GunTemplate -> Float -> Float -> SimulationState -> SimulationState
placeGunOnField template x y s =
  let -- Snap to grid (40 pixel grid)
      snapX = fromIntegral (round (x / 40) :: Int) * 40
      snapY = fromIntegral (round (y / 40) :: Int) * 40
      -- Check if snapped position is within battlefield bounds
      inBounds = abs snapX <= 450 && abs snapY <= 270
  in if inBounds
       then let newState = addGunAtPosition template (realToFrac snapX, realToFrac snapY) s
            in newState { selectedGun = Nothing }  -- Clear selection after placing
       else s
