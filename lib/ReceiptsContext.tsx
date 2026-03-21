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
            
            // Calculate new monthly total
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)
            const monthlyReceipts = updated.filter(r => {
              const dateStr = r.purchase_date || r.created_at
              return dateStr && new Date(dateStr) >= startOfMonth
            })
            const newMonthlyTotal = monthlyReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0)
            
            console.log(`✅ NEW RECEIPT ADDED TO BUDGET:`)
            console.log(`   💵 Receipt total: $${totalAmount.toFixed(2)}`)
            console.log(`   📊 New monthly total: $${newMonthlyTotal.toFixed(2)}`)
            console.log(`   🧾 Receipts this month: ${monthlyReceipts.length}`)
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
      // Ensure amount is a valid number
      const validAmount = typeof amount === 'number' && isFinite(amount) && amount >= 0 ? amount : 0
      console.log(`💰 Receipt ${receipt.id}: $${validAmount.toFixed(2)} (date: ${receipt.purchase_date || receipt.created_at})`)
      return sum + validAmount
    }, 0)
    
    // Ensure total is valid
    const validTotal = typeof total === 'number' && isFinite(total) && total >= 0 ? total : 0
    console.log(`📊 Monthly total: $${validTotal.toFixed(2)} from ${currentMonthReceipts.length} receipts`)
    return validTotal
  }

  const getWeeklySpending = (): { week: string; amount: number }[] => {
    // Use the same month window as getMonthlyReceipts so all budget views stay in sync
    const currentMonthReceipts = getMonthlyReceipts()

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
        const amount = receipt.total_amount || 0
        const validAmount = typeof amount === 'number' && isFinite(amount) && amount >= 0 ? amount : 0
        weeks[weekIndex].amount += validAmount
      }
    })

    return weeks
  }

  const getCategorySpending = (): { category: string; amount: number; color: string; icon: string }[] => {
    // Use the same month window as getMonthlyReceipts so category totals
    // line up with the main monthly total.
    const currentMonthReceipts = getMonthlyReceipts()

    const categorySums: { [key: string]: number } = {}
    
    currentMonthReceipts.forEach(receipt => {
      if (receipt.scan_result?.items) {
        receipt.scan_result.items.forEach((item: any) => {
          const category = item.category || 'Other'
          const price = typeof item.price === 'number' && isFinite(item.price) && item.price >= 0 ? item.price : 0
          const quantity = typeof item.quantity === 'number' && isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1
          const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())
          
          // Match the same calculation logic as ReceiptsService.saveReceipt:
          // - Weight-based items: price is already line total (don't multiply)
          // - Count-based items: price is unit price (multiply by quantity)
          const itemTotal = isWeightBased ? price : (price * quantity)
          const validItemTotal = typeof itemTotal === 'number' && isFinite(itemTotal) && itemTotal >= 0 ? itemTotal : 0
          categorySums[category] = (categorySums[category] || 0) + validItemTotal
        })
      }
    })

    const categoryColors: { [key: string]: string } = {
      'Produce': '#51CF66',
      'Dairy': '#339AF0',
      'Meat & Seafood': '#FF6B6B',
      'Meat, Poultry & Seafood': '#FF6B6B',
      'Pantry Staples': '#8B7355',
      'Pantry Staples & Essentials': '#8B7355',
      'Snacks': '#FFA726',
      'Snacks, Sweets & Desserts': '#FFA726',
      'Beverages': '#4DABF7',
      'Frozen': '#64B5F6',
      'Household & Cleaning': '#5E5CE6',
      'Other': '#868E96',
    }
    
    const categoryIcons: { [key: string]: string } = {
      'Produce': '🥬',
      'Dairy': '🥛',
      'Meat & Seafood': '🥩',
      'Meat, Poultry & Seafood': '🍗',
      'Pantry Staples': '🥫',
      'Pantry Staples & Essentials': '🧂',
      'Snacks': '🍿',
      'Snacks, Sweets & Desserts': '🍫',
      'Beverages': '☕',
      'Frozen': '❄️',
      'Household & Cleaning': '🧹',
      'Other': '🛒',
    }

    const rawCategories = Object.entries(categorySums)
      .map(([category, amount]) => ({
        category,
        amount,
        color: categoryColors[category] || '#868E96',
        icon: categoryIcons[category] || '🛒',
      }))

    // If item-level sums drift away from the authoritative monthly total
    // (due to OCR quirks, missing items, tax, etc.), gently normalize so
    // that the chart still adds up to the same total the user sees.
    const monthlyTotal = getMonthlyTotal()
    const totalCategoryAmount = rawCategories.reduce((sum, c) => sum + c.amount, 0)

    if (monthlyTotal > 0 && totalCategoryAmount > monthlyTotal * 1.05) {
      const scale = monthlyTotal / totalCategoryAmount
      return rawCategories
        .map(c => ({
          ...c,
          amount: c.amount * scale,
        }))
        .sort((a, b) => b.amount - a.amount)
    }

    return rawCategories.sort((a, b) => b.amount - a.amount)
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

