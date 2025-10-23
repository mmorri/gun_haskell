module Enemy (Enemy(..), moveEnemy) where

-- | Represents an enemy target in the world.
data Enemy = Enemy
  { enemyId :: Int
  , pos     :: (Double, Double)  -- (x,y)
  , health  :: Double
  , speed   :: Double             -- magnitude used by velocity
  , vel     :: (Double, Double)   -- (vx,vy)
  } deriving (Show, Eq)

-- | Move enemy by its velocity scaled by dt
moveEnemy :: Double -> Enemy -> Enemy
moveEnemy dt e = e { pos = (x + vx * dt, y + vy * dt) }
  where
    (x,y) = pos e
    (vx,vy) = vel e
