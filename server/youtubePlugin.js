import { fetchYouTubeMetadata } from './youtubeMetadata.js'

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw)
}

/**
 * Vite plugin: GET/POST /api/youtube-metadata
 * Query/body: { url: string }
 */
export function youtubeMetadataPlugin() {
  return {
    name: 'youtube-metadata-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname !== '/api/youtube-metadata') {
          next()
          return
        }

        try {
          let videoUrl = url.searchParams.get('url') || ''

          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            videoUrl = body.url || videoUrl
          } else if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }

          if (!videoUrl) {
            sendJson(res, 400, { error: 'Missing url parameter' })
            return
          }

          const metadata = await fetchYouTubeMetadata(videoUrl)
          sendJson(res, 200, metadata)
        } catch (err) {
          sendJson(res, 500, {
            error: err instanceof Error ? err.message : 'Metadata fetch failed',
          })
        }
      })
    },
  }
}
