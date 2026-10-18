import { test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { SessionRateLimit } from 'claude-code'

const LIMITS: SessionRateLimit[] = [
  { kind: 'seven_day', percentUsed: 71.4, resetsAt: '2026-10-20T22:00:00Z' },
  { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-10-18T13:15:00Z' },
]

const band = (hasSurvey = false) =>
  ({ hasSurvey, isWorking: false, maxRows: 10, bodyColumns: 75 }) as never

const mount = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) =>
  $.ui.mount({ plugin: 'usage-panel', surface, component: 'AbovePrompt', props: band(hasSurvey) })

const shown = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(shown).join('')
  if (node && typeof node === 'object' && 'children' in node) return shown((node as { children: unknown }).children)
  return ''
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`draws both windows on one line on ${surface}`, async ($, on) => {
    on('session.usage', async () => ({ value: { startedAt: 0, context: {} as never, rateLimits: LIMITS } }))
    on('clock.now', async () => ({ value: Date.parse('2026-10-18T12:00:00Z') }))
    const ui = await mount($, surface)
    expect(shown(await ui.drawn())).toBe('5h:41%:1h15m - W:71%:2d10h')
    expect((await ui.find({ type: 'Text', text: '5h' }))?.props).toMatchObject({ bold: true })
    expect((await ui.find({ type: 'Text', text: 'W' }))?.props).toMatchObject({ bold: true })
    expect((await ui.find({ type: 'Text', text: '41%' }))?.props).toMatchObject({ color: 'yellow' })
    expect((await ui.find({ type: 'Text', text: '71%' }))?.props).toMatchObject({ color: 'yellow' })
  })

  test(`stays out of the way with no reading on ${surface}`, async ($, on) => {
    on('session.usage', async () => ({ value: { startedAt: 0, context: {} as never, rateLimits: [] } }))
    on('ui.render', async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    const ui = await mount($, surface)
    expect(await ui.find({ text: 'engine' })).toBeDefined()
  })

  test(`yields to a survey on ${surface}`, async ($, on) => {
    on('session.usage', async () => ({ value: { startedAt: 0, context: {} as never, rateLimits: LIMITS } }))
    on('clock.now', async () => ({ value: 0 }))
    on('ui.render', async ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>survey</Text>
    })
    const ui = await mount($, surface, true)
    expect(await ui.find({ text: 'survey' })).toBeDefined()
  })
}
