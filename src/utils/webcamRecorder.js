/**
 * Record the live webcam MediaStream while the user watches.
 */

function pickMimeType() {
  // Prefer video-only codecs — webcam stream has no audio track.
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Delay revoke so the browser can start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * @param {MediaStream} stream
 */
export function createWebcamRecorder(stream) {
  if (!stream) {
    throw new Error('No webcam stream to record')
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record webcam video (MediaRecorder missing).')
  }

  const mimeType = pickMimeType()
  let recorder = null
  let chunks = []
  let started = false

  function start() {
    if (recorder && recorder.state !== 'inactive') return

    const tracks = stream.getVideoTracks()
    if (!tracks.length || tracks.some((t) => t.readyState !== 'live')) {
      throw new Error('Webcam stream is not active')
    }

    chunks = []
    const options = { videoBitsPerSecond: 2_500_000 }
    if (mimeType) options.mimeType = mimeType

    try {
      recorder = new MediaRecorder(stream, options)
    } catch {
      recorder = new MediaRecorder(stream)
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data)
    }
    recorder.start(500)
    started = true
  }

  function pause() {
    try {
      if (recorder?.state === 'recording' && typeof recorder.pause === 'function') {
        recorder.pause()
      }
    } catch {
      // Some browsers lack pause; keep recording instead.
    }
  }

  function resume() {
    try {
      if (recorder?.state === 'paused' && typeof recorder.resume === 'function') {
        recorder.resume()
        return
      }
    } catch {
      // fall through to restart
    }
    if (!started || !recorder || recorder.state === 'inactive') {
      start()
    }
  }

  function hasFootage() {
    return started && Boolean(recorder) && recorder.state !== 'inactive'
  }

  async function stop() {
    if (!recorder || recorder.state === 'inactive') {
      throw new Error(
        'Webcam has not recorded yet. Play the video with the camera on first.',
      )
    }

    const activeRecorder = recorder

    // Flush the latest data before stopping.
    try {
      if (typeof activeRecorder.requestData === 'function' && activeRecorder.state === 'recording') {
        activeRecorder.requestData()
      }
    } catch {
      // ignore
    }

    const blob = await new Promise((resolve, reject) => {
      const finish = () => {
        if (!chunks.length) {
          reject(
            new Error(
              'Recording was empty. Play the video with the camera on, then save.',
            ),
          )
          return
        }
        const type =
          activeRecorder.mimeType || mimeType || chunks[0]?.type || 'video/webm'
        resolve(new Blob(chunks, { type }))
      }

      activeRecorder.onstop = finish
      activeRecorder.onerror = () =>
        reject(new Error('Webcam recording failed'))

      try {
        if (
          activeRecorder.state === 'paused' &&
          typeof activeRecorder.resume === 'function'
        ) {
          activeRecorder.resume()
        }
        if (activeRecorder.state !== 'inactive') {
          activeRecorder.stop()
        } else {
          finish()
        }
      } catch (err) {
        reject(
          err instanceof Error ? err : new Error('Could not stop recording'),
        )
      }
    })

    recorder = null
    started = false
    chunks = []
    return blob
  }

  return {
    start,
    pause,
    resume,
    stop,
    hasFootage,
    async stopAndDownload(filename = 'tubetale-webcam.webm') {
      const blob = await stop()
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const name = filename.replace(/\.(webm|mp4)$/i, '') + `.${ext}`
      downloadBlob(blob, name)
      return blob
    },
    isRecording: () =>
      Boolean(
        recorder &&
          (recorder.state === 'recording' || recorder.state === 'paused'),
      ),
    isActivelyRecording: () => recorder?.state === 'recording',
    isPaused: () => recorder?.state === 'paused',
  }
}
