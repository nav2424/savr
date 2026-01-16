// SAVR Receipts Context - Real-time receipt management with auto budget updates
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'
import { receiptsService, Receipt } from './ReceiptsService'

interface ReceiptsContextType {
  receipts: Receipt[]
  loading: boolean
  error: string | null
  refreshReceipts: () => Promise<void>
  getReceiptById: (id: string) => Promise<Receipt | null>
  getMonthlyTotal: () => number
  getMonthlyReceipts: () => Receipt[]
  getWeeklySpending: () => { week: string; amount: number }[]
  getCategorySpending: () => { category: string; amount: number; color: string; icon: string }[]
}

const ReceiptsContext = createContext<ReceiptsContextType | undefined>(undefined)

export function ReceiptsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load receipts when user changes
  useEffect(() => {
    if (user) {
      loadReceipts()
      
      // Subscribe to realtime changes
      const channel = supabase
        .channel(`receipts_changes_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'receipts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('📡 Receipt real-time update received:', payload)
            handleRealtimeUpdate(payload)
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Receipts real-time subscription active')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // Transient errors are normal - fallback refresh will handle updates
            console.warn(`⚠️ Receipts real-time subscription ${status} - using fallback refresh`)
          }
        })

      return () => {
        channel.unsubscribe()
      }
    } else {
      setReceipts([])
      setLoading(false)
    }
  }, [user])

  const loadReceipts = async () => {
    if (!user) {
      setReceipts([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const { success, receipts: userReceipts, error: fetchError } = await receiptsService.getUserReceipts(user.id)

      if (!success || fetchError) {
        throw fetchError || new Error('Failed to load receipts')
      }

      setReceipts(userReceipts || [])
      console.log(`✅ Loaded ${userReceipts?.length || 0} receipts for budget tracking`)
    } catch (err: any) {
      console.error('Error loading receipts:', err)
      setError(err.message || 'Failed to load receipts')
    } finally {
      setLoading(false)
    }
  }

  const handleRealtimeUpdate = (payload: any) => {
    // Handle both 'eventType' and 'event' field names (Supabase can use either)
    const eventType = payload.eventType || payload.event
    const { new: newRecord, old: oldRecord } = payload
    
    if (!eventType) {
      console.warn('⚠️ Receipt update received without eventType/event:', payload)
      // Fallback: refresh receipts if we can't determine the event
      loadReceipts()
      return
    }
    
    console.log(`📊 Receipt ${eventType}: Budget will auto-update!`)

    switch (eventType) {
      case 'INSERT':
        if (newRecord) {
          setReceipts(prev => {
            // Avoid duplicates
            if (prev.some(r => r.id === newRecord.id)) {
              console.log(`⚠️ Receipt ${newRecord.id} already exists, skipping duplicate`)
              return prev
            }
            const updated = [newRecord as Receipt, ...prev]
            const totalAmount = newRecord.total_amount || 0
            console.log(`✅ New receipt added: $${totalAmount.toFixed(2)} - Budget will auto-update!`)
            console.log(`📊 Receipts count: ${prev.length} → ${updated.length}`)
            return updated
          })
        }
        break
      case 'UPDATE':
        if (newRecord) {
          setReceipts(prev => prev.map(receipt => 
            receipt.id === newRecord.id ? newRecord as Receipt : receipt
          ))
          console.log(`✅ Receipt updated: $${newRecord.total_amount || 0} - Budget auto-updated!`)
        }
        break
      case 'DELETE':
        if (oldRecord) {
          setReceipts(prev => prev.filter(receipt => receipt.id !== oldRecord.id))
          console.log(`✅ Receipt deleted - Budget auto-updated!`)
        }
        break
      default:
        console.warn(`⚠️ Unknown receipt event type: ${eventType}`)
        // Fallback: refresh receipts for unknown events
        loadReceipts()
    }
  }

  const refreshReceipts = async (): Promise<void> => {
    await loadReceipts()
  }

  const getReceiptById = async (id: string): Promise<Receipt | null> => {
    const { success, receipt } = await receiptsService.getReceipt(id)
    return success && receipt ? receipt : null
  }

  const getMonthlyReceipts = (): Receipt[] => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    startOfMonth.setMinutes(0, 0, 0)
    startOfMonth.setSeconds(0, 0, 0)
    startOfMonth.setMilliseconds(0)

    const endOfMonth = new Date(startOfMonth)
    endOfMonth.setMonth(endOfMonth.getMonth() + 1)

    return receipts.filter(receipt => {
      // Try purchase_date first, then created_at
      const dateString = receipt.purchase_date || receipt.created_at
      if (!dateString) {
        console.warn('⚠️ Receipt missing date:', receipt.id)
        return false
      }
      
      const receiptDate = new Date(dateString)
      receiptDate.setHours(0, 0, 0, 0)
      receiptDate.setMinutes(0, 0, 0)
      receiptDate.setSeconds(0, 0, 0)
      receiptDate.setMilliseconds(0)
      
      const isInMonth = receiptDate >= startOfMonth && receiptDate < endOfMonth
      
      if (!isInMonth && receipt.total_amount) {
        console.log(`📅 Receipt ${receipt.id} date: ${dateString} (${receiptDate.toISOString()}) - not in current month (${startOfMonth.toISOString()} to ${endOfMonth.toISOString()})`)
      }
      
      return isInMonth
    })
  }

  const getMonthlyTotal = (): number => {
    const currentMonthReceipts = getMonthlyReceipts()
    const total = currentMonthReceipts.reduce((sum, receipt) => {
      const amount = receipt.total_amount || 0
      console.log(`💰 Receipt ${receipt.id}: $${amount.toFixed(2)} (date: ${receipt.purchase_date || receipt.created_at})`)
      return sum + amount
    }, 0)
    
    console.log(`📊 Monthly total: $${total.toFixed(2)} from ${currentMonthReceipts.length} receipts`)
    return total
  }

  const getWeeklySpending = (): { week: string; amount: number }[] => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const currentMonthReceipts = receipts.filter(receipt => {
      const receiptDate = new Date(receipt.purchase_date || receipt.created_at)
      return receiptDate >= startOfMonth
    })

    const weeks = [
      { week: 'Week 1', amount: 0, startDay: 1, endDay: 7 },
      { week: 'Week 2', amount: 0, startDay: 8, endDay: 14 },
      { week: 'Week 3', amount: 0, startDay: 15, endDay: 21 },
      { week: 'Week 4', amount: 0, startDay: 22, endDay: 31 },
    ]

    currentMonthReceipts.forEach(receipt => {
      const date = new Date(receipt.purchase_date || receipt.created_at)
      const day = date.getDate()
      
      const weekIndex = weeks.findIndex(w => day >= w.startDay && day <= w.endDay)
      if (weekIndex !== -1) {
        weeks[weekIndex].amount += receipt.total_amount || 0
      }
    })

    return weeks
  }

  const getCategorySpending = (): { category: string; amount: number; color: string; icon: string }[] => {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const currentMonthReceipts = receipts.filter(receipt => {
      const receiptDate = new Date(receipt.purchase_date || receipt.created_at)
      return receiptDate >= startOfMonth
    })

    const categorySums: { [key: string]: number } = {}
    
    currentMonthReceipts.forEach(receipt => {
      if (receipt.scan_result?.items) {
        receipt.scan_result.items.forEach((item: any) => {
          const category = item.category || 'Other'
          const price = typeof item.price === 'number' ? item.price : 0
          categorySums[category] = (categorySums[category] || 0) + price
        })
      }
    })

    const categoryColors: { [key: string]: string } = {
      'Produce': '#51CF66',
      'Dairy': '#339AF0',
      'Meat & Seafood': '#FF6B6B',
      'Pantry Staples': '#8B7355',
      'Snacks': '#FFA726',
      'Beverages': '#4DABF7',
      'Other': '#868E96',
    }
    
    const categoryIcons: { [key: string]: string } = {
      'Produce': '🥬',
      'Dairy': '🥛',
      'Meat & Seafood': '🥩',
      'Pantry Staples': '🥫',
      'Snacks': '🍿',
      'Beverages': '☕',
      'Other': '🛒',
    }

    return Object.entries(categorySums)
      .map(([category, amount]) => ({
        category,
        amount,
        color: categoryColors[category] || '#868E96',
        icon: categoryIcons[category] || '🛒',
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  return (
    <ReceiptsContext.Provider
      value={{
        receipts,
        loading,
        error,
        refreshReceipts,
        getReceiptById,
        getMonthlyTotal,
        getMonthlyReceipts,
        getWeeklySpending,
        getCategorySpending,
      }}
    >
      {children}
    </ReceiptsContext.Provider>
  )
}

export function useReceipts() {
  const context = useContext(ReceiptsContext)
  if (context === undefined) {
    throw new Error('useReceipts must be used within a ReceiptsProvider')
  }
  return context
}

