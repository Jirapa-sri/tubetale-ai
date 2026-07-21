import { useEffect, useState } from 'react'

export function usePlayerClock(player) {
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    if (!player) return undefined

    const id = window.setInterval(() => {
      try {
        const t = player.getCurrentTime?.()
        if (typeof t === 'number' && !Number.isNaN(t)) {
          setCurrentTime(t)
        }
      } catch {
        // Player may be destroyed mid-interval.
      }
    }, 250)

    return () => window.clearInterval(id)
  }, [player])

  return currentTime
}
