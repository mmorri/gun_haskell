module Gun
  ( Gun(..)
  , distanceToEnemy
  , canShoot
  , tickCooldown
  , fireAt
  , upgradeCost
  , canUpgrade
  , upgradeGun
  ) where

import Enemy (Enemy(..), distance, pos)

-- | A sentry gun with a fixed position and upgrade progression.
data Gun = Gun
  { gunId :: Int
  , gunName :: String
  , gpos :: (Double, Double)
  , range :: Double
  , cooldownTime :: Double
  , currentCd :: Double
  , damagePerShot :: Double
  , gunLevel :: Int
  } deriving (Show, Eq)

distanceToEnemy :: Gun -> Enemy -> Double
distanceToEnemy g e = distance (gpos g) (pos e)

canShoot :: Gun -> Enemy -> Bool
canShoot g e = distanceToEnemy g e <= range g && currentCd g <= 0

-- | Advance the gun cooldown by dt.
tickCooldown :: Double -> Gun -> Gun
tickCooldown dt g = g { currentCd = currentCd g - dt }

-- | Fire at an enemy: returns new gun (with cooldown set) and enemy after damage.
fireAt :: Gun -> Enemy -> (Gun, Enemy)
fireAt g e = (g { currentCd = cooldownTime g }, e { health = health e - damagePerShot g })

upgradeCost :: Gun -> Int
upgradeCost g = 40 + (gunLevel g * 35)

canUpgrade :: Gun -> Bool
canUpgrade g = gunLevel g < 3

upgradeGun :: Gun -> Gun
upgradeGun g =
  let lvl = gunLevel g + 1
  in g
    { gunLevel = lvl
    , damagePerShot = damagePerShot g * 1.45
    , range = range g * 1.08
    , cooldownTime = max 0.2 (cooldownTime g * 0.9)
    }
