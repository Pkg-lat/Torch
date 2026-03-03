import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { RequireAuth } from '../../components/RequireAuth'
import { Sidebar } from '../../components/sidebar'
import { useSidebar } from '../../contexts/SidebarContext'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import { logout } from '../../lib/auth-api'
import { useState, useCallback } from 'react'
import { mono, Button, Modal, PageHeader, RefreshButton } from '../../components/ui'
import { AlertCircleIcon } from 'lucide-react'
import LoadingAnimation from '@/components/loader'

export const Route = createFileRoute('/wallet/')({
  component: WalletPage,
})

interface Transaction {
  uuid: string 
  workspaceId: string
  type: 'credit' | 'debit' | 'refund'
  amount: number
  balance: number
  description: string
  metadata?: Record<string, unknown>
  createdAt: string
}

function WalletPage() {
  return (
    <RequireAuth>
      {(user) => <WalletContent user={user} />}
    </RequireAuth>
  )
}

// Resource bar with gradient (LCD style)
function ResourceBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const percent = total > 0 ? Math.round((used / total) * 100) : 0
  const barSegments = 20
  const filledSegments = Math.round((percent / 100) * barSegments)
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500" style={mono}>
          {label}
        </span>
        <span className="text-xs text-neutral-700 dark:text-neutral-400" style={mono}>
          {used.toLocaleString()}{unit} / {total.toLocaleString()}{unit}
        </span>
      </div>
      <div className="flex gap-[2px]">
        {Array.from({ length: barSegments }).map((_, i) => {
          const isFilled = i < filledSegments
          const segmentPercent = (i / barSegments) * 100
          let color = 'bg-neutral-300 dark:bg-neutral-800'
          if (isFilled) {
            if (segmentPercent < 33) color = 'bg-yellow-500'
            else if (segmentPercent < 66) color = 'bg-orange-500'
            else color = 'bg-red-500'
          }
          return (
            <div
              key={i}
              className={`h-4 flex-1 ${color} ${isFilled ? 'opacity-100' : 'opacity-30'}`}
            />
          )
        })}
      </div>
      <div className="text-right">
        <span className="text-lg text-red-600 dark:text-red-400" style={{ fontFamily: "'Seven Segment', sans-serif" }}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

