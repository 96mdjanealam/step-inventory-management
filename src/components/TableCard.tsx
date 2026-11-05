import React from 'react'
import { useRouterState } from '@tanstack/react-router'
import { isSilentAutoRefreshing } from '../lib/hooks/useTableAutoRefresh.ts'

export interface TableCardProps {
  children: React.ReactNode
  className?: string
  isLoading?: boolean
}

/**
 * Standardized table card container matching the application's design tokens.
 * Provides smooth in-place table refreshing during search and filter operations:
 * - Dims table rows slightly (opacity-60 pointer-events-none) during active queries.
 * - Shows a sleek 2px indeterminate progress bar pinned to the top border.
 * - Stays completely silent during 5-second background auto-refresh to prevent flickering.
 */
export function TableCard({
  children,
  className = '',
  isLoading,
}: TableCardProps) {
  const isTableLoading = useRouterState({
    select: (s) =>
      s.status === 'pending' &&
      (!s.resolvedLocation || s.location.pathname === s.resolvedLocation.pathname),
  })
  const loading = (isLoading ?? isTableLoading) && !isSilentAutoRefreshing

  return (
    <div
      className={`relative bg-white border border-neutral-200 shadow-xs overflow-hidden ${className}`}
    >
      {loading && (
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 bg-brand-coral/30 overflow-hidden pointer-events-none">
          <div className="h-full bg-brand-primary w-full animate-indeterminate" />
        </div>
      )}
      <div
        className={`transition-opacity duration-150 ${
          loading ? 'opacity-60 pointer-events-none' : 'opacity-100'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export interface TableContainerProps {
  children: React.ReactNode
  className?: string
}

export function TableContainer({
  children,
  className = '',
}: TableContainerProps) {
  return <div className={`w-full overflow-x-auto ${className}`}>{children}</div>
}

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {}

export function Table({ children, className = '', ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full text-left text-sm text-neutral-600 ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableHeader({
  children,
  className = '',
  ...props
}: TableHeaderProps) {
  return (
    <thead
      className={`bg-neutral-50 text-neutral-900 font-semibold border-b border-neutral-200 ${className}`}
      {...props}
    >
      {children}
    </thead>
  )
}

export interface TableBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function TableBody({
  children,
  className = '',
  ...props
}: TableBodyProps) {
  return (
    <tbody className={`divide-y divide-neutral-100 ${className}`} {...props}>
      {children}
    </tbody>
  )
}

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  isHeader?: boolean
}

export function TableRow({
  children,
  className = '',
  isHeader,
  ...props
}: TableRowProps) {
  const hoverClass = isHeader ? '' : 'hover:bg-neutral-50/70 transition'
  return (
    <tr className={`${hoverClass} ${className}`} {...props}>
      {children}
    </tr>
  )
}

export interface TableHeadCellProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
}

export function TableHeadCell({
  children,
  className = '',
  align = 'left',
  ...props
}: TableHeadCellProps) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  return (
    <th className={`py-3 px-4 ${alignClass} ${className}`} {...props}>
      {children}
    </th>
  )
}

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
}

export function TableCell({
  children,
  className = '',
  align = 'left',
  ...props
}: TableCellProps) {
  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
        ? 'text-center'
        : 'text-left'
  return (
    <td className={`py-3.5 px-4 ${alignClass} ${className}`} {...props}>
      {children}
    </td>
  )
}

export interface TableEmptyProps {
  colSpan: number
  message?: React.ReactNode
}

export function TableEmpty({
  colSpan,
  message = 'No records found matching your filters.',
}: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-neutral-400">
        {message}
      </td>
    </tr>
  )
}

export interface TableFooterProps {
  children: React.ReactNode
  className?: string
}

export function TableFooter({ children, className = '' }: TableFooterProps) {
  return (
    <div
      className={`border-t border-neutral-200 bg-neutral-50 px-4 ${className}`}
    >
      {children}
    </div>
  )
}

TableCard.Table = Table
TableCard.Header = TableHeader
TableCard.Body = TableBody
TableCard.Row = TableRow
TableCard.Head = TableHeadCell
TableCard.Th = TableHeadCell
TableCard.Cell = TableCell
TableCard.Td = TableCell
TableCard.Empty = TableEmpty
TableCard.Footer = TableFooter
TableCard.Container = TableContainer
