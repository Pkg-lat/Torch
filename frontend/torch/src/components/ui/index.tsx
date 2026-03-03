import React from 'react'
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline'
import LoadingAnimation from '../loader'
import { motion, AnimatePresence } from 'framer-motion'

export const mono = { fontFamily: "'Space Mono', monospace" } as const
export const heading = { fontFamily: "'Seven Segment', sans-serif" } as const

/* ─── Page Header ─── */
type PageHeaderProps = {
    title: string
    subtitle: string
    icon?: React.ReactNode
    actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex items-center gap-3 mb-2">
                    {icon}
                    <h1 className="text-5xl uppercase tracking-wider text-neutral-900 dark:text-neutral-100" style={heading}>
                        {title}
                    </h1>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400" style={mono}>
                    {subtitle}
                </p>
            </div>
            {actions && <div className="flex gap-2 shrink-0 ml-auto">{actions}</div>}
        </div>
    )
}

/* ─── Button ─── */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
    icon?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, icon, children, disabled, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-neutral-900 disabled:opacity-50 disabled:pointer-events-none"

        const variants = {
            primary: "bg-red-500 hover:bg-red-600 text-white border-transparent",
            secondary: "bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border-transparent",
            danger: "bg-orange-500 hover:bg-orange-600 text-white border-transparent",
            ghost: "bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
            outline: "bg-transparent border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
        }

        const sizes = {
            sm: "px-3 py-1.5 text-xs",
            md: "px-4 py-2 text-sm",
            lg: "px-5 py-2.5 text-base",
        }

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className || ''}`}
                style={mono}
                {...props}
            >
                {isLoading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                {!isLoading && icon && icon}
                {children}
            </button>
        )
    }
)
Button.displayName = 'Button'

/* ─── Input ─── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
    helpText?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, helpText, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-[10px] uppercase tracking-widest mb-2 text-neutral-500 dark:text-neutral-400" style={mono}>
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`w-full px-3 py-2 border bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 text-neutral-900 dark:text-neutral-100 transition-colors ${error
                        ? 'border-red-500 dark:border-red-500 focus:border-red-500 dark:focus:border-red-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-red-500 dark:focus:border-red-500'
                        } ${className || ''}`}
                    style={mono}
                    {...props}
                />
                {error && <span className="text-[10px] mt-1 text-red-500 block" style={mono}>{error}</span>}
                {helpText && !error && <span className="text-[10px] mt-1 text-neutral-400 block" style={mono}>{helpText}</span>}
            </div>
        )
    }
)
Input.displayName = 'Input'

/* ─── Modal ─── */
type ModalProps = {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    maxWidth?: string
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={`relative w-full ${maxWidth} border bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 rounded-sm z-10 m-4`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 tracking-wide" style={mono}>
                                {title}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1 rounded-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}

/* ─── Refresh Button ─── */
export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
    return (
        <Button variant="secondary" size="sm" onClick={onClick} isLoading={loading} icon={<ArrowPathIcon className="h-4 w-4" />}>
            <span className="hidden sm:inline">REFRESH</span>
        </Button>
    )
}

/* ─── Search Bar ─── */
type SearchBarProps = { value: string; onChange: (value: string) => void; placeholder: string }
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
    return (
        <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border bg-white dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-neutral-400 font-mono text-neutral-900 dark:text-neutral-100"
                style={mono}
            />
            {value && (
                <button onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors">
                    <XMarkIcon className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    )
}

/* ─── Filter Pills ─── */
export function FilterPills<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (value: T) => void }) {
    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <FunnelIcon className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            {options.map((opt) => (
                <button
                    key={opt}
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border rounded-sm transition-all whitespace-nowrap ${value === opt
                        ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : 'bg-white dark:bg-neutral-900/50 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                        }`}
                    style={mono}
                >
                    {opt}
                </button>
            ))}
        </div>
    )
}

/* ─── Stat Card ─── */
type StatCardColor = 'neutral' | 'green' | 'red' | 'yellow' | 'purple' | 'blue'
type StatCardProps = { label: string; value: string | number; subtext?: string; icon: React.ReactNode; color: StatCardColor }

const statColorMap: Record<StatCardColor, string> = {
    neutral: 'border-neutral-200 dark:border-neutral-800/50 bg-white dark:bg-neutral-900/40',
    green: 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20',
    red: 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20',
    yellow: 'border-yellow-200 dark:border-yellow-900/30 bg-yellow-50/50 dark:bg-yellow-950/20',
    purple: 'border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-950/20',
    blue: 'border-blue-200 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20',
}