function WalletContent({ user }: { user: any }) {
  const { isCollapsed, isMobile } = useSidebar()
  const { selectedWorkspace } = useWorkspace()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  const onLogout = async () => {
    await logout()
    window.location.href = '/auth'
  }

  const { data: transactionsData, isLoading, isFetching, refetch: refetchTransactions } = useQuery({
    queryKey: ['transactions', selectedWorkspace?.uuid, currentPage, pageSize],
    queryFn: async () => {
      if (!selectedWorkspace) return { transactions: [], meta: { total: 0, page: 1, limit: 10 } }

      const response = await fetch(
        `/api/workspaces/${selectedWorkspace.uuid}/transactions?page=${currentPage}&pageSize=${pageSize}`,
        { credentials: 'include' },
      )

      if (!response.ok) {
        const error = new Error('Failed to fetch transactions')
        ; (error as any).status = response.status
        throw error
      }

      return response.json()
    },
    enabled: !!selectedWorkspace,
  })

  const transactions: Transaction[] = transactionsData?.transactions || []
  const totalTransactions = transactionsData?.meta?.total || 0
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize))
  const hasPagination = totalTransactions > pageSize

  const formatTimestamp = useCallback((timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    if (Number.isNaN(date.getTime())) return String(timestamp)
    const diffMs = Date.now() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    if (diffSeconds < 45) return 'just now'
    if (diffSeconds < 90) return '1 min ago'
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    return date.toLocaleString()
  }, [])

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === currentPage || nextPage > totalPages) return
    setCurrentPage(nextPage)
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = parseInt(e.target.value, 10)
    if (!Number.isFinite(size) || size <= 0) return
    setPageSize(size)
    setCurrentPage(1)
  }

  if (!selectedWorkspace) {
    return (
      <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <Sidebar user={user} onLogout={onLogout} />
        <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
          <div className="text-center py-12">
            <p className="text-neutral-500">Please select a workspace</p>
          </div>
        </main>
      </div>
    )
  }

  const currentBalance = user.billing?.credits || 0
  const usedCredits = user.billing?.usedCredits || 0
  const totalCredits = Math.max(currentBalance + usedCredits, 100)

  return (
    <div className="min-h-screen flex bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <Sidebar user={user} onLogout={onLogout} />
      <main className={`flex-1 p-8 transition-all duration-300 ${!isMobile && !isCollapsed ? 'pl-72' : 'pl-8'}`}>
        <div className="space-y-8 ">

          {/* Header */}
          <PageHeader
            title="WALLET"
            subtitle="Manage your credits and view transaction history"
            actions={<RefreshButton onClick={() => { void refetchTransactions(); user.refetch?.(); }} loading={isLoading || isFetching} />}
          />

          {/* Wallet Overview Section */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <h2 
                className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                style={{ fontFamily: "'Seven Segment', sans-serif" }}
              >
                WALLET OVERVIEW
              </h2>
              <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
            </div>

            <div className="space-y-6">
              <ResourceBar 
                label="RU Balance" 
                used={currentBalance} 
                total={totalCredits} 
                unit=" RU" 
              />
              <ResourceBar 
                label="Total Used (Lifetime)" 
                used={usedCredits} 
                total={totalCredits} 
                unit=" RU" 
              />
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-neutral-100 dark:bg-black border border-neutral-300 dark:border-neutral-800/50 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 
                  className="text-2xl text-neutral-900 dark:text-neutral-100 tracking-wider"
                  style={{ fontFamily: "'Seven Segment', sans-serif" }}
                >
                  TRANSACTION HISTORY
                </h2>
                <div className="flex-1 h-px bg-neutral-300 dark:bg-neutral-800"></div>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-500">
                <div className="flex items-center gap-2">
                  <span className="whitespace-nowrap" style={mono}>Rows</span>
                  <select
                    value={String(pageSize)}
                    onChange={handlePageSizeChange}
                    className="px-2 py-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs"
                    style={mono}
                  >
                    <option value="3">3</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
                {hasPagination && (
                  <div className="flex items-center gap-2" style={mono}>
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || isLoading}
                      className="h-7 w-7 text-neutral-600 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 disabled:opacity-50"
                    >
                      ‹
                    </button>
                    <span className="text-neutral-700 dark:text-neutral-400">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || isLoading}
                      className="h-7 w-7 text-neutral-600 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-300 disabled:opacity-50"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 overflow-hidden">
              {isLoading && transactions.length === 0 ? (
                <div className="p-8 w-32 h-32 items-center text-center">
                  <LoadingAnimation  />
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-500" style={mono}>
                    No transactions yet
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800/50">
                  {transactions.map((tx) => {
                    const isCredit = tx.type === 'credit' || tx.type === 'refund'
                    const typeLabel = tx.type === 'credit' ? 'Credit' : tx.type === 'debit' ? 'Usage' : tx.type === 'refund' ? 'Refund' : tx.type
                    
                    return (
                      <div key={tx.uuid} className="p-4 hover:bg-neutral-100 dark:hover:bg-neutral-800/20 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <span className={`w-2 h-2 rounded-full mt-1.5 ${isCredit ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200" style={mono}>
                                  {tx.description}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  isCredit 
                                    ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                                    : 'text-red-600 dark:text-red-400 bg-red-500/10'
                                }`} style={mono}>
                                  {typeLabel}
                                </span>
                                {(tx.metadata as any)?.admin_action && (
                                  <span className="text-xs px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 bg-amber-500/10" style={mono}>
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-600 dark:text-neutral-500" style={mono}>
                                <span className={isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                  {isCredit ? '+' : ''}{tx.amount.toLocaleString()} RU
                                </span>
                                <span>Balance: {tx.balance.toLocaleString()} RU</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-600 uppercase tracking-wider whitespace-nowrap" style={mono}>
                              {formatTimestamp(tx.createdAt)}
                            </span>
                            <button
                              onClick={() => {
                                setSelectedTransaction(tx)
                                setShowDisputeModal(true)
                              }}
                              className="text-[10px] px-2 py-1 border border-neutral-300 dark:border-neutral-700 hover:border-red-500 hover:text-red-500 transition-colors"
                              style={mono}
                            >
                              DISPUTE
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showDisputeModal && (
        <DisputeModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowDisputeModal(false)
            setSelectedTransaction(null)
          }}
        />
      )}
    </div>
  )
}

/* ─── Dispute Modal ─── */

function DisputeModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null
  onClose: () => void
}) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Dispute Transaction" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="p-4 border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-orange-900 dark:text-orange-100 font-medium mb-1" style={mono}>
                Feature Not Available
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-300" style={mono}>
                Transaction disputes are not available at this time. Please contact support if you have concerns about a transaction.
              </p>
            </div>
          </div>
        </div>

        {transaction && (
          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-300 dark:border-neutral-800/50 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 dark:text-neutral-500 mb-3" style={mono}>
              Transaction Details
            </div>
            <div className="space-y-2 text-xs" style={mono}>
              <div className="flex justify-between">
                <span className="text-neutral-500">ID:</span>
                <span className="text-neutral-900 dark:text-neutral-100">{transaction.uuid.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Type:</span>
                <span className="text-neutral-900 dark:text-neutral-100 uppercase">{transaction.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Amount:</span>
                <span className="text-neutral-900 dark:text-neutral-100">{transaction.amount} RU</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Description:</span>
                <span className="text-neutral-900 dark:text-neutral-100 text-right max-w-[200px]">{transaction.description}</span>
              </div>
              {(transaction.metadata as any)?.note && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Note:</span>
                  <span className="text-neutral-900 dark:text-neutral-100 text-right max-w-[200px]">{(transaction.metadata as any).note}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
