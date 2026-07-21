import { useState } from 'react'
import { synthesizeFinalReport } from '../utils/openai'
import { useSettings } from '../context/SettingsContext'

export default function FinalSynthesis({
  metadata,
  visualEvaluation,
  chatMessages,
  report,
  onReportComplete,
}) {
  const { tr, lang } = useSettings()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canEnd =
    Boolean(visualEvaluation) &&
    (chatMessages || []).some((m) => m.role === 'user' || m.role === 'assistant')

  async function handleEndChat() {
    setError('')
    setBusy(true)
    try {
      const { prompt, report: text } = await synthesizeFinalReport(
        metadata,
        visualEvaluation,
        chatMessages,
        lang,
      )
      onReportComplete?.({ prompt, report: text })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Final synthesis failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="synthesis-panel">
      <div className="section-heading">
        <h2>{tr('finalSynthesis')}</h2>
        <p>{tr('finalSynthesisHelp')}</p>
      </div>

      <button
        type="button"
        className="primary-btn"
        onClick={handleEndChat}
        disabled={busy || !canEnd}
      >
        {busy ? tr('writingReport') : tr('endChat')}
      </button>

      {!canEnd && <p className="muted hint">{tr('endChatHint')}</p>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {report && (
        <article className="final-report">
          <h3>{tr('sentimentReport')}</h3>
          <div className="final-report-body">{report}</div>
        </article>
      )}
    </section>
  )
}