const statIconColorMap: Record<StatCardColor, string> = {
    neutral: 'text-neutral-400',
    green: 'text-emerald-500',
    red: 'text-red-500',
    yellow: 'text-yellow-500',
    purple: 'text-purple-500',
    blue: 'text-blue-500',
}

export function StatCard({ label, value, subtext, icon, color }: StatCardProps) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`border p-4 rounded-sm transition-colors ${statColorMap[color]}`}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.15em] font-medium text-neutral-500 dark:text-neutral-400" style={mono}>
                    {label}
                </span>
                <span className={statIconColorMap[color]}>{icon}</span>
            </div>
            <div className={`text-2xl font-medium text-neutral-900 dark:text-neutral-100`} style={mono}>
                {value}
            </div>
            {subtext && (
                <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1" style={mono}>
                    {subtext}
                </div>
            )}
        </motion.div>
    )
}

/* ─── List Panel ─── */
type ListPanelProps = {
    header: React.ReactNode
    headerRight?: React.ReactNode
    loading?: boolean
    loadingText?: string
    empty?: boolean
    emptyContent?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
}

export function ListPanel({ header, headerRight, loading, loadingText = 'Loading...', empty, emptyContent, children, footer }: ListPanelProps) {
    return (
        <div className="border bg-white dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800 rounded-sm overflow-hidden shadow-sm">
            <div className="border-b px-5 py-4 border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/80 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700 dark:text-neutral-300" style={mono}>
                    {header}
                </h2>
                {headerRight && <span className="text-[10px] text-neutral-500" style={mono}>{headerRight}</span>}
            </div>

            {loading ? (
                <div className="p-16 text-center">
                    <div className="flex justify-center mb-4 w-12 h-12 mx-auto scale-75">
                        <LoadingAnimation />
                    </div>
                    <p className="text-xs text-neutral-500 animate-pulse" style={mono}>{loadingText}</p>
                </div>
            ) : empty ? (
                <div className="p-16 text-center">{emptyContent}</div>
            ) : (
                <>
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 bg-white dark:bg-black/20">
                        {children}
                    </div>
                    {footer && <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/80">{footer}</div>}
                </>
            )}
        </div>
    )
}

/* ─── Pagination ─── */
type PaginationProps = {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
    onPageChange: (page: number) => void
    onPageSizeChange?: (size: number) => void
    pageSizeOptions?: number[]
    disabled?: boolean
}

export function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange, pageSizeOptions = [10, 25, 50, 100], disabled }: PaginationProps) {
    if (totalPages <= 1 && !onPageSizeChange) return null

    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
    const endItem = Math.min(currentPage * pageSize, totalItems)

    return (
        <div className="px-5 py-3 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
                <span className="text-xs text-neutral-500" style={mono}>
                    Showing <span className="text-neutral-900 dark:text-neutral-100 font-medium">{startItem}–{endItem}</span> of <span className="text-neutral-900 dark:text-neutral-100 font-medium">{totalItems}</span>
                </span>
                {onPageSizeChange && (
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        disabled={disabled}
                        className="px-2 py-1 text-xs border bg-transparent border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:border-red-500 rounded-sm"
                        style={mono}
                    >
                        {pageSizeOptions.map(size => <option key={size} value={size}>{size} / page</option>)}
                    </select>
                )}
            </div>

            <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={currentPage === 1 || disabled}>&laquo;</Button>
                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1 || disabled}>&lsaquo;</Button>
                <span className="px-3 text-[11px] text-neutral-600 dark:text-neutral-400" style={mono}>
                    Page <span className="text-neutral-900 dark:text-neutral-100 font-medium">{currentPage}</span> of {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages || disabled}>&rsaquo;</Button>
                <Button variant="outline" size="sm" onClick={() => onPageChange(totalPages)} disabled={currentPage >= totalPages || disabled}>&raquo;</Button>
            </div>
        </div>
    )
}

/* ─── Empty State ─── */
export function EmptyState({ icon, title, subtitle, action }: { icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto">
            <div className="mb-4 text-neutral-400 bg-neutral-100 dark:bg-neutral-800 p-4 rounded-full">{icon}</div>
            <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-2" style={mono}>{title}</h3>
            {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed" style={mono}>{subtitle}</p>}
            {action}
        </div>
    )
}

export function NoMatchState({ onClear }: { onClear: () => void }) {
    return (
        <EmptyState
            icon={<MagnifyingGlassIcon className="h-8 w-8" />}
            title="No results match your search"
            action={<Button variant="ghost" size="sm" onClick={onClear}>Clear filters</Button>}
        />
    )
}
