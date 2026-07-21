import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { MAX_FRAMES } from '../utils/openai'
import { useSettings } from '../context/SettingsContext'

/**
 * Side webcam preview + still-frame sampling for visual evaluation.
 * Live stream can also be recorded while watching.
 */
const WebcamCapture = forwardRef(function WebcamCapture(
  {
    capturing,
    videoTimeSeconds,
    captureIntervalSeconds = 5,
    frames,
    onFramesChange,
    cameraOn,
    onCameraOnChange,
    onStreamChange,
  },
  ref,
) {
  const { tr } = useSettings()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const lastCaptureAtRef = useRef(-Infinity)
  const framesRef = useRef(frames)
  const onStreamChangeRef = useRef(onStreamChange)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)

  useEffect(() => {
    onStreamChangeRef.current = onStreamChange
  }, [onStreamChange])

  useImperativeHandle(ref, () => ({
    getVideoElement: () => videoRef.current,
    getStream: () => streamRef.current,
  }))

  useEffect(() => {
    framesRef.current = frames
  }, [frames])

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      setCameraError('')
      setCameraReady(false)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraReady(true)
        onStreamChangeRef.current?.(stream)
      } catch (err) {
        setCameraError(
          err instanceof Error ? err.message : 'Could not access webcam.',
        )
        onCameraOnChange?.(false)
        onStreamChangeRef.current?.(null)
      }
    }

    function stopCamera() {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      setCameraReady(false)
      onStreamChangeRef.current?.(null)
    }

    if (cameraOn) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [cameraOn, onCameraOnChange])

  useEffect(() => {
    if (!cameraOn || !capturing || !cameraReady) return
    if (framesRef.current.length >= MAX_FRAMES) return

    const interval = Math.max(1, Number(captureIntervalSeconds) || 5)
    if (videoTimeSeconds - lastCaptureAtRef.current < interval) return

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.videoWidth === 0) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)

    lastCaptureAtRef.current = videoTimeSeconds
    onFramesChange((prev) => {
      if (prev.length >= MAX_FRAMES) return prev
      return [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          dataUrl,
          timestampSeconds: videoTimeSeconds,
        },
      ]
    })
  }, [
    cameraOn,
    capturing,
    cameraReady,
    videoTimeSeconds,
    captureIntervalSeconds,
    onFramesChange,
  ])

  useEffect(() => {
    if (frames.length === 0) {
      lastCaptureAtRef.current = -Infinity
    }
  }, [frames.length])

  return (
    <div className="webcam-panel webcam-panel-side">
      <div className="webcam-toolbar">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => onCameraOnChange?.(!cameraOn)}
        >
          {cameraOn ? tr('turnCameraOff') : tr('turnCameraOn')}
        </button>
      </div>

      <div className={`webcam-preview ${cameraOn ? '' : 'is-off'}`}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ display: cameraOn ? 'block' : 'none' }}
        />
        {!cameraOn && <p className="webcam-status">{tr('cameraOff')}</p>}
        {cameraOn && !cameraReady && !cameraError && (
          <p className="webcam-status">{tr('startingWebcam')}</p>
        )}
      </div>
      <canvas ref={canvasRef} hidden />

      <div className="webcam-meta">
        <p>
          {tr('framesCaptured')}: <strong>{frames.length}</strong>/{MAX_FRAMES}
        </p>
        {!cameraOn ? (
          <p className="muted">{tr('cameraOff')}</p>
        ) : capturing ? (
          <p className="status-text recording">{tr('capturingReactions')}</p>
        ) : (
          <p className="muted">{tr('playToCapture')}</p>
        )}
        {cameraError && (
          <p className="error" role="alert">
            {cameraError}
          </p>
        )}
      </div>
    </div>
  )
})

export default WebcamCapture
