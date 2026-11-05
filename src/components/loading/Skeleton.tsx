import React from 'react'

export interface SkeletonProps extends React.ComponentProps<'div'> {
  className?: string
}

/**
 * Basic pulsing skeleton block. Adheres to zero-border-radius design.
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-neutral-200/80 ${className}`}
      {...props}
    />
  )
}

