export type PlanTask = {
  title: string
  startTime: string
  endTime: string
  description: string
  estimatedDuration: string
}

export type Plan = {
  title: string
  totalDuration: string
  startTime: string
  endTime: string
  tasks: PlanTask[]
}

export const STORAGE_KEY = 'hermes-local-mvp-plan'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && actualKeys.every((key) => keys.includes(key))
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isTime(value: unknown): value is string {
  return isNonemptyString(value)
    && value.length === 5
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isPlanTask(value: unknown): value is PlanTask {
  return isRecord(value)
    && hasExactKeys(value, ['title', 'startTime', 'endTime', 'description', 'estimatedDuration'])
    && isNonemptyString(value.title)
    && isTime(value.startTime)
    && isTime(value.endTime)
    && isNonemptyString(value.description)
    && isNonemptyString(value.estimatedDuration)
}

export function isPlan(value: unknown): value is Plan {
  return isRecord(value)
    && hasExactKeys(value, ['title', 'totalDuration', 'startTime', 'endTime', 'tasks'])
    && isNonemptyString(value.title)
    && isNonemptyString(value.totalDuration)
    && isTime(value.startTime)
    && isTime(value.endTime)
    && Array.isArray(value.tasks)
    && value.tasks.length >= 4
    && value.tasks.length <= 6
    && value.tasks.every(isPlanTask)
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function savePlanToStorage(plan: Plan): void {
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(plan))
  } catch {
    // Storage may be unavailable or full; keeping the in-memory plan is enough.
  }
}

export function loadSavedPlan(): Plan | null {
  try {
    const savedPlan = getStorage()?.getItem(STORAGE_KEY)
    if (!savedPlan) {
      return null
    }

    const parsedPlan: unknown = JSON.parse(savedPlan)
    return isPlan(parsedPlan) ? parsedPlan : null
  } catch {
    return null
  }
}

export const initialMvpPlan: Plan = {
  title: '今天的计划',
  totalDuration: '5 小时',
  startTime: '13:00',
  endTime: '18:00',
  tasks: [
    {
      title: '梳理页面结构',
      startTime: '13:00',
      endTime: '13:30',
      description: '确定首页、对话和计划预览的演示顺序。',
      estimatedDuration: '30 分钟',
    },
    {
      title: '搭建首屏',
      startTime: '13:30',
      endTime: '14:45',
      description: '完成今日计划的时间轴和新建计划入口。',
      estimatedDuration: '1 小时 15 分钟',
    },
    {
      title: '完成计划流程',
      startTime: '14:45',
      endTime: '16:00',
      description: '串联对话追问、生成预览和保存动作。',
      estimatedDuration: '1 小时 15 分钟',
    },
    {
      title: '移动端检查',
      startTime: '16:00',
      endTime: '16:30',
      description: '检查手机画布上的字号、间距和触控区域。',
      estimatedDuration: '30 分钟',
    },
    {
      title: '发布演示版',
      startTime: '16:30',
      endTime: '18:00',
      description: '整理可直接打开的本地演示版本。',
      estimatedDuration: '1 小时 30 分钟',
    },
  ],
}

export function createPlanState(initialPlan: Plan = initialMvpPlan) {
  let shownPlan = initialPlan

  return {
    get shownPlan() {
      return shownPlan
    },
    saveGeneratedPlan(plan: Plan) {
      shownPlan = plan
    },
  }
}
