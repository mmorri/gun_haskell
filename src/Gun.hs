module Gun (Gun(..), distanceToEnemy, canShoot, tickCooldown, fireAt) where

import Enemy (Enemy(..), pos)

-- | Simple Euclidean distance between two 2D points
distance :: (Double, Double) -> (Double, Double) -> Double
distance (x1,y1) (x2,y2) = sqrt ((x1-x2)^(2::Int) + (y1-y2)^(2::Int))

-- | A sentry gun with a fixed position and parameters.
data Gun = Gun
  { gunId         :: Int
  , gpos          :: (Double, Double)
  , range         :: Double
  , cooldownTime  :: Double  -- total cooldown after firing
  , currentCd     :: Double  -- current cooldown remaining (<=0 means ready)
  , damagePerShot :: Double
  } deriving (Show, Eq)

distanceToEnemy :: Gun -> Enemy -> Double
distanceToEnemy g e = distance (gpos g) (pos e)

canShoot :: Gun -> Enemy -> Bool
canShoot g e = distanceToEnemy g e <= range g && currentCd g <= 0

-- | Advance the gun's cooldown by dt (reduce time remaining)
tickCooldown :: Double -> Gun -> Gun
tickCooldown dt g = g { currentCd = currentCd g - dt }

-- | Fire at an enemy: returns new gun (with cooldown set) and enemy after damage
fireAt :: Gun -> Enemy -> (Gun, Enemy)
fireAt g e = (g { currentCd = cooldownTime g }, e { health = health e - damagePerShot g })
