import { useEffect, useRef } from 'react'

/**
 * Loads the YouTube IFrame API once and creates a player.
 */
export default function YouTubePlayer({ videoId, onReady, onStateChange }) {
  const hostRef = useRef(null)
  const playerRef = useRef(null)
  const onReadyRef = useRef(onReady)
  const onStateChangeRef = useRef(onStateChange)

  useEffect(() => {
    onReadyRef.current = onReady
    onStateChangeRef.current = onStateChange
  }, [onReady, onStateChange])

  useEffect(() => {
    let cancelled = false
    const host = hostRef.current

    function createPlayer() {
      if (cancelled || !hostRef.current || !window.YT?.Player) return

      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }

      hostRef.current.innerHTML = ''
      const target = document.createElement('div')
      hostRef.current.appendChild(target)

      playerRef.current = new window.YT.Player(target, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => onReadyRef.current?.(event.target),
          onStateChange: (event) => onStateChangeRef.current?.(event),
        },
      })
    }

    function ensureApi() {
      if (window.YT?.Player) {
        createPlayer()
        return
      }

      const previous = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        if (!cancelled) createPlayer()
      }

      if (!document.getElementById('youtube-iframe-api')) {
        const script = document.createElement('script')
        script.id = 'youtube-iframe-api'
        script.src = 'https://www.youtube.com/iframe_api'
        document.body.appendChild(script)
      }
    }

    ensureApi()

    return () => {
      cancelled = true
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }
      if (host) host.innerHTML = ''
    }
  }, [videoId])

  return (
    <div className="yt-shell">
      <div ref={hostRef} className="yt-player" />
    </div>
  )
}
