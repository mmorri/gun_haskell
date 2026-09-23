module ConsoleUI (runConsole) where

import Control.Concurrent (threadDelay)
import Enemy (Enemy(..), EnemyType(..))
import Game (SimulationState(..), gamePhase, initSimulation, startNextRound, stepSimulation)
import Gun (Gun(..))
import System.Console.ANSI
import System.IO

-- | Run a simple console loop for the simulation.
runConsole :: [Gun] -> [Enemy] -> IO ()
runConsole guns enemies = do
  hSetBuffering stdin NoBuffering
  hSetEcho stdin False
  let state = startNextRound (initSimulation guns enemies)
  loop state
  where
    loop s = do
      clearScreen
      setCursorPosition 0 0
      draw s
      inputAvailable <- hReady stdin
      s' <- if inputAvailable then handleKey s else return s
      let s'' = stepSimulation 0.1 s'
      threadDelay (100 * 1000)
      loop s''

    handleKey s = do
      c <- getChar
      case c of
        ' ' -> return s {simPaused = not (simPaused s)}
        'n' -> do
          let spawnPos = case mapPath s of
                (p:_) -> p
                [] -> (-400, 0)
              newE = Enemy (nextEnemyId s) spawnPos 10 10 70 8 0 Swarm 1
          return s {simEnemies = newE : simEnemies s, nextEnemyId = nextEnemyId s + 1}
        'q' -> do
          clearScreen
          setCursorPosition 0 0
          putStrLn "Exiting."
          hSetEcho stdin True
          hSetBuffering stdin LineBuffering
          ioError (userError "quit")
        _ -> return s

    draw s = do
      putStrLn $ "Time: " ++ show (simTime s) ++ if simPaused s then " [PAUSED]" else ""
      putStrLn $ "Phase: " ++ show (gamePhase s)
      putStrLn "Guns:"
      mapM_ printGun (simGuns s)
      putStrLn "Enemies:"
      mapM_ printEnemy (simEnemies s)
      putStrLn "Commands: Space=pause, n=spawn, q=quit"

    printGun g =
      putStrLn $
        concat
          [ "Gun "
          , show (gunId g)
          , " lvl="
          , show (gunLevel g)
          , " pos="
          , show (gpos g)
          , " cd="
          , show (currentCd g)
          , " range="
          , show (range g)
          ]

    printEnemy e =
      putStrLn $
        concat
          [ "E "
          , show (enemyId e)
          , " "
          , show (enemyType e)
          , " pos="
          , show (pos e)
          , " hp="
          , show (health e)
          ]
