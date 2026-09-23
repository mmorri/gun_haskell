module Main (main) where

import Graphics.Gloss
import Graphics.Gloss.Interface.Pure.Game
import Game (SimulationState, initSimulation, stepSimulation)
import Render (drawState, handleEventGloss)

window :: Display
window = InWindow "Sentry Gun: Pew-Pew Defense Deluxe" (1000, 600) (100, 100)

background :: Color
background = makeColor 0.07 0.08 0.14 1.0

fps :: Int
fps = 60

main :: IO ()
main = do
  putStrLn "=== Sentry Gun: Pew-Pew Defense Deluxe ==="
  putStrLn "  * Now with 200% more sparkles and 100% more gremlins! *"
  putStrLn ""
  putStrLn "How to Play (brave commander of cardboard boxes):"
  putStrLn "  - SHOP: Left-click to adopt a turret (they bite, lovingly)"
  putStrLn "  - SHOP: Right-click a placed tower to feed it steroids (upgrade)"
  putStrLn "  - Press SPACE to unleash the wave / pause for snacks"
  putStrLn "  - Press T to change targeting gossip (who gets yeeted first?)"
  putStrLn "  - Press R to toggle range disco lights"
  putStrLn "  - Press F to toggle hyper-caffeinated mode (1x/2x)"
  putStrLn "  - Earn cash from kills; stop the Zoomie Gremlins from hugging your base"
  putStrLn ""
  putStrLn "Starting game... pew pew!"

  let initialState = initSimulation [] []

  play window background fps initialState drawState handleEventGloss updateWorld

updateWorld :: Float -> SimulationState -> SimulationState
updateWorld dt = stepSimulation (realToFrac dt)
