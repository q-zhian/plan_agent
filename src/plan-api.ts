import { isPlan, type Plan } from './plan-state'

export type PlanRequest = {
  goal: string
  answers: string[]
}

export class PlanRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanRequestError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function requestPlan(request: PlanRequest): Promise<Plan> {
  let response: Response

  try {
    response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new PlanRequestError('网络连接失败，请检查后重试。')
  }

  const payload = await parseJson(response)

  if (!response.ok) {
    const error = isRecord(payload) && typeof payload.error === 'string' ? payload.error.trim() : ''
    throw new PlanRequestError(error || '生成计划失败，请稍后重试。')
  }

  if (!isRecord(payload) || !isPlan(payload.plan)) {
    throw new PlanRequestError('Hermes 返回的计划格式无效，请重试。')
  }

  return payload.plan
}
