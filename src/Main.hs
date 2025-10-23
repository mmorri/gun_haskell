module Main (main) where

import Graphics.Gloss
import Graphics.Gloss.Interface.Pure.Game
import Game (SimulationState, initSimulation, stepSimulation)
import Render (drawState, handleEventGloss)

-- | Window configuration
window :: Display
window = InWindow "Sentry Gun Tower Defense" (1000, 600) (100, 100)

-- | Background color
background :: Color
background = makeColor 0.1 0.1 0.15 1.0

-- | Frames per second
fps :: Int
fps = 60

main :: IO ()
main = do
  putStrLn "=== Sentry Gun Tower Defense ==="
  putStrLn ""
  putStrLn "How to Play:"
  putStrLn "  - SHOP PHASE: Click guns to select, click battlefield to place"
  putStrLn "  - Press SPACE to start the combat round"
  putStrLn "  - COMBAT PHASE: Watch your guns defend against waves of enemies"
  putStrLn "  - Press SPACE to pause/unpause during combat"
  putStrLn "  - Earn points by killing enemies, lose lives when enemies escape"
  putStrLn "  - Each round has more and tougher enemies!"
  putStrLn ""
  putStrLn "Starting game..."

  let initialState = initSimulation [] []

  play window background fps initialState drawState handleEventGloss updateWorld

-- | Update function for Gloss
updateWorld :: Float -> SimulationState -> SimulationState
updateWorld dt = stepSimulation (realToFrac dt)

