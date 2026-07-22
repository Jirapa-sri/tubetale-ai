import { useEffect, useRef, useState } from 'react'
import {
  extractVideoId,
  fetchVideoMetadata,
  formatDuration,
} from './utils/youtube'
import WatchSession from './components/WatchSession'
import InterviewChat from './components/InterviewChat'
import FinalSynthesis from './components/FinalSynthesis'
import { readUploadedVideoMetadata } from './utils/localVideo'
import {
  buildInterviewSystemPrompt,
  translateChatMessages,
  translateText,
} from './utils/openai'
import { useSettings } from './context/SettingsContext'
import { MODEL } from './utils/openai'
import './App.css'

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=Mzw2ttJD2qQ'

function App() {
  const { tr, theme, lang, setTheme, setLang } = useSettings()
  const [sourceMode, setSourceMode] = useState('youtube')
  const [youtubeUrl, setYoutubeUrl] = useState(TEST_VIDEO_URL)
  const [uploadFile, setUploadFile] = useState(null)
  const [metadata, setMetadata] = useState(null)
  const [visualEvaluation, setVisualEvaluation] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [finalReport, setFinalReport] = useState('')
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState('')
  const [translateNonce, setTranslateNonce] = useState(0)
  // Tracks which language the current AI outputs are written in.
  const aiContentLangRef = useRef(lang)
  const contentSnapshotRef = useRef({
    visualEvaluation,
    finalReport,
    chatMessages,
    metadata,
  })
  contentSnapshotRef.current = {
    visualEvaluation,
    finalReport,
    chatMessages,
    metadata,
  }

  useEffect(() => {
    return () => {
      if (metadata?.objectUrl) {
        URL.revokeObjectURL(metadata.objectUrl)
      }
    }
  }, [metadata?.objectUrl])

  // When language changes (or retry), translate existing AI outputs.
  useEffect(() => {
    const snapshot = contentSnapshotRef.current
    const hasContent =
      Boolean(snapshot.visualEvaluation) ||
      Boolean(snapshot.finalReport) ||
      snapshot.chatMessages.some(
        (m) => m.role === 'user' || m.role === 'assistant',
      )

    if (!hasContent) {
      aiContentLangRef.current = lang
      return
    }

    if (aiContentLangRef.current === lang) return

    let cancelled = false
    const targetLang = lang
    const {
      visualEvaluation: evalText,
      finalReport: reportText,
      chatMessages: chat,
      metadata: meta,
    } = snapshot

    async function runTranslate() {
      setTranslating(true)
      setError('')
      try {
        const [nextEval, nextReport, nextChat] = await Promise.all([
          evalText ? translateText(evalText, targetLang) : Promise.resolve(''),
          reportText
            ? translateText(reportText, targetLang)
            : Promise.resolve(''),
          translateChatMessages(chat, targetLang),
        ])

        if (cancelled) return

        const withSystem = nextChat.map((message) => {
          if (message.role !== 'system') return message
          return {
            role: 'system',
            content: buildInterviewSystemPrompt(
              meta,
              nextEval || evalText,
              targetLang,
            ),
          }
        })

        if (nextEval) setVisualEvaluation(nextEval)
        if (nextReport) setFinalReport(nextReport)
        if (chat.length) setChatMessages(withSystem)
        aiContentLangRef.current = targetLang
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `${tr('translateFailed')} (${err.message})`
              : tr('translateFailed'),
          )
        }
      } finally {
        if (!cancelled) setTranslating(false)
      }
    }

    runTranslate()
    return () => {
      cancelled = true
    }
  }, [lang, translateNonce])

  function resetDownstream() {
    setVisualEvaluation('')
    setChatMessages([])
    setFinalReport('')
    aiContentLangRef.current = lang
  }

  function handleLanguageClick(nextLang) {
    if (nextLang === lang) {
      // Same button again → force re-translate (e.g. after a failed attempt).
      aiContentLangRef.current = null
      setTranslateNonce((n) => n + 1)
      return
    }
    setLang(nextLang)
  }

  async function handleFetchMetadata(event) {
    event.preventDefault()
    setError('')
    if (metadata?.objectUrl) {
      URL.revokeObjectURL(metadata.objectUrl)
    }
    setMetadata(null)
    resetDownstream()

    const videoId = extractVideoId(youtubeUrl)
    if (!videoId) {
      setError(tr('invalidYoutube'))
      return
    }

    setLoading(true)
    try {
      const data = await fetchVideoMetadata(youtubeUrl.trim())
      setMetadata({ ...data, source: 'youtube' })
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('metadataFailed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUseUpload(event) {
    event.preventDefault()
    setError('')
    if (!uploadFile) {
      setError(tr('needVideoFile'))
      return
    }

    if (metadata?.objectUrl) {
      URL.revokeObjectURL(metadata.objectUrl)
    }
    setMetadata(null)
    resetDownstream()

    setLoading(true)
    try {
      const data = await readUploadedVideoMetadata(uploadFile)
      setMetadata(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('uploadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="top-controls" role="toolbar" aria-label="Display settings">
        <div className="control-group theme-toggle" role="group" aria-label="Theme">
          <button
            type="button"
            className={`chip-btn ${theme === 'day' ? 'active' : ''}`}
            onClick={() => setTheme('day')}
            aria-pressed={theme === 'day'}
          >
            {tr('themeDay')}
          </button>
          <button
            type="button"
            className={`chip-btn ${theme === 'night' ? 'active' : ''}`}
            onClick={() => setTheme('night')}
            aria-pressed={theme === 'night'}
          >
            {tr('themeNight')}
          </button>
        </div>
        <div className="control-group">
          <button
            type="button"
            className={`chip-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => handleLanguageClick('en')}
            disabled={translating}
          >
            {tr('langEn')}
          </button>
          <button
            type="button"
            className={`chip-btn ${lang === 'th' ? 'active' : ''}`}
            onClick={() => handleLanguageClick('th')}
            disabled={translating}
          >
            {tr('langTh')}
          </button>
        </div>
      </div>

      {translating && (
        <p className="muted translating-banner">{tr('translatingResults')}</p>
      )}

      <header className="app-header">
        <h1 className="brand-title">{tr('headline')}</h1>
        <p className="lede">{tr('lede')}</p>
      </header>

      <div className="source-tabs" role="tablist" aria-label="Video source">
        <button
          type="button"
          role="tab"
          aria-selected={sourceMode === 'youtube'}
          className={`chip-btn ${sourceMode === 'youtube' ? 'active' : ''}`}
          onClick={() => setSourceMode('youtube')}
        >
          {tr('sourceYouTube')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sourceMode === 'upload'}
          className={`chip-btn ${sourceMode === 'upload' ? 'active' : ''}`}
          onClick={() => setSourceMode('upload')}
        >
          {tr('sourceUpload')}
        </button>
      </div>

      {sourceMode === 'youtube' ? (
        <form className="url-form" onSubmit={handleFetchMetadata}>
          <label htmlFor="youtube-url">{tr('youtubeUrl')}</label>
          <div className="url-row">
            <input
              id="youtube-url"
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              autoComplete="off"
            />
            <button type="submit" disabled={loading}>
              {loading ? tr('fetching') : tr('fetchMetadata')}
            </button>
          </div>
        </form>
      ) : (
        <form className="url-form" onSubmit={handleUseUpload}>
          <label htmlFor="video-upload">{tr('uploadLabel')}</label>
          <p className="muted upload-hint">{tr('uploadHint')}</p>
          <div className="url-row">
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <button type="submit" disabled={loading || !uploadFile}>
              {loading ? tr('loadingUpload') : tr('useUploadedVideo')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {metadata && (
        <>
          <section className="metadata-panel" aria-live="polite">
            <h2>{tr('videoMetadata')}</h2>

            <dl className="meta-grid">
              <div>
                <dt>{tr('title')}</dt>
                <dd>{metadata.title}</dd>
              </div>
              <div>
                <dt>{tr('duration')}</dt>
                <dd>
                  {metadata.duration_seconds} {tr('seconds')} (
                  {formatDuration(metadata.duration_seconds)})
                </dd>
              </div>
              <div>
                <dt>{tr('source')}</dt>
                <dd>
                  {metadata.source === 'upload'
                    ? tr('uploadedLocal')
                    : 'YouTube'}
                </dd>
              </div>
              {metadata.source !== 'upload' && (
                <div>
                  <dt>{tr('videoId')}</dt>
                  <dd>
                    <code>{metadata.video_id}</code>
                  </dd>
                </div>
              )}
            </dl>

            <div className="meta-block">
              <h3>{tr('description')}</h3>
              <pre className="scroll-box">
                {metadata.description || tr('empty')}
              </pre>
            </div>

            <div className="meta-block">
              <h3>{tr('transcript')}</h3>
              <pre className="scroll-box transcript">
                {metadata.source === 'upload'
                  ? tr('noTranscriptUpload')
                  : metadata.transcript || tr('empty')}
              </pre>
            </div>
          </section>

          <WatchSession
            metadata={metadata}
            evaluation={visualEvaluation}
            onEvaluationComplete={(text) => {
              setVisualEvaluation(text)
              if (text) {
                aiContentLangRef.current = lang
              } else {
                setChatMessages([])
                setFinalReport('')
                aiContentLangRef.current = lang
              }
            }}
          />

          <InterviewChat
            metadata={metadata}
            visualEvaluation={visualEvaluation}
            messages={chatMessages}
            onMessagesChange={(next) => {
              setChatMessages(next)
              if (
                Array.isArray(next) &&
                next.some((m) => m.role === 'user' || m.role === 'assistant')
              ) {
                aiContentLangRef.current = lang
              }
            }}
          />

          <FinalSynthesis
            metadata={metadata}
            visualEvaluation={visualEvaluation}
            chatMessages={chatMessages}
            report={finalReport}
            onReportComplete={({ report }) => {
              setFinalReport(report)
              if (report) aiContentLangRef.current = lang
            }}
          />
        </>
      )}

      <footer className="app-footer">
        <p>
          AI model: <code>{MODEL}</code> · Max webcam frames: 20
        </p>
      </footer>
    </div>
  )
}

export default App
