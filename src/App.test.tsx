import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function openConversation() {
  fireEvent.click(screen.getByRole('button', { name: '打开对话' }))
}

function fillRequest(goal = '完成正式 MVP', answer = '我有两个半小时，优先跑通完整流程。') {
  fireEvent.change(screen.getByRole('textbox', { name: '今天想推进什么' }), { target: { value: goal } })
  fireEvent.change(screen.getByRole('textbox', { name: '补充你的安排' }), { target: { value: answer } })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.resetAllMocks()
})

describe('production Hermes MVP interface', () => {
  test('renders the approved Today timeline and expands one task inline', () => {
    render(<App />)

    expect(screen.getByText(/今天 · /)).toBeTruthy()
    expect(screen.getByRole('button', { name: '打开对话' })).toBeTruthy()

    const task = screen.getByRole('button', { name: /梳理页面结构/ })
    expect(screen.queryByText('确定首页、对话和计划预览的演示顺序。')).toBeNull()
    fireEvent.click(task)
    expect(screen.getByText('确定首页、对话和计划预览的演示顺序。')).toBeTruthy()
    expect(task.getAttribute('aria-expanded')).toBe('true')
  })

  test('opens a dedicated conversation with two multiline textareas', () => {
    render(<App />)
    openConversation()

    expect(screen.getByRole('heading', { name: '对话' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '返回今天' })).toBeTruthy()
    const [goal, answer] = screen.getAllByRole('textbox')
    expect(goal).toBeInstanceOf(HTMLTextAreaElement)
    expect(answer).toBeInstanceOf(HTMLTextAreaElement)
  })

  test('submits multiline text at the 4000-character limit', async () => {
    const goal = `${'g'.repeat(3998)}\nq`
    const answer = `${'a'.repeat(3998)}\nz`
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    render(<App />)
    openConversation()
    fillRequest(goal, answer)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledWith({ goal, answers: [answer] }))
  })

  test('clears a valid composer submission while sending its original snapshot to Hermes', () => {
    const response = deferred<Plan>()
    const goal = '完成正式 MVP'
    const answer = '下午两点前完成验证，并保留三十分钟回归测试。'
    mockedRequestPlan.mockReturnValueOnce(response.promise)
    render(<App />)
    openConversation()
    fillRequest(goal, answer)

    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect((screen.getByRole('textbox', { name: '补充你的安排' }) as HTMLTextAreaElement).value).toBe('')
    expect(mockedRequestPlan).toHaveBeenCalledWith({ goal, answers: [answer] })
    expect(screen.getByText(answer)).toBeTruthy()
  })

  test.each([
    ['empty goal', '', '有可用时间', '请先填写今天想推进什么。'],
    ['blank answer', '修复登录流程', '   ', '请补充你的可用时间或目标成果。'],
    ['long goal', 'x'.repeat(4001), '有可用时间', '目标过长，请控制在 4000 字符以内。'],
    ['long answer', '修复登录流程', 'x'.repeat(4001), '补充内容过长，请控制在 4000 字符以内。'],
  ])('validates %s before requesting Hermes', async (_caseName, goal, answer, message) => {
    render(<App />)
    openConversation()
    fillRequest(goal, answer)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(mockedRequestPlan).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox', { name: '补充你的安排' }) as HTMLTextAreaElement).value).toBe(answer)
  })

  test('auto-grows both long-text fields and caps scrolling at 160px', () => {
    render(<App />)
    openConversation()
    const [goal, answer] = screen.getAllByRole('textbox') as HTMLTextAreaElement[]

    for (const textarea of [goal, answer]) {
      Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 96 })
      fireEvent.input(textarea, { target: { value: '第一行\n第二行' } })
      expect(textarea.style.height).toBe('96px')

      Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 240 })
      fireEvent.input(textarea, { target: { value: '长'.repeat(4000) } })
      expect(textarea.style.height).toBe('160px')
      expect(textarea.style.overflowY).toBe('auto')
    }
  })

  test('keeps generation and the returned preview inside the conversation', async () => {
    const response = deferred<Plan>()
    mockedRequestPlan.mockReturnValueOnce(response.promise)
    render(<App />)
    openConversation()
    fillRequest()
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(screen.getByText('正在整理你的计划…')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('已等待 0 秒')
    expect(screen.getByRole('heading', { name: '对话' })).toBeTruthy()
    expect(mockedRequestPlan).toHaveBeenCalledOnce()

    response.resolve(generatedPlan)
    await waitFor(() => expect(screen.getByText('计划预览')).toBeTruthy())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText(generatedPlan.title)).toBeTruthy()
    expect(screen.getAllByTestId('preview-step')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: '对话' })).toBeTruthy()
  })

  test('shows an increasing elapsed wait time only while Hermes is generating', async () => {
    vi.useFakeTimers()
    try {
      const response = deferred<Plan>()
      mockedRequestPlan.mockReturnValueOnce(response.promise)
      render(<App />)
      openConversation()
      fillRequest()
      fireEvent.click(screen.getByRole('button', { name: '发送' }))

      expect(screen.getByRole('status').textContent).toContain('已等待 0 秒')
      act(() => { vi.advanceTimersByTime(2_000) })
      expect(screen.getByRole('status').textContent).toContain('已等待 2 秒')
      act(() => { vi.advanceTimersByTime(89_000) })
      expect(screen.getByRole('status').textContent).toContain('比通常的 30–90 秒更久')

      await act(async () => { response.resolve(generatedPlan) })
      expect(screen.queryByRole('status')).toBeNull()
      act(() => { vi.advanceTimersByTime(2_000) })
      expect(screen.queryByRole('status')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  test('preserves input after an error and permits retry', async () => {
    mockedRequestPlan.mockRejectedValueOnce(new Error('Hermes 响应超时，请稍后重试。')).mockResolvedValueOnce(generatedPlan)
    render(<App />)
    openConversation()
    fillRequest('完成联调', '保留两个小时')
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('Hermes 响应超时，请稍后重试。')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect((screen.getByRole('textbox', { name: '今天想推进什么' }) as HTMLTextAreaElement).value).toBe('完成联调')
    expect((screen.getByRole('textbox', { name: '补充你的安排' }) as HTMLTextAreaElement).value).toBe('保留两个小时')

    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(mockedRequestPlan).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('计划预览')).toBeTruthy())
  })

  test('does not start a second Hermes request from repeated sends', () => {
    const response = deferred<Plan>()
    mockedRequestPlan.mockReturnValueOnce(response.promise)
    render(<App />)
    openConversation()
    fillRequest()
    const send = screen.getByRole('button', { name: '发送' })

    fireEvent.click(send)
    fireEvent.click(send)

    expect(mockedRequestPlan).toHaveBeenCalledOnce()
  })

  test('saves the real generated plan to Today and restores it after remount', async () => {
    mockedRequestPlan.mockResolvedValueOnce(generatedPlan)
    const view = render(<App />)
    openConversation()
    fillRequest()
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => expect(screen.getByText('计划预览')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '保存并回到今天' }))
    expect(screen.getByText(generatedPlan.title)).toBeTruthy()
    expect(screen.getByText('锁定演示路径')).toBeTruthy()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(generatedPlan))

    view.unmount()
    render(<App />)
    expect(screen.getByText('移动端走查并发布')).toBeTruthy()
  })
})
