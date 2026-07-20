import { ChangeEvent, FormEvent, useCallback, useRef, useState } from 'react'
import { requestPlan } from './plan-api'
import { initialMvpPlan, loadSavedPlan, savePlanToStorage, type Plan } from './plan-state'
import './styles.css'

type Screen = 'home' | 'chat' | 'thinking' | 'preview'
const MAX_REQUEST_TEXT_LENGTH = 4000

const originalGoal = '今天下午我要把 MVP 的展示网页做出来，但还没想好怎么安排。'
const quickAnswers = ['下午 3 小时，做出可演示版本', '下午 2 小时，先完成首屏', '时间弹性，优先完整流程']

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

function AppHeader({ onBack }: { onBack?: () => void }) {
  return (
    <header className="topbar">
      {onBack ? <button className="back-button" onClick={onBack} aria-label="返回今天计划">←</button> : <span className="day-mark">MON</span>}
      <span className="topbar-title">平静地推进一件事</span>
      <span className="presence"><i /> 在线</span>
    </header>
  )
}

function Home({ plan, onNewPlan }: { plan: Plan; onNewPlan: () => void }) {
  return (
    <section className="screen home-screen">
      <AppHeader />
      <div className="home-heading enter">
        <p className="eyebrow">7 月 20 日 · 星期一</p>
        <h1>今天的计划</h1>
        <p className="supporting">留一点余白，先完成最重要的部分。</p>
      </div>

      <div className="plan-summary enter delay-1">
        <span>{plan.title}</span>
        <b>{plan.totalDuration}</b>
      </div>

      <div className="timeline" aria-label={`${plan.title}时间轴`}>
        {plan.tasks.map((task, index) => (
          <article className="task-row enter" style={{ animationDelay: `${120 + index * 65}ms` }} key={`${task.startTime}-${task.title}`}>
            <time>{task.startTime}</time>
            <div className="rail"><span /></div>
            <div className="task-card">
              <div className="task-card-top"><span>{task.startTime} — {task.endTime}</span><span>{task.estimatedDuration}</span></div>
              <h2>{task.title}</h2>
              <p>{task.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="bottom-action">
        <button className="primary-button" onClick={onNewPlan} aria-label="新建计划">新建计划 <span aria-hidden="true">→</span></button>
      </div>
    </section>
  )
}

type ChatProps = {
  answer: string
  disabled: boolean
  error: string | null
  goal: string
  onAnswerChange: (answer: string) => void
  onBack: () => void
  onGoalChange: (goal: string) => void
  onSubmit: (answer: string) => void
}

function Chat({ answer, disabled, error, goal, onAnswerChange, onBack, onGoalChange, onSubmit }: ChatProps) {
  const resizeTextarea = useAutoGrowingTextarea()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit(answer)
  }

  const textareaProps = (onChange: (value: string) => void) => ({
    ref: resizeTextarea,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
      resizeTextarea(event.currentTarget)
      onChange(event.currentTarget.value)
    },
  })

  return (
    <section className="screen chat-screen">
      <AppHeader onBack={onBack} />
      <div className="chat-heading enter">
        <p className="eyebrow">新建计划</p>
        <h1>把模糊的想法排进今天</h1>
      </div>
      <label className="goal-field" htmlFor="plan-goal">
        今天想推进什么
        <textarea className="goal-input" id="plan-goal" rows={1} value={goal} disabled={disabled} {...textareaProps(onGoalChange)} />
      </label>
      <div className="conversation enter delay-1">
        <div className="bubble user-bubble">{originalGoal}</div>
        <div className="assistant-label">计划助手</div>
        <div className="bubble assistant-bubble">你今天下午能留出多长时间？最重要的是做出哪一项可交付成果？</div>
      </div>
      <div className="answer-area enter delay-2">
        <p>选一个接近的安排，或直接补充：</p>
        {error && <p className="request-error" role="alert">{error}</p>}
        <div className="quick-answers">
          {quickAnswers.map((quickAnswer) => (
            <button key={quickAnswer} onClick={() => onSubmit(quickAnswer)} disabled={disabled}>{quickAnswer}</button>
          ))}
        </div>
      </div>
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="plan-reply">补充你的安排</label>
        <textarea id="plan-reply" aria-label="补充你的安排" rows={1} value={answer} disabled={disabled} placeholder="例如：我有 2 小时，先做完整演示" {...textareaProps(onAnswerChange)} />
        <button type="submit" aria-label="发送" disabled={disabled}>发送</button>
      </form>
    </section>
  )
}

function Thinking() {
  return (
    <section className="screen thinking-screen" aria-live="polite">
      <AppHeader />
      <div className="thinking-content enter">
        <div className="thinking-symbol"><i /><i /><i /></div>
        <p className="eyebrow">正在生成</p>
        <h1>正在整理你的下午安排</h1>
        <p>把最重要的演示路径放在前面。</p>
      </div>
    </section>
  )
}

function Preview({ onSave, onBack, plan }: { onSave: () => void; onBack: () => void; plan: Plan }) {
  return (
    <section className="screen preview-screen">
      <AppHeader onBack={onBack} />
      <div className="preview-heading enter">
        <p className="eyebrow">已为你整理</p>
        <h1>计划预览</h1>
      </div>
      <article className="preview-card enter delay-1">
        <h2>{plan.title}</h2>
        <div className="plan-facts"><span><b>{plan.totalDuration}</b>总时长</span><span><b>{plan.startTime}–{plan.endTime}</b>今天下午</span></div>
      </article>
      <ol className="preview-steps">
        {plan.tasks.map((task, index) => (
          <li className="enter" style={{ animationDelay: `${150 + index * 65}ms` }} data-testid="preview-step" key={task.title}>
            <span className="step-number">0{index + 1}</span>
            <div><time>{task.startTime} — {task.endTime} · {task.estimatedDuration}</time><h2>{task.title}</h2><p>{task.description}</p></div>
          </li>
        ))}
      </ol>
      <div className="bottom-action"><button className="primary-button" onClick={onSave} aria-label="保存到今天计划">保存到今天计划 <span aria-hidden="true">→</span></button></div>
    </section>
  )
}

export function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [plan, setPlan] = useState<Plan>(() => loadSavedPlan() ?? initialMvpPlan)
  const [goal, setGoal] = useState(originalGoal)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [previewPlan, setPreviewPlan] = useState<Plan | null>(null)
  const isGenerating = useRef(false)

  const clearError = () => setError(null)

  const beginGeneration = async (submittedAnswer: string) => {
    if (isGenerating.current) return

    const validationError = validateRequest(goal, submittedAnswer)
    if (validationError) {
      setError(validationError)
      return
    }

    isGenerating.current = true
    setAnswer(submittedAnswer)
    clearError()
    setScreen('thinking')

    try {
      const nextPlan = await requestPlan({ goal, answers: [submittedAnswer] })
      setPreviewPlan(nextPlan)
      setScreen('preview')
    } catch (caughtError) {
      const message = caughtError instanceof Error && caughtError.message ? caughtError.message : '生成计划失败，请稍后重试。'
      setError(message)
      setScreen('chat')
    } finally {
      isGenerating.current = false
    }
  }

  const savePlan = () => {
    if (!previewPlan) return
    savePlanToStorage(previewPlan)
    setPlan(previewPlan)
    setScreen('home')
  }

  return (
    <main className="app-shell">
      <div className="phone-canvas">
        {screen === 'home' && <Home plan={plan} onNewPlan={() => setScreen('chat')} />}
        {screen === 'chat' && <Chat answer={answer} disabled={isGenerating.current} error={error} goal={goal} onAnswerChange={(nextAnswer) => { clearError(); setAnswer(nextAnswer) }} onBack={() => setScreen('home')} onGoalChange={(nextGoal) => { clearError(); setGoal(nextGoal) }} onSubmit={beginGeneration} />}
        {screen === 'thinking' && <Thinking />}
        {screen === 'preview' && previewPlan && <Preview plan={previewPlan} onSave={savePlan} onBack={() => setScreen('chat')} />}
      </div>
    </main>
  )
}
