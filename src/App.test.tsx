import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { App } from './App'
import { requestPlan } from './plan-api'
import { STORAGE_KEY, type Plan } from './plan-state'

vi.mock('./plan-api', () => ({ requestPlan: vi.fn() }))

const mockedRequestPlan = vi.mocked(requestPlan)

const generatedPlan: Plan = {
  title: '下午完成 MVP 展示网页',
  totalDuration: '2 小时 30 分钟',
  startTime: '13:30',
  endTime: '16:00',
  tasks: [
    { title: '锁定演示路径', startTime: '13:30', endTime: '13:50', description: '确定关键画面。', estimatedDuration: '20 分钟' },
    { title: '完成首屏结构', startTime: '13:50', endTime: '14:30', description: '排好今日计划。', estimatedDuration: '40 分钟' },
    { title: '接通计划演示', startTime: '14:30', endTime: '15:15', description: '串起生成和保存。', estimatedDuration: '45 分钟' },
    { title: '移动端走查并发布', startTime: '15:15', endTime: '16:00', description: '检查并发布。', estimatedDuration: '45 分钟' },
  ],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function openChat() {
  fireEvent.click(screen.getByRole('button', { name: '新建计划' }))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.resetAllMocks()
})

describe('planning assistant demo', () => {
  test('renders the goal and supplementary answer as multiline textareas', () => {
    render(<App />)

    openChat()
    const [goal, answer] = screen.getAllByRole('textbox')

    expect(goal).toBeInstanceOf(HTMLTextAreaElement)
    expect(answer).toBeInstanceOf(HTMLTextAreaElement)
  })

  test('submits multiline text at the 4000-character limit', async () => {
    const goal = `${'g'.repeat(3998)}\nq`
    const answer = `${'a'.repeat(3998)}\nz`
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    render(<App />)

    openChat()
    const [goalInput, answerInput] = screen.getAllByRole('textbox')
    fireEvent.change(goalInput, { target: { value: goal } })
    fireEvent.change(answerInput, { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledOnce())
    const [request] = mockedRequestPlan.mock.calls[0]
    expect(request.goal).toHaveLength(4000)
    expect(request.answers[0]).toHaveLength(4000)
    expect(request.goal).toContain('\n')
    expect(request.answers[0]).toContain('\n')
  })

  test('submits 2000 emoji at the 4000 UTF-16 code unit limit', async () => {
    const goal = '\u{1F600}'.repeat(2000)
    const answer = '\u{1F603}'.repeat(2000)
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    render(<App />)

    openChat()
    const [goalInput, answerInput] = screen.getAllByRole('textbox')
    fireEvent.change(goalInput, { target: { value: goal } })
    fireEvent.change(answerInput, { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledWith({ goal, answers: [answer] }))
  })

  test.each([
    ['empty goal', ['', '有可用时间'], '请先填写今天想推进什么。'],
    ['whitespace-only goal', ['   ', '有可用时间'], '请先填写今天想推进什么。'],
    ['blank answer', ['修复登录流程', '   '], '请补充你的可用时间或目标成果。'],
    ['a goal longer than 4000 characters', ['x'.repeat(4001), '有可用时间'], '目标过长，请控制在 4000 字符以内。'],
    ['a goal with 2001 emoji', ['😀'.repeat(2001), '有可用时间'], '目标过长，请控制在 4000 字符以内。'],
    ['an answer longer than 4000 characters', ['修复登录流程', 'x'.repeat(4001)], '补充内容过长，请控制在 4000 字符以内。'],
    ['an answer with 2001 emoji', ['\u4fee\u590d\u767b\u5f55\u6d41\u7a0b', '\u{1F600}'.repeat(2001)], '\u8865\u5145\u5185\u5bb9\u8fc7\u957f\uff0c\u8bf7\u63a7\u5236\u5728 4000 \u5b57\u7b26\u4ee5\u5185\u3002'],
  ])('shows a client validation error for %s without starting generation', async (_caseName, [goal, answer], error) => {
    render(<App />)

    openChat()
    const [goalInput, answerInput] = screen.getAllByRole('textbox')
    fireEvent.change(goalInput, { target: { value: goal } })
    fireEvent.change(answerInput, { target: { value: answer } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    expect(await screen.findByText(error, { exact: true })).toBeTruthy()
    expect(mockedRequestPlan).not.toHaveBeenCalled()
    expect(screen.queryByText(/正在整理你的下午安排/)).toBeNull()
  })

  test('moves to the thinking view and starts only one generation while the request is in flight', () => {
    const response = deferred<Plan>()
    mockedRequestPlan.mockReturnValueOnce(response.promise)
    render(<App />)

    openChat()
    const [, answerInput] = screen.getAllByRole('textbox')
    fireEvent.change(answerInput, { target: { value: '有可用时间' } })
    fireEvent.click(screen.getByRole('button', { name: /发送/ }))

    expect(screen.getByText(/正在整理你的下午安排/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /发送/ })).toBeNull()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(mockedRequestPlan).toHaveBeenCalledOnce()
    response.resolve(generatedPlan)
  })

  test('grows a textarea to its content height and caps scrolling at 160px', () => {
    render(<App />)

    openChat()
    const [goalInput, answerInput] = screen.getAllByRole('textbox')
    Object.defineProperty(goalInput, 'scrollHeight', { configurable: true, value: 96 })
    fireEvent.input(goalInput, { target: { value: '第一行\n第二行' } })
    expect((goalInput as HTMLTextAreaElement).style.height).toBe('96px')

    Object.defineProperty(goalInput, 'scrollHeight', { configurable: true, value: 240 })
    fireEvent.input(goalInput, { target: { value: '长'.repeat(4000) } })
    expect((goalInput as HTMLTextAreaElement).style.height).toBe('160px')
    expect((goalInput as HTMLTextAreaElement).style.overflowY).toBe('auto')

    Object.defineProperty(answerInput, 'scrollHeight', { configurable: true, value: 96 })
    fireEvent.input(answerInput, { target: { value: '第一行\n第二行' } })
    expect((answerInput as HTMLTextAreaElement).style.height).toBe('96px')

    Object.defineProperty(answerInput, 'scrollHeight', { configurable: true, value: 240 })
    fireEvent.input(answerInput, { target: { value: '长'.repeat(4000) } })
    expect((answerInput as HTMLTextAreaElement).style.height).toBe('160px')
    expect((answerInput as HTMLTextAreaElement).style.overflowY).toBe('auto')
  })

  test('submits a quick answer, shows thinking, previews the returned plan, and saves it home', async () => {
    const response = deferred<Plan>()
    mockedRequestPlan.mockReturnValueOnce(response.promise)
    render(<App />)

    openChat()
    expect((screen.getByRole('textbox', { name: '今天想推进什么' }) as HTMLInputElement).value).toBe('今天下午我要把 MVP 的展示网页做出来，但还没想好怎么安排。')
    fireEvent.change(screen.getByRole('textbox', { name: '今天想推进什么' }), { target: { value: '完成发布前的 MVP 演示' } })
    fireEvent.click(screen.getByRole('button', { name: '下午 3 小时，做出可演示版本' }))

    expect(screen.getByText('正在整理你的下午安排')).toBeTruthy()
    expect(mockedRequestPlan).toHaveBeenCalledOnce()
    expect(mockedRequestPlan).toHaveBeenCalledWith({ goal: '完成发布前的 MVP 演示', answers: ['下午 3 小时，做出可演示版本'] })

    response.resolve(generatedPlan)
    await waitFor(() => expect(screen.getByRole('heading', { name: '计划预览' })).toBeTruthy())
    expect(screen.getByText(generatedPlan.title)).toBeTruthy()
    expect(screen.getAllByTestId('preview-step')).toHaveLength(4)

    fireEvent.click(screen.getByRole('button', { name: '保存到今天计划' }))
    expect(screen.getByRole('heading', { name: '今天的计划' })).toBeTruthy()
    expect(screen.getByText('锁定演示路径')).toBeTruthy()
  })

  test('submits the typed answer', async () => {
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    render(<App />)

    openChat()
    fireEvent.change(screen.getByRole('textbox', { name: '补充你的安排' }), { target: { value: '我有两个半小时，首要是能完整点击演示。' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledWith({
      goal: '今天下午我要把 MVP 的展示网页做出来，但还没想好怎么安排。',
      answers: ['我有两个半小时，首要是能完整点击演示。'],
    }))
  })

  test('returns to chat after a request error, preserves values, and permits retry', async () => {
    mockedRequestPlan.mockRejectedValueOnce(new Error('Hermes 响应超时，请稍后重试。')).mockResolvedValueOnce(generatedPlan)
    render(<App />)

    openChat()
    fireEvent.change(screen.getByRole('textbox', { name: '今天想推进什么' }), { target: { value: '完成联调' } })
    fireEvent.change(screen.getByRole('textbox', { name: '补充你的安排' }), { target: { value: '保留两个小时' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(screen.getByText('Hermes 响应超时，请稍后重试。')).toBeTruthy())
    expect((screen.getByRole('textbox', { name: '今天想推进什么' }) as HTMLInputElement).value).toBe('完成联调')
    expect((screen.getByRole('textbox', { name: '补充你的安排' }) as HTMLInputElement).value).toBe('保留两个小时')

    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('heading', { name: '计划预览' })).toBeTruthy())
  })

  test('restores a successfully saved plan from localStorage after remounting', async () => {
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    const view = render(<App />)

    openChat()
    fireEvent.click(screen.getByRole('button', { name: '下午 3 小时，做出可演示版本' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: '计划预览' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '保存到今天计划' }))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(generatedPlan))

    view.unmount()
    render(<App />)
    expect(screen.getByText(generatedPlan.title)).toBeTruthy()
    expect(screen.getByText('移动端走查并发布')).toBeTruthy()
  })
})
