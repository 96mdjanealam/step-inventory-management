import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  badge?: {
    text: string
    variant?: 'neutral' | 'success' | 'warning' | 'danger'
  }
}

export function StatCard({ title, value, subtitle, icon: Icon, badge }: StatCardProps) {
  const badgeClasses = {
    neutral: 'bg-brand-bg text-brand-primary border-brand-coral/40',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  }[badge?.variant || 'neutral']

  return (
    <div className="border border-neutral-200 bg-white p-5 flex flex-col justify-between shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          {title}
        </span>
        <div className="p-2 bg-brand-bg/70 text-brand-primary border border-brand-coral/40">
          <Icon className="size-4.5" />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold tracking-tight text-brand-charcoal">
          {value}
        </div>
        {(subtitle || badge) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            {subtitle && (
              <span className="text-xs text-neutral-500">{subtitle}</span>
            )}
            {badge && (
              <span
                className={`text-[11px] font-medium px-1.5 py-0.5 border ${badgeClasses}`}
              >
                {badge.text}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

