import { afterEach, describe, expect, test, vi } from 'vitest'
import { PlanRequestError, requestPlan } from './plan-api'
import type { Plan } from './plan-state'

const validPlan: Plan = {
  title: '下午计划',
  totalDuration: '2 小时',
  startTime: '13:00',
  endTime: '15:00',
  tasks: Array.from({ length: 4 }, (_, index) => ({
    title: `实现接口 ${index + 1}`,
    startTime: '13:00',
    endTime: '15:00',
    description: '完成请求处理',
    estimatedDuration: '2 小时',
  })),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPlan', () => {
  test('posts the request JSON to the same-origin plan endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ plan: validPlan }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestPlan({ goal: '完成演示', answers: ['两小时'] })).resolves.toEqual(validPlan)

    expect(fetchMock).toHaveBeenCalledWith('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: '完成演示', answers: ['两小时'] }),
    })
  })

  test('uses the Chinese server error for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: '目标不能为空' }), { status: 400 })))

    await expect(requestPlan({ goal: '', answers: [] })).rejects.toMatchObject({
      name: 'PlanRequestError',
      message: '目标不能为空',
    })
  })

  test('rejects a malformed successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ plan: { title: '不完整' } }), { status: 200 })))

    await expect(requestPlan({ goal: '完成演示', answers: [] })).rejects.toMatchObject({
      name: 'PlanRequestError',
      message: 'Hermes 返回的计划格式无效，请重试。',
    })
  })

  test('rejects a successful response with an extra plan key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      plan: { ...validPlan, unexpected: true },
    }), { status: 200 })))

    await expect(requestPlan({ goal: '完成演示', answers: [] })).rejects.toMatchObject({
      name: 'PlanRequestError',
      message: 'Hermes 返回的计划格式无效，请重试。',
    })
  })

  test('maps network failures to a user-readable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(requestPlan({ goal: '完成演示', answers: [] })).rejects.toBeInstanceOf(PlanRequestError)
    await expect(requestPlan({ goal: '完成演示', answers: [] })).rejects.toMatchObject({
      message: '网络连接失败，请检查后重试。',
    })
  })
})
