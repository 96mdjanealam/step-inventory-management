import { useRouterState } from '@tanstack/react-router'
import { isSilentAutoRefreshing } from '../../lib/hooks/useTableAutoRefresh.ts'

/**
 * Top-edge indeterminate progress bar displayed during route transitions.
 * Provides immediate (< 16ms) visual feedback when clicking between pages.
 */
export function NavigationProgressBar() {
  const isPageNavigating = useRouterState({
    select: (s) =>
      s.status === 'pending' &&
      Boolean(s.resolvedLocation) &&
      s.location.pathname !== s.resolvedLocation?.pathname,
  })

  if (!isPageNavigating || isSilentAutoRefreshing) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-brand-coral/30 overflow-hidden pointer-events-none">
      <div className="h-full bg-brand-primary w-full animate-indeterminate" />
    </div>
  )
}

