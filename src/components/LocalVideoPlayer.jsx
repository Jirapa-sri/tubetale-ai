import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

/**
 * HTML5 video player for uploaded local files.
 */
const LocalVideoPlayer = forwardRef(function LocalVideoPlayer(
  { src, onReady, onPlayingChange },
  ref,
) {
  const videoRef = useRef(null)
  const onReadyRef = useRef(onReady)
  const onPlayingChangeRef = useRef(onPlayingChange)

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
  }))

  useEffect(() => {
    onReadyRef.current = onReady
    onPlayingChangeRef.current = onPlayingChange
  }, [onReady, onPlayingChange])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !src) return undefined

    const playerApi = {
      getCurrentTime: () => el.currentTime || 0,
      getDuration: () => el.duration || 0,
      pause: () => el.pause(),
      play: () => el.play(),
    }

    const handleLoaded = () => onReadyRef.current?.(playerApi)
    const handlePlay = () => onPlayingChangeRef.current?.(true)
    const handlePause = () => onPlayingChangeRef.current?.(false)
    const handleEnded = () => onPlayingChangeRef.current?.(false)

    el.addEventListener('loadedmetadata', handleLoaded)
    el.addEventListener('play', handlePlay)
    el.addEventListener('pause', handlePause)
    el.addEventListener('ended', handleEnded)

    if (el.readyState >= 1) handleLoaded()

    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('pause', handlePause)
      el.removeEventListener('ended', handleEnded)
    }
  }, [src])

  return (
    <div className="yt-shell local-video-shell">
      <video
        ref={videoRef}
        className="local-video"
        src={src}
        controls
        playsInline
      />
    </div>
  )
})

export default LocalVideoPlayer
