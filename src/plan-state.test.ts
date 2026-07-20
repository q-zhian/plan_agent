import { describe, expect, test } from 'vitest'
import {
  createPlanState,
  initialMvpPlan,
  loadSavedPlan,
  savePlanToStorage,
  STORAGE_KEY,
  isPlan,
  type Plan,
} from './plan-state'

const validStoredPlan: Plan = {
  title: '保存的计划',
  totalDuration: '1 小时',
  startTime: '09:00',
  endTime: '10:00',
  tasks: Array.from({ length: 4 }, (_, index) => ({
    title: `任务 ${index + 1}`,
    startTime: '09:00',
    endTime: '10:00',
    description: '先写测试',
    estimatedDuration: '1 小时',
  })),
}

describe('plan state', () => {
  test('starts with the five-task MVP plan', () => {
    expect(initialMvpPlan.tasks).toHaveLength(5)
    expect(initialMvpPlan.tasks.map((task) => task.title)).toEqual([
      '梳理页面结构',
      '搭建首屏',
      '完成计划流程',
      '移动端检查',
      '发布演示版',
    ])
    expect(initialMvpPlan).toMatchObject({
      totalDuration: expect.any(String),
      startTime: expect.any(String),
      endTime: expect.any(String),
    })

    for (const task of initialMvpPlan.tasks) {
      expect(task).toMatchObject({
        startTime: expect.any(String),
        endTime: expect.any(String),
        description: expect.any(String),
        estimatedDuration: expect.any(String),
      })
    }
  })

  test('saving a generated plan replaces the shown plan', () => {
    const generatedPlan: Plan = {
      title: '下午完成 MVP 展示网页',
      totalDuration: '2 小时',
      startTime: '13:00',
      endTime: '15:00',
      tasks: [
        {
          title: '搭建可点击原型',
          startTime: '13:00',
          endTime: '15:00',
          description: '完成从首页到保存的演示流程。',
          estimatedDuration: '2 小时',
        },
      ],
    }
    const state = createPlanState()

    state.saveGeneratedPlan(generatedPlan)

    expect(state.shownPlan).toEqual(generatedPlan)
  })

  test('round-trips a saved plan through local storage', () => {
    savePlanToStorage(validStoredPlan)

    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(validStoredPlan))
    expect(loadSavedPlan()).toEqual(validStoredPlan)
  })

  test('returns null for malformed stored JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')

    expect(loadSavedPlan()).toBeNull()
  })

  test('returns null for an invalid stored plan shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: '缺少任务' }))

    expect(loadSavedPlan()).toBeNull()
  })

  test('rejects plans with empty time values', () => {
    expect(isPlan({ ...validStoredPlan, startTime: ' ' })).toBe(false)
  })

  test('rejects plans with out-of-range time values', () => {
    expect(isPlan({ ...validStoredPlan, endTime: '24:00' })).toBe(false)
  })

  test('rejects time values with trailing newlines', () => {
    expect(isPlan({ ...validStoredPlan, startTime: '09:00\n' })).toBe(false)
  })

  test('rejects plans with fewer than four tasks', () => {
    expect(isPlan({ ...validStoredPlan, tasks: validStoredPlan.tasks.slice(0, 3) })).toBe(false)
  })

  test('rejects plans with more than six tasks', () => {
    expect(isPlan({
      ...validStoredPlan,
      tasks: [...validStoredPlan.tasks, ...validStoredPlan.tasks.slice(0, 3)],
    })).toBe(false)
  })

  test('rejects blank required plan and task strings', () => {
    expect(isPlan({ ...validStoredPlan, title: '  ' })).toBe(false)
    expect(isPlan({
      ...validStoredPlan,
      tasks: [{ ...validStoredPlan.tasks[0], description: ' ', estimatedDuration: '\t' }, ...validStoredPlan.tasks.slice(1)],
    })).toBe(false)
  })

  test('rejects plans with extra outer or task keys', () => {
    expect(isPlan({ ...validStoredPlan, unexpected: true })).toBe(false)
    expect(isPlan({
      ...validStoredPlan,
      tasks: [{ ...validStoredPlan.tasks[0], unexpected: true }, ...validStoredPlan.tasks.slice(1)],
    })).toBe(false)
  })

  test('does not throw when storage is unavailable', () => {
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined })

    expect(() => savePlanToStorage(initialMvpPlan)).not.toThrow()
    expect(loadSavedPlan()).toBeNull()

    if (localStorageDescriptor) {
      Object.defineProperty(window, 'localStorage', localStorageDescriptor)
    }
  })
})
