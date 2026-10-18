# Claude Code allowance panel

A Claude Code extension that shows how full your context window is and how much
of your plan's usage limits you have used, on one line just above the prompt:

```
C:16% - 5h:41%:1h15m - W:71%:2d10h
```

- **C**: how full this session's context window is.
- **5h**: your 5-hour session limit. Percent used, then the time until it resets.
- **W**: your weekly limit. Percent used, then the time until it resets.

The percentages are yellow, and either one turns red from 90%. The line updates
whenever a limit moves by a whole percent. It works in the terminal and in the
Claude desktop app's Code tab.

The figures come from Claude's replies, so the line appears after your first
message in a session. The 5h and W limits only show on a Pro or Max
subscription; with an API key the line shows the context section alone.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install usage-panel --marketplace delphium226/claude-code-allowance-panel
```

Or from a shell:

```bash
claude plugin install usage-panel --marketplace delphium226/claude-code-allowance-panel
```

Answer `y` to add the marketplace, then pick the user scope so it loads in every
session.

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt
box, then **Plugins**, **Add marketplace** with
`delphium226/claude-code-allowance-panel`, then **Add plugin**.

## Uninstall

```bash
claude plugin uninstall usage-panel
```
