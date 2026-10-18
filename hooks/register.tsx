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

// One window as label:percent:time-left, e.g. 5h:41%:1h15m.
export const segment = (limit: SessionRateLimit, now: number) => {
  const label = LABELS[limit.kind] ?? limit.kind
  const left = timeLeft(limit.resetsAt, now)
  return { label, percent: `${Math.round(limit.percentUsed)}%`, left }
}

// Every percentage in yellow, turning red from 90%.
const colorFor = (percent: number) => (percent >= 90 ? 'red' : 'yellow')

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
    if (e.changed.includes('rateLimits')) $.ui.invalidate('ui.render')

    return next(e)
  })

  // One line in the band just above the prompt: 5h:41%:1h15m - W:71%:2d10h
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { rateLimits } = await $.session.usage()
    if (rateLimits.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    return (
      <Box flexDirection="row">
        {sorted(rateLimits).map((limit, i) => {
          const { label, percent, left } = segment(limit, now)
          return (
            <Box key={limit.kind} flexDirection="row">
              {i > 0 && <Text dimColor>{' - '}</Text>}
              <Text bold>{label}</Text>
              <Text dimColor>:</Text>
              <Text color={colorFor(limit.percentUsed)}>{percent}</Text>
              {left && <Text dimColor>{`:${left}`}</Text>}
            </Box>
          )
        })}
      </Box>
    )
  })
}
