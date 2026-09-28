// Menu bar clock: a vf-label slotted at the end of vf-menu-bar (index.html).
// Shows the time, updated on the minute. A press shows the date for
// DATE_HOLD_MS, and a second press returns to the time early. The bar's press
// controller only hit-tests titles and rows, so it ignores presses on the label.

/** How long a press shows the date. */
export const DATE_HOLD_MS = 3000

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "7:27 PM": 12-hour local time. */
export function formatTime(d: Date): string {
  const h = d.getHours()
  return `${h % 12 || 12}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

/** "9/27/26": M/D/YY local date. */
export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${pad2(d.getFullYear() % 100)}`
}

/** Renders the clock into its label now and on every minute boundary. */
export function initClock(
  label: HTMLElement,
  { now = Date.now, holdMs = DATE_HOLD_MS }: { now?: () => number; holdMs?: number } = {}
) {
  let showingDate = false
  let holdTimer = 0
  let tickTimer = 0

  const render = () => {
    const d = new Date(now())
    label.textContent = showingDate ? formatDate(d) : formatTime(d)
  }

  // Ticks just after each minute boundary. The epoch remainder matches local
  // time in any whole-minute UTC offset.
  const scheduleTick = () => {
    const delay = 60_000 - (now() % 60_000) + 20
    tickTimer = window.setTimeout(() => {
      render()
      scheduleTick()
    }, delay)
  }

  const showTime = () => {
    clearTimeout(holdTimer)
    holdTimer = 0
    showingDate = false
    render()
  }

  const onPress = (e: PointerEvent) => {
    if (e.button !== 0) return
    // No text selection from a drag across the bar, and focus stays put.
    e.preventDefault()
    if (showingDate) {
      showTime()
      return
    }
    showingDate = true
    render()
    holdTimer = window.setTimeout(showTime, holdMs)
  }

  // Background tabs throttle timers, so re-render when the tab is shown again.
  const onVisibility = () => {
    if (!document.hidden) render()
  }

  render()
  scheduleTick()
  label.addEventListener('pointerdown', onPress)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    dispose(): void {
      clearTimeout(tickTimer)
      clearTimeout(holdTimer)
      label.removeEventListener('pointerdown', onPress)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
