import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { requestPlan } from './plan-api'
import { initialMvpPlan, loadSavedPlan, savePlanToStorage, type Plan } from './plan-state'
import './styles.css'

type Screen = 'today' | 'conversation'
const MAX_REQUEST_TEXT_LENGTH = 4000
const originalGoal = '今天我想完成一个重要目标，请帮我把它整理成可执行的计划。'

const bubbleIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18.2 3.8 21l3.3-1.1c1.3.7 2.9 1.1 4.9 1.1 4.8 0 8.2-2.8 8.2-7s-3.4-7-8.2-7-8.2 2.8-8.2 7c0 1.5.5 2.9 1.4 4.2Z" /><path d="M8.2 14h7.6" /></svg>
)
const backIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.8 5.8-6.1 6.2 6.1 6.2" /></svg>
const chevronIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 5 5-5 5" /></svg>
const sendIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 16 8-16 8 3.6-8L4 4Z" /><path d="M7.6 12H20" /></svg>

function todayLabel() {
  const date = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`
}

function validateRequest(goal: string, answer: string) {
  const trimmedGoal = goal.trim()
  const trimmedAnswer = answer.trim()
  if (!trimmedGoal) return '请先填写今天想推进什么。'
  if (!trimmedAnswer) return '请补充你的可用时间或目标成果。'
  if (trimmedGoal.length > MAX_REQUEST_TEXT_LENGTH) return '目标过长，请控制在 4000 字符以内。'
  if (trimmedAnswer.length > MAX_REQUEST_TEXT_LENGTH) return '补充内容过长，请控制在 4000 字符以内。'
  return null
}

function useAutoGrowingTextarea() {
  return useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return
    textarea.style.height = 'auto'
    const height = Math.min(Math.max(textarea.scrollHeight, 40), 160)
    textarea.style.height = `${height}px`
    textarea.style.overflowY = textarea.scrollHeight >= 160 ? 'auto' : 'hidden'
  }, [])
}

function Today({ plan, onOpenConversation }: { plan: Plan; onOpenConversation: () => void }) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

  return (
    <section className="screen today-screen">
      <header className="today-header">今天 · {todayLabel()}</header>
      <div className="today-summary">
        <span>{plan.title}</span>
        <span>{plan.totalDuration}</span>
      </div>
      <div className="timeline" aria-label={`${plan.title}时间轴`}>
        {plan.tasks.map((task, index) => {
          const taskId = `${task.startTime}-${task.title}`
          const expanded = expandedTaskId === taskId
          return (
            <article className={`timeline-row${index === 0 ? ' is-current' : ''}`} key={taskId}>
              <time>{task.startTime}</time>
              <div className="timeline-rail"><span className="timeline-node" /></div>
              <div className="task-content">
                <button
                  className="task-trigger"
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedTaskId(expanded ? null : taskId)}
                >
                  <span>{task.title}</span>
                  <span className={`chevron${expanded ? ' is-open' : ''}`}>{chevronIcon}</span>
                </button>
                {expanded && (
                  <div className="task-details">
                    <p>{task.description}</p>
                    <p><strong>时间</strong>{task.startTime} — {task.endTime} · {task.estimatedDuration}</p>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <button className="agent-entry" type="button" onClick={onOpenConversation} aria-label="打开对话">{bubbleIcon}</button>
    </section>
  )
}

type ConversationProps = {
  answer: string
  error: string | null
  elapsedSeconds: number
  goal: string
  isGenerating: boolean
  onAnswerChange: (value: string) => void
  onBack: () => void
  onGoalChange: (value: string) => void
  onSave: () => void
  onSubmit: () => void
  previewPlan: Plan | null
  submittedAnswer: string | null
}

function Conversation({ answer, elapsedSeconds, error, goal, isGenerating, onAnswerChange, onBack, onGoalChange, onSave, onSubmit, previewPlan, submittedAnswer }: ConversationProps) {
  const resizeTextarea = useAutoGrowingTextarea()
  const textareaProps = (onChange: (value: string) => void) => ({
    ref: resizeTextarea,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      resizeTextarea(event.currentTarget)
      onChange(event.currentTarget.value)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <section className="screen conversation-screen">
      <header className="conversation-header">
        <button className="back-button" type="button" onClick={onBack} aria-label="返回今天">{backIcon}</button>
        <h1>对话</h1>
      </header>
      <p className="date-separator">{todayLabel()}</p>

      <div className="messages">
        <div className="message-group agent-group">
          <span className="agent-marker" aria-label="Agent">∴</span>
          <p className="message">告诉我今天最想推进什么，以及你可以投入的时间。我会让 Hermes 把它整理成一份可执行的计划。</p>
        </div>

        <label className="goal-field" htmlFor="plan-goal">
          <span>今天想推进什么</span>
          <textarea id="plan-goal" rows={1} value={goal} disabled={isGenerating} {...textareaProps(onGoalChange)} />
        </label>

        {submittedAnswer && (
          <div className="message-group user-group">
            <p className="message user-message">{submittedAnswer}</p>
          </div>
        )}

        {isGenerating && (
          <div className="message-group agent-group status-message" role="status" aria-live="polite">
            <span className="agent-marker" aria-hidden="true">∴</span>
            <span className="status-activity" aria-hidden="true" />
            <div>
              <p className="message">正在整理你的计划…</p>
              <p className="status-details">
                {elapsedSeconds > 90
                  ? `已等待 ${elapsedSeconds} 秒，比通常的 30–90 秒更久；Hermes 仍在处理中。`
                  : `已等待 ${elapsedSeconds} 秒 · 通常需要约 30–90 秒`}
              </p>
            </div>
          </div>
        )}

        {error && <p className="request-error" role="alert">{error}</p>}

        {previewPlan && (
          <section className="plan-preview" aria-label="计划预览">
            <p className="preview-label">计划预览</p>
            <h2>{previewPlan.title}</h2>
            <p className="preview-facts">{previewPlan.startTime} — {previewPlan.endTime} · {previewPlan.totalDuration}</p>
            <ol className="preview-steps">
              {previewPlan.tasks.map((task) => (
                <li data-testid="preview-step" key={`${task.startTime}-${task.title}`}>
                  <time>{task.startTime}</time>
                  <div><strong>{task.title}</strong><span>{task.description}</span></div>
                </li>
              ))}
            </ol>
            <button className="primary-action" type="button" onClick={onSave}>保存并回到今天</button>
          </section>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="plan-reply">补充你的安排</label>
        <textarea
          id="plan-reply"
          aria-label="补充你的安排"
          rows={1}
          value={answer}
          disabled={isGenerating}
          placeholder="补充可用时间或期望结果"
          {...textareaProps(onAnswerChange)}
        />
        <button type="submit" aria-label="发送" disabled={isGenerating}>{sendIcon}</button>
      </form>
    </section>
  )
}

export function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [plan, setPlan] = useState<Plan>(() => loadSavedPlan() ?? initialMvpPlan)
  const [goal, setGoal] = useState(originalGoal)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null)
  const generationLock = useRef(false)

  const clearError = () => setError(null)

  useEffect(() => {
    if (!isGenerating) return

    const startedAt = Date.now()
    const intervalId = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000))
    }, 1_000)

    return () => window.clearInterval(intervalId)
  }, [isGenerating])

  const beginGeneration = async () => {
    if (generationLock.current) return
    const validationError = validateRequest(goal, answer)
    if (validationError) {
      setError(validationError)
      return
    }

    const goalSnapshot = goal
    const answerSnapshot = answer
    generationLock.current = true
    setIsGenerating(true)
    setElapsedSeconds(0)
    setPreviewPlan(null)
    setSubmittedAnswer(answerSnapshot)
    setAnswer('')
    clearError()

    try {
      setPreviewPlan(await requestPlan({ goal: goalSnapshot, answers: [answerSnapshot] }))
    } catch (caughtError) {
      setAnswer(answerSnapshot)
      setError(caughtError instanceof Error && caughtError.message ? caughtError.message : '生成计划失败，请稍后重试。')
    } finally {
      generationLock.current = false
      setIsGenerating(false)
    }
  }

  const savePlan = () => {
    if (!previewPlan) return
    savePlanToStorage(previewPlan)
    setPlan(previewPlan)
    setScreen('today')
  }

  return (
    <main className="app-shell">
      <div className="phone-canvas">
        {screen === 'today' ? (
          <Today plan={plan} onOpenConversation={() => setScreen('conversation')} />
        ) : (
          <Conversation
            answer={answer}
            elapsedSeconds={elapsedSeconds}
            error={error}
            goal={goal}
            isGenerating={isGenerating}
            onAnswerChange={(value) => { clearError(); setAnswer(value) }}
            onBack={() => setScreen('today')}
            onGoalChange={(value) => { clearError(); setGoal(value) }}
            onSave={savePlan}
            onSubmit={beginGeneration}
            previewPlan={previewPlan}
            submittedAnswer={submittedAnswer}
          />
        )}
      </div>
    </main>
  )
}
