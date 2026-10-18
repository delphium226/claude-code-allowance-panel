import { test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, SessionContextUsage, SessionRateLimit } from 'claude-code'

const LIMITS: SessionRateLimit[] = [
  { kind: 'seven_day', percentUsed: 71.4, resetsAt: '2026-10-20T22:00:00Z' },
  { kind: 'five_hour', percentUsed: 41, resetsAt: '2026-10-18T13:15:00Z' },
]
const CONTEXT: SessionContextUsage = { window: 1_000_000, tokens: 160_000, percent: 16 }
const FRESH: SessionContextUsage = { window: 1_000_000 }

const band = (hasSurvey = false) =>
  ({ hasSurvey, isWorking: false, maxRows: 10, bodyColumns: 75 }) as never

const mount = ($: Engine, surface: 'terminal' | 'desktop', hasSurvey = false) =>
  $.ui.mount({ plugin: 'usage-panel', surface, component: 'AbovePrompt', props: band(hasSurvey) })

const usage = (on: On, context: SessionContextUsage, rateLimits: SessionRateLimit[]) => {
  on('session.usage', async () => ({ value: { startedAt: 0, context, rateLimits } }))
  on('clock.now', async () => ({ value: Date.parse('2026-10-18T12:00:00Z') }))
}

const engineDraws = (on: On, text: string) =>
  on('ui.render', async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{text}</Text>
  })

const shown = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(shown).join('')
  if (node && typeof node === 'object' && 'children' in node) return shown((node as { children: unknown }).children)
  return ''
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`draws context and both windows on one line on ${surface}`, async ($, on) => {
    usage(on, CONTEXT, LIMITS)
    const ui = await mount($, surface)
    expect(shown(await ui.drawn())).toBe('C:16% - 5h:41%:1h15m - W:71%:2d10h')
    for (const label of ['C', '5h', 'W']) {
      expect((await ui.find({ type: 'Text', text: label }))?.props).toMatchObject({ bold: true })
    }
    expect((await ui.find({ type: 'Text', text: '16%' }))?.props).toMatchObject({ color: 'yellow' })
  })

  test(`turns a percent bright red only over 85% on ${surface}`, async ($, on) => {
    usage(on, { window: 1_000_000, percent: 85 }, [
      { kind: 'five_hour', percentUsed: 85.4, resetsAt: '2026-10-18T13:15:00Z' },
      { kind: 'seven_day', percentUsed: 86, resetsAt: '2026-10-20T22:00:00Z' },
    ])
    const ui = await mount($, surface)
    const bright = surface === 'terminal' ? 'redBright' : '#ff453a'
    expect((await ui.find({ type: 'Text', text: '86%' }))?.props).toMatchObject({ color: bright })
    // 85 and 85.4 are not over 85: both stay yellow.
    for (const text of (await ui.findAll({ type: 'Text', text: '85%' }))) {
      expect(text.props).toMatchObject({ color: 'yellow' })
    }
    expect(await ui.findAll({ type: 'Text', text: '85%' })).toHaveLength(2)
  })

  test(`shows context alone without plan limits on ${surface}`, async ($, on) => {
    usage(on, CONTEXT, [])
    const ui = await mount($, surface)
    expect(shown(await ui.drawn())).toBe('C:16%')
  })

  test(`shows limits before the first context reading on ${surface}`, async ($, on) => {
    usage(on, FRESH, LIMITS)
    const ui = await mount($, surface)
    expect(shown(await ui.drawn())).toBe('5h:41%:1h15m - W:71%:2d10h')
  })

  test(`stays out of the way with no reading on ${surface}`, async ($, on) => {
    usage(on, FRESH, [])
    engineDraws(on, 'engine')
    const ui = await mount($, surface)
    expect(await ui.find({ text: 'engine' })).toBeDefined()
  })

  test(`yields to a survey on ${surface}`, async ($, on) => {
    usage(on, CONTEXT, LIMITS)
    engineDraws(on, 'survey')
    const ui = await mount($, surface, true)
    expect(await ui.find({ text: 'survey' })).toBeDefined()
  })
}
