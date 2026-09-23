module Enemy
  ( Enemy(..)
  , EnemyType(..)
  , moveEnemyAlongPath
  , enemyReachedGoal
  , distance
  ) where

-- | Enemy archetypes used by wave generation.
data EnemyType
  = Swarm
  | Runner
  | Brute
  deriving (Show, Eq)

-- | Represents an enemy moving along a waypoint path.
data Enemy = Enemy
  { enemyId :: Int
  , pos :: (Double, Double)
  , health :: Double
  , maxHealth :: Double
  , speed :: Double
  , reward :: Int
  , armor :: Double
  , enemyType :: EnemyType
  , targetWaypoint :: Int
  } deriving (Show, Eq)

-- | Euclidean distance between two points.
distance :: (Double, Double) -> (Double, Double) -> Double
distance (x1, y1) (x2, y2) = sqrt ((x1 - x2) ^ (2 :: Int) + (y1 - y2) ^ (2 :: Int))

-- | Move enemy toward the next waypoint on the path.
moveEnemyAlongPath :: Double -> [(Double, Double)] -> Enemy -> Enemy
moveEnemyAlongPath _ [] e = e
moveEnemyAlongPath dt path e
  | targetWaypoint e >= length path = e
  | otherwise =
      let (x, y) = pos e
          (tx, ty) = path !! targetWaypoint e
          dx = tx - x
          dy = ty - y
          distToTarget = sqrt (dx * dx + dy * dy)
          stepDist = speed e * dt
      in if distToTarget <= 1e-6 || stepDist >= distToTarget
           then e
             { pos = (tx, ty)
             , targetWaypoint = targetWaypoint e + 1
             }
           else
             let nx = x + (dx / distToTarget) * stepDist
                 ny = y + (dy / distToTarget) * stepDist
             in e { pos = (nx, ny) }

-- | Enemy has completed the full path and reached the base.
enemyReachedGoal :: [(Double, Double)] -> Enemy -> Bool
enemyReachedGoal path e = targetWaypoint e >= length path
