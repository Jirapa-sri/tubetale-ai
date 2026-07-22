import { useEffect, useRef, useState } from 'react'
import {
  buildInterviewSystemPrompt,
  sendInterviewChat,
} from '../utils/openai'
import { useSettings } from '../context/SettingsContext'
import {
  downloadTextFile,
  formatInterviewTranscript,
  safeFilenamePart,
} from '../utils/download'

export default function InterviewChat({
  metadata,
  visualEvaluation,
  messages,
  onMessagesChange,
}) {
  const { tr, lang } = useSettings()
  const [started, setStarted] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  const visibleMessages = messages.filter((m) => m.role !== 'system')
  const canDownloadInterview = visibleMessages.length > 0

  useEffect(() => {
    if (messages.some((m) => m.role === 'assistant')) {
      setStarted(true)
    } else if (!visualEvaluation) {
      setStarted(false)
    }
  }, [metadata?.video_id, visualEvaluation, messages])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, busy])

  async function startInterview() {
    setError('')
    setBusy(true)
    try {
      const systemPrompt = buildInterviewSystemPrompt(
        metadata,
        visualEvaluation,
        lang,
      )
      const seed = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            lang === 'th'
              ? 'กรุณาเริ่มสัมภาษณ์ด้วยคำถามแรกได้เลย'
              : 'Please start the interview now with your first question.',
        },
      ]
      const reply = await sendInterviewChat(seed)
      const next = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: reply },
      ]
      onMessagesChange(next)
      setStarted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start interview')
    } finally {
      setBusy(false)
    }
  }

  async function handleSend(event) {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return

    setError('')
    setInput('')

    // Keep the system prompt aligned with the current UI language.
    const systemPrompt = buildInterviewSystemPrompt(
      metadata,
      visualEvaluation,
      lang,
    )
    const withoutSystem = messages.filter((m) => m.role !== 'system')
    const nextMessages = [
      { role: 'system', content: systemPrompt },
      ...withoutSystem,
      { role: 'user', content: text },
    ]
    onMessagesChange(nextMessages)
    setBusy(true)

    try {
      const reply = await sendInterviewChat(nextMessages)
      onMessagesChange([
        ...nextMessages,
        { role: 'assistant', content: reply },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat request failed')
    } finally {
      setBusy(false)
    }
  }

  function handleDownloadInterview() {
    const title = safeFilenamePart(metadata?.title, 'interview')
    const body = [
      'TubeTale AI — Interview',
      `Video: ${metadata?.title || '(unknown)'}`,
      `Language: ${lang}`,
      '',
      formatInterviewTranscript(visibleMessages, {
        interviewer: tr('interviewerRole'),
        you: tr('you'),
      }),
    ].join('\n')
    downloadTextFile(`tubetale-interview-${title}.txt`, body)
  }

  return (
    <section className="interview-panel">
      <div className="section-heading">
        <h2>{tr('interviewer')}</h2>
        <p>{tr('interviewerHelp')}</p>
      </div>

      {!started ? (
        <button
          type="button"
          className="primary-btn"
          onClick={startInterview}
          disabled={busy || !visualEvaluation}
        >
          {busy ? tr('startingInterview') : tr('startInterview')}
        </button>
      ) : (
        <>
          <div className="chat-log" ref={listRef} aria-live="polite">
            {visibleMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`chat-bubble ${message.role}`}
              >
                <span className="chat-role">
                  {message.role === 'assistant'
                    ? tr('interviewerRole')
                    : tr('you')}
                </span>
                <p>{message.content}</p>
              </div>
            ))}
            {busy && (
              <div className="chat-bubble assistant pending">
                <span className="chat-role">{tr('interviewerRole')}</span>
                <p>{tr('thinking')}</p>
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={handleSend}>
            <label htmlFor="interview-input" className="sr-only">
              {tr('yourReply')}
            </label>
            <input
              id="interview-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr('typeAnswer')}
              disabled={busy}
              autoComplete="off"
            />
            <button
              type="submit"
              className="primary-btn"
              disabled={busy || !input.trim()}
            >
              {tr('send')}
            </button>
          </form>

          <div className="download-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleDownloadInterview}
              disabled={!canDownloadInterview || busy}
            >
              {tr('downloadInterview')}
            </button>
          </div>
        </>
      )}

      {!visualEvaluation && (
        <p className="muted hint">{tr('interviewHint')}</p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
