import type { Register, SessionRateLimit } from 'claude-code'

const LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: 'W',
  spend_limit: '$',
}

// Compact time left: 45m, 1h15m, 2d10h.
export const timeLeft = (resetsAt: string | undefined, now: number): string => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return 'now'
  const minutes = Math.round(ms / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h${mins}m`
  return `${mins}m`
}

type Part = { key: string; label: string; percent: number; left: string }

// One window as label:percent:time-left, e.g. 5h:41%:1h15m.
export const segment = (limit: SessionRateLimit, now: number): Part => ({
  key: limit.kind,
  label: LABELS[limit.kind] ?? limit.kind,
  percent: limit.percentUsed,
  left: timeLeft(limit.resetsAt, now),
})

// Theme colours, so light and dark themes each paint them readably: warning
// amber, turning to the theme's error red once the number shown is over 85%.
export const colorFor = (percent: number) => (Math.round(percent) > 85 ? 'error' : 'warning')

const ORDER = ['five_hour', 'seven_day']
const sorted = (limits: SessionRateLimit[]) =>
  [...limits].sort((a, b) => {
    const ia = ORDER.indexOf(a.kind)
    const ib = ORDER.indexOf(b.kind)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })

export const register: Register = on => {
  // The engine pushes a measurement when a window moves a whole point.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') || e.changed.includes('context')) {
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  // One line in the band just above the prompt: C:16% - 5h:41%:1h15m - W:71%:2d10h
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { context, rateLimits } = await $.session.usage()
    const now = await $.clock.now()
    const parts: Part[] = [
      ...(context.percent === undefined
        ? []
        : [{ key: 'context', label: 'C', percent: context.percent, left: '' }]),
      ...sorted(rateLimits).map(limit => segment(limit, now)),
    ]
    if (parts.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row">
        {parts.map((part, i) => (
          <Box key={part.key} flexDirection="row">
            {i > 0 && <Text dimColor>{' - '}</Text>}
            <Text bold>{part.label}</Text>
            <Text dimColor>:</Text>
            <Text color={colorFor(part.percent)}>{`${Math.round(part.percent)}%`}</Text>
            {part.left && <Text dimColor>{`:${part.left}`}</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
