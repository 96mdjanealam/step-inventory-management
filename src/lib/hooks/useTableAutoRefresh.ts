import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'

/**
 * Global flag indicating whether a background auto-refresh is currently in flight.
 * Used by TableCard and NavigationProgressBar to prevent disruptive loading states
 * during silent polling.
 */
export let isSilentAutoRefreshing = false

export interface UseTableAutoRefreshOptions {
  /**
   * Polling interval in milliseconds. Defaults to 20000 (20 seconds).
   */
  intervalMs?: number
  /**
   * Whether auto-refresh is active. Defaults to true.
   */
  enabled?: boolean
}

/**
 * Automatically refreshes active route table data every 20 seconds.
 *
 * Performance and efficiency guarantees:
 * 1. Pauses polling when the browser tab or window is hidden/inactive.
 * 2. Uses a completion-chained timer instead of naive setInterval to prevent overlapping in-flight requests.
 * 3. Immediately cleans up timers on component unmount or page navigation.
 * 4. Triggers background loader invalidation without remounting the page or losing input/filter focus.
 * 5. Immediately refreshes when switching back to the active tab if not already fetching.
 */
export function useTableAutoRefresh({
  intervalMs = 20000,
  enabled = true,
}: UseTableAutoRefreshOptions = {}) {
  const router = useRouter()
  const isRefreshingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    if (!enabled) return

    let timerId: ReturnType<typeof setTimeout> | null = null

    async function executeRefresh() {
      // 1. Skip if tab is inactive/hidden to avoid useless network load
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (isMountedRef.current) {
          timerId = setTimeout(executeRefresh, intervalMs)
        }
        return
      }

      // 2. Prevent overlapping requests if a previous refresh is still in flight
      if (!isRefreshingRef.current && isMountedRef.current) {
        isRefreshingRef.current = true
        isSilentAutoRefreshing = true
        try {
          await router.invalidate()
        } catch (err) {
          console.error('Auto-refresh error:', err)
        } finally {
          isRefreshingRef.current = false
          isSilentAutoRefreshing = false
        }
      }

      // 3. Schedule next refresh ONLY after the previous one finishes
      if (isMountedRef.current) {
        timerId = setTimeout(executeRefresh, intervalMs)
      }
    }

    // Initial timer schedule
    timerId = setTimeout(executeRefresh, intervalMs)

    // When returning to an active tab, refresh immediately if not already fetching
    function handleVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        isMountedRef.current &&
        !isRefreshingRef.current
      ) {
        executeRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMountedRef.current = false
      if (timerId) clearTimeout(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [router, intervalMs, enabled])
}

