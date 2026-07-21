import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 520px)'))

describe('approved mobile layout guard', () => {
  test('uses the approved dark production canvas', () => {
    expect(styles).toMatch(/color-scheme:\s*dark/)
    expect(styles).toMatch(/background:\s*#111211/)
    expect(styles).toMatch(/\.phone-canvas\s*\{[^}]*max-width:\s*430px;/)
  })

  test('keeps the conversation entry and composer reachable on mobile', () => {
    expect(styles).toMatch(/\.agent-entry\s*\{[^}]*position:\s*fixed;/)
    expect(styles).toMatch(/\.composer\s*\{[^}]*position:\s*fixed;/)
    expect(mobileStyles).toMatch(/\.phone-canvas\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/)
  })

  test('keeps both long-text fields full-width and scrollable', () => {
    expect(styles).toMatch(/textarea\s*\{[^}]*width:\s*100%;[^}]*max-height:\s*160px;[^}]*overflow-y:\s*auto;[^}]*resize:\s*none;/)
    expect(styles).toMatch(/\.composer textarea\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1;/)
  })
})
