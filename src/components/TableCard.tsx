import React from 'react'

export interface TableCardProps {
  children: React.ReactNode
  className?: string
}

/**
 * Standardized table card container matching the /sales page aesthetic.
 * Clean rounded-xl card with border, subtle shadow, and consistent header/cell typography.
 */
export function TableCard({ children, className = '' }: TableCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden ${className}`}
    >
      {children}
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
    <table
      className={`w-full text-left text-sm text-neutral-600 ${className}`}
      {...props}
    >
      {children}
    </table>
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
