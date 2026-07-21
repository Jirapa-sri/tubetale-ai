/**
 * Read duration + basic metadata from an uploaded File.
 */
export function readUploadedVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration || 0)
      const title = file.name.replace(/\.[^/.]+$/, '') || file.name
      cleanup()
      resolve({
        video_id: `upload-${Date.now()}`,
        title,
        duration_seconds: duration,
        description: `Uploaded local file: ${file.name}`,
        transcript:
          '(No transcript for uploaded videos. Description uses the file name.)',
        source: 'upload',
        objectUrl: url,
        fileName: file.name,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      cleanup()
      reject(new Error('Could not read the uploaded video.'))
    }
  })
}
