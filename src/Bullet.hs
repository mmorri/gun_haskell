module Bullet (Bullet(..), moveBullet, createBullet) where

-- | Represents a bullet in flight
data Bullet = Bullet
  { bulletId :: Int
  , bulletPos :: (Double, Double)
  , bulletVel :: (Double, Double)
  , bulletDamage :: Double
  , bulletSpeed :: Double
  , bulletSourceGunId :: Int
  } deriving (Show, Eq)

-- | Move bullet by its velocity scaled by dt
moveBullet :: Double -> Bullet -> Bullet
moveBullet dt b = b { bulletPos = (x + vx * dt, y + vy * dt) }
  where
    (x, y) = bulletPos b
    (vx, vy) = bulletVel b

-- | Create a bullet from a gun position to a target position
createBullet :: Int -> Int -> (Double, Double) -> (Double, Double) -> Double -> Bullet
createBullet bid gunId gunPos targetPos damage =
  let (gx, gy) = gunPos
      (tx, ty) = targetPos
      dx = tx - gx
      dy = ty - gy
      dist = sqrt (dx * dx + dy * dy)
      speed = 300.0  -- Bullet speed (pixels per second)
      vx = if dist > 0 then (dx / dist) * speed else 0
      vy = if dist > 0 then (dy / dist) * speed else 0
  in Bullet
      { bulletId = bid
      , bulletPos = gunPos
      , bulletVel = (vx, vy)
      , bulletDamage = damage
      , bulletSpeed = speed
      , bulletSourceGunId = gunId
      }
