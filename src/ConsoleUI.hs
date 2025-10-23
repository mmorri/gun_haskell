module ConsoleUI (runConsole) where

import Game (SimulationState(..), initSimulation, stepSimulation)
import Gun (Gun(..))
import Enemy (Enemy(..))
import System.IO
import Control.Concurrent (threadDelay)
import System.Console.ANSI
import Data.List (intercalate)

-- | Run a simple console loop for the simulation.
runConsole :: [Gun] -> [Enemy] -> IO ()
runConsole guns enemies = do
  hSetBuffering stdin NoBuffering
  hSetEcho stdin False
  let state = initSimulation guns enemies
  loop state
  where
    loop s = do
      clearScreen
      setCursorPosition 0 0
      draw s
      -- non-blocking input
      inputAvailable <- hReady stdin
      s' <- if inputAvailable then handleKey s else return s
      let s'' = stepSimulation 0.1 s'
      threadDelay (100 * 1000) -- 100ms tick
      loop s''

    handleKey s = do
      c <- getChar
      case c of
        ' ' -> return s { simPaused = not (simPaused s) }
        'n' -> do
          let nextId = case simEnemies s of
                         [] -> 1000
                         (x:_) -> enemyId x + 1
              newE = Enemy nextId (-200, 0) 8 30 (30, 0)
          return s { simEnemies = newE : simEnemies s }
        'q' -> do
          clearScreen
          setCursorPosition 0 0
          putStrLn "Exiting."
          -- restore echo before exiting
          hSetEcho stdin True
          hSetBuffering stdin LineBuffering
          -- terminate program
          ioError (userError "quit")
        _ -> return s

    draw s = do
      putStrLn $ "Time: " ++ show (simTime s) ++ (if simPaused s then " [PAUSED]" else "")
      putStrLn "Guns:"
      mapM_ printGun (simGuns s)
      putStrLn "Enemies:"
      mapM_ printEnemy (simEnemies s)
      putStrLn "Commands: Space=pause, n=spawn, q=quit"

    printGun g = putStrLn $ concat ["Gun ", show (gunId g), "  pos=", show (gpos g), "  cd=", show (currentCd g), "  range=", show (range g)]
    printEnemy e = putStrLn $ concat ["E ", show (enemyId e), " pos=", show (pos e), " hp=", show (health e)]
