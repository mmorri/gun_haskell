module Assets
  ( Assets(..)
  , loadAssets
  ) where

import Data.Maybe (fromMaybe)
import Graphics.Gloss (Picture(..))
import Graphics.Gloss.Juicy (loadJuicyPNG)

-- | Kenney (CC0) sprites used by the game. See assets/kenney/License-CC0-Kenney.txt.
-- All sprites face up in the source files.
data Assets = Assets
  { aPewBase :: Picture
  , aPewBarrel :: Picture
  , aNannyBase :: Picture
  , aNannyBarrel :: Picture
  , aBrrrt :: Picture
  , aYeet :: Picture
  , aSwarm :: Picture
  , aRunner :: Picture
  , aBrute :: Picture
  , aBullet :: Picture
  , aBulletHeavy :: Picture
  , aFlame :: Picture
  , aPortal :: Picture
  , aCrystal :: Picture
  }

assetDir :: FilePath
assetDir = "assets/kenney/"

-- | Load all sprites. Returns (missing files, assets); missing ones become Blank.
loadAssets :: IO ([FilePath], Assets)
loadAssets = do
  let files =
        [ "towerDefense_tile228.png" -- pew base
        , "towerDefense_tile292.png" -- pew barrel
        , "towerDefense_tile229.png" -- nanny base
        , "towerDefense_tile291.png" -- nanny barrel
        , "towerDefense_tile204.png" -- brrrt (twin guns)
        , "towerDefense_tile205.png" -- yeet (twin rockets)
        , "towerDefense_tile245.png" -- zoomie (green robot)
        , "towerDefense_tile247.png" -- espresso goblin (orange robot)
        , "towerDefense_tile250.png" -- chungus (red tank)
        , "towerDefense_tile272.png" -- bullet
        , "towerDefense_tile274.png" -- heavy bullet
        , "towerDefense_tile296.png" -- muzzle flame
        , "towerDefense_tile133.png" -- gremlin-hole portal
        , "towerDefense_tile180.png" -- base crystal
        ]
  loaded <- mapM (loadJuicyPNG . (assetDir ++)) files
  let paths = map (assetDir ++) files
      missing = [p | (p, Nothing) <- zip paths loaded]
      pics = map (fromMaybe Blank) loaded
      [pPewB, pPewBar, pNanB, pNanBar, pBrrrt, pYeet, pSwarm, pRunner, pBrute, pBul, pBulH, pFlame, pPortal, pCrystal] = pics
  return
    ( missing
    , Assets pPewB pPewBar pNanB pNanBar pBrrrt pYeet pSwarm pRunner pBrute pBul pBulH pFlame pPortal pCrystal
    )
