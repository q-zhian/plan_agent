import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 520px)'))

describe('mobile layout guard', () => {
  test('makes the phone canvas scrollable and keeps bottom actions in the viewport', () => {
    expect(mobileStyles).toMatch(/\.phone-canvas\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*auto;/)
    expect(mobileStyles).toMatch(/\.bottom-action, \.composer\s*\{[^}]*position:\s*fixed;/)
  })

  test('sizes textareas for long content and keeps the mobile composer edge-to-edge', () => {
    expect(styles).toMatch(/textarea[^}]*width:\s*100%;[^}]*box-sizing:\s*border-box;/)
    expect(styles).toMatch(/textarea[^}]*max-height:\s*\d+px;[^}]*overflow-y:\s*auto;[^}]*resize:\s*none;/)
    expect(mobileStyles).toMatch(/\.bottom-action, \.composer\s*\{[^}]*position:\s*fixed;[^}]*left:\s*max\(6px,\s*env\(safe-area-inset-left\)\);[^}]*right:\s*max\(6px,\s*env\(safe-area-inset-right\)\);/)
    expect(styles).toMatch(/\.composer textarea\s*\{[^}]*min-width:\s*0;[^}]*flex:\s*1;/)
    expect(styles).toMatch(/\.composer button\s*\{[^}]*flex:\s*0 0 48px;/)
  })

  test('reserves enough bottom space for the expanded composer', () => {
    expect(styles).toMatch(/\.screen\s*\{[^}]*padding:\s*20px\s+20px\s+calc\(195px\s*\+\s*env\(safe-area-inset-bottom\)\);/)
  })
})
