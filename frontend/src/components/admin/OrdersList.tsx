/**
 * Production-ready admin orders list component with error handling and loading states
 * This component demonstrates best practices for admin data fetching
 */

import React, { useState, useCallback } from 'react'
import { useAdminOrders } from '@/lib/hooks/useAdminOrders'
import { ruMessages, getUserFriendlyErrorMessage, formatDateRu, formatStatusRu } from '@/lib/api-service/messages-ru'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface AdminOrdersListProps {
  onStatusChange?: (orderId: number, newStatus: string) => Promise<void>
}

export function AdminOrdersList({ onStatusChange }: AdminOrdersListProps) {
  const { orders, loading, error, totalCount, page, pageSize, fetchOrders, retry, setPage, clearError } = useAdminOrders()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [orderSearch, setOrderSearch] = useState('')
  const [updating, setUpdating] = useState<Record<number, boolean>>({})

  // Fetch orders when filters change
  const handleFilterChange = useCallback(async () => {
    await fetchOrders(1, {
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    })
  }, [statusFilter, fetchOrders])

  const handleStatusUpdate = useCallback(
    async (orderId: number, newStatus: string) => {
      if (!onStatusChange) return

      setUpdating((prev) => ({ ...prev, [orderId]: true }))
      try {
        await onStatusChange(orderId, newStatus)
        // Refresh orders after successful update
        await fetchOrders(page)
      } finally {
        setUpdating((prev) => ({ ...prev, [orderId]: false }))
      }
    },
    [onStatusChange, fetchOrders, page],
  )

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{ruMessages.loadingOrders}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-destructive/20 rounded-lg p-6 bg-destructive/5">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-destructive mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive mb-2">{ruMessages.errorFetchingOrders}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {getUserFriendlyErrorMessage(error.code, error.detail)}
            </p>
            {error.isDeveloperError && import.meta.env.DEV && (
              <details className="mb-4 text-xs bg-black/5 p-2 rounded">
                <summary className="cursor-pointer font-mono text-muted-foreground">
                  {ruMessages.debugInfo}
                </summary>
                <pre className="mt-2 overflow-auto">{JSON.stringify(error.info, null, 2)}</pre>
              </details>
            )}
            <div className="flex gap-2">
              {error.isRetryable && (
                <Button size="sm" variant="outline" onClick={retry} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  {ruMessages.retry}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clearError}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">{ruMessages.noOrdersFound}</p>
        <p className="text-sm text-muted-foreground">{ruMessages.noOrdersText}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder={ruMessages.orderNumber}
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-input rounded-md text-sm"
        >
          <option value="ALL">{ruMessages.all}</option>
          <option value="Received">{ruMessages.statusReceived}</option>
          <option value="Confirmed">{ruMessages.statusConfirmed}</option>
          <option value="Shipped">{ruMessages.statusShipped}</option>
          <option value="Cancelled">{ruMessages.statusCancelled}</option>
        </select>
        <Button onClick={handleFilterChange} disabled={loading}>
          {ruMessages.loading}
        </Button>
      </div>

      {/* Orders Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium">{ruMessages.orderNumber}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{ruMessages.customer}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{ruMessages.phone}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{ruMessages.status}</th>
              <th className="px-4 py-2 text-left text-sm font-medium">{ruMessages.date}</th>
              <th className="px-4 py-2 text-right text-sm font-medium">{ruMessages.actions}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm font-mono">{order.order_number}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="font-medium">{order.user.fio}</div>
                  <div className="text-xs text-muted-foreground">{order.user.username}</div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{order.user.phone || '—'}</td>
                <td className="px-4 py-3 text-sm">
                  <Badge
                    variant="outline"
                    className={order.status === 'Cancelled' ? 'border-red-200 bg-red-50 text-red-700' : ''}
                  >
                    {formatStatusRu(order.status)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateRu(order.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={updating[order.id] || loading}
                      >
                        {updating[order.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {order.status === 'Received' && (
                        <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'Confirmed')}>
                          {ruMessages.statusConfirmed}
                        </DropdownMenuItem>
                      )}
                      {order.status === 'Confirmed' && (
                        <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'Shipped')}>
                          {ruMessages.statusShipped}
                        </DropdownMenuItem>
                      )}
                      {order.status !== 'Cancelled' && (
                        <DropdownMenuItem onClick={() => handleStatusUpdate(order.id, 'Cancelled')}>
                          {ruMessages.statusCancelled}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ruMessages.itemsPerPage}: {orders.length} {ruMessages.of} {totalCount}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={orders.length < pageSize}
          >
            Далее
          </Button>
        </div>
      </div>
    </div>
  )
}
