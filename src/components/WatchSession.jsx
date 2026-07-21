import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import YouTubePlayer from './YouTubePlayer'
import LocalVideoPlayer from './LocalVideoPlayer'
import { usePlayerClock } from '../hooks/usePlayerClock'
import WebcamCapture from './WebcamCapture'
import VisualEvaluationResult from './VisualEvaluationResult'
import { evaluateVisualReactions, MAX_FRAMES } from '../utils/openai'
import { createWebcamRecorder } from '../utils/webcamRecorder'
import { useSettings } from '../context/SettingsContext'

const YT_PLAYING = 1

export default function WatchSession({
  metadata,
  evaluation,
  onEvaluationComplete,
}) {
  const { tr, lang } = useSettings()
  const [player, setPlayer] = useState(null)
  const [capturing, setCapturing] = useState(false)
  const [frames, setFrames] = useState([])
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')
  const [sessionStarted, setSessionStarted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [savingWebcam, setSavingWebcam] = useState(false)
  const [webcamRecording, setWebcamRecording] = useState(false)
  const [canSaveWebcam, setCanSaveWebcam] = useState(false)

  const recorderRef = useRef(null)
  const liveStreamRef = useRef(null)
  const [streamEpoch, setStreamEpoch] = useState(0)
  const isUpload = metadata?.source === 'upload'
  const videoTimeSeconds = usePlayerClock(player)

  const captureIntervalSeconds = useMemo(() => {
    const duration = Number(metadata?.duration_seconds) || 0
    if (duration <= 0) return 5
    return Math.max(duration / MAX_FRAMES, 1)
  }, [metadata?.duration_seconds])

  useEffect(() => {
    setSessionStarted(false)
    setPlayer(null)
    setFrames([])
    setCapturing(false)
    setCameraOn(true)
    setWebcamRecording(false)
    setCanSaveWebcam(false)
    setStreamEpoch(0)
    recorderRef.current = null
    liveStreamRef.current = null
  }, [metadata?.video_id, metadata?.objectUrl])

  const handleStreamChange = useCallback((stream) => {
    liveStreamRef.current = stream
    // Only drop the recorder when the stream is gone (camera off).
    if (!stream) {
      recorderRef.current = null
      setWebcamRecording(false)
      setCanSaveWebcam(false)
    }
    setStreamEpoch((n) => n + 1)
  }, [])

  // Start webcam recording when the video plays; pause when it pauses.
  useEffect(() => {
    const stream = liveStreamRef.current
    if (!cameraOn || !stream) {
      setWebcamRecording(false)
      return
    }

    if (capturing) {
      try {
        if (!recorderRef.current) {
          const recorder = createWebcamRecorder(stream)
          recorder.start()
          recorderRef.current = recorder
        } else if (recorderRef.current.isPaused?.()) {
          recorderRef.current.resume()
        } else if (!recorderRef.current.isRecording?.()) {
          recorderRef.current.start()
        }
        setWebcamRecording(true)
        setCanSaveWebcam(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record webcam')
        setWebcamRecording(false)
      }
    } else if (recorderRef.current?.isActivelyRecording?.()) {
      recorderRef.current.pause()
      setWebcamRecording(false)
      // Keep canSaveWebcam true so the user can download after pausing.
    }
  }, [capturing, cameraOn, streamEpoch])

  const handlePlayerReady = useCallback((ytPlayer) => {
    setPlayer(ytPlayer)
  }, [])

  const handleStateChange = useCallback((event) => {
    setCapturing(event.data === YT_PLAYING)
  }, [])

  const handleLocalPlayingChange = useCallback((isPlaying) => {
    setCapturing(isPlaying)
  }, [])

  const handleStartSession = () => {
    setError('')
    setFrames([])
    setSessionStarted(true)
    setCameraOn(true)
    onEvaluationComplete?.('')
  }

  const handleResetFrames = () => {
    setFrames([])
    setError('')
    onEvaluationComplete?.('')
  }

  async function handleEvaluate() {
    setError('')
    setEvaluating(true)
    try {
      const text = await evaluateVisualReactions(frames, metadata, lang)
      onEvaluationComplete?.(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Visual evaluation failed')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleSaveWebcamVideo() {
    setError('')
    const recorder = recorderRef.current
    if (!recorder?.hasFootage?.() && !recorder?.isRecording?.()) {
      setError(tr('webcamNotRecording'))
      return
    }
    setSavingWebcam(true)
    try {
      const safeTitle = (metadata?.title || 'webcam')
        .replace(/[^\w-]+/g, '_')
        .slice(0, 40)
      await recorder.stopAndDownload(`tubetale-webcam-${safeTitle}.webm`)
      setWebcamRecording(false)
      setCanSaveWebcam(false)
      recorderRef.current = null
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save webcam video')
    } finally {
      setSavingWebcam(false)
    }
  }

  return (
    <section className="watch-session">
      <div className="section-heading">
        <h2>{tr('visualEvaluation')}</h2>
        <p>{tr('visualEvaluationHelp', { max: MAX_FRAMES })}</p>
      </div>

      {!sessionStarted ? (
        <button type="button" className="primary-btn" onClick={handleStartSession}>
          {tr('startWatchSession')}
        </button>
      ) : (
        <>
          <div className="stage stage-side-by-side">
            <div className="stage-player">
              <h3>{tr('video')}</h3>
              {isUpload ? (
                <LocalVideoPlayer
                  src={metadata.objectUrl}
                  onReady={handlePlayerReady}
                  onPlayingChange={handleLocalPlayingChange}
                />
              ) : (
                <YouTubePlayer
                  videoId={metadata.video_id}
                  onReady={handlePlayerReady}
                  onStateChange={handleStateChange}
                />
              )}
            </div>

            <aside className="stage-webcam">
              <h3>{tr('webcam')}</h3>
              <WebcamCapture
                capturing={capturing}
                videoTimeSeconds={videoTimeSeconds}
                captureIntervalSeconds={captureIntervalSeconds}
                frames={frames}
                onFramesChange={setFrames}
                cameraOn={cameraOn}
                onCameraOnChange={setCameraOn}
                onStreamChange={handleStreamChange}
              />
              <div className="stage-webcam-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleSaveWebcamVideo}
                  disabled={savingWebcam || !canSaveWebcam}
                >
                  {savingWebcam ? tr('savingWebcam') : tr('saveWebcamVideo')}
                </button>
                {webcamRecording ? (
                  <p className="status-text recording">{tr('webcamRecording')}</p>
                ) : canSaveWebcam ? (
                  <p className="status-text">{tr('webcamPausedReady')}</p>
                ) : null}
              </div>
              <p className="muted stage-note">{tr('saveHintWebcam')}</p>
            </aside>
          </div>

          <div className="watch-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={handleEvaluate}
              disabled={evaluating || frames.length === 0}
            >
              {evaluating
                ? tr('analyzingReactions')
                : `${tr('runVisualEvaluation')} (${frames.length}/${MAX_FRAMES})`}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleResetFrames}
              disabled={evaluating}
            >
              {tr('clearFrames')}
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {evaluation && (
        <VisualEvaluationResult evaluation={evaluation} frames={frames} />
      )}
    </section>
  )
}
