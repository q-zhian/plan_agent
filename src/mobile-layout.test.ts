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
})
