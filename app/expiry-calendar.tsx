// Expiry Calendar - Visual calendar showing when items expire
import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { usePantry } from '../lib/PantryContext'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

const { width } = Dimensions.get('window')

export default function ExpiryCalendarScreen() {
  const router = useRouter()
  const { items, getExpiringItems } = usePantry()
  const [selectedWeek, setSelectedWeek] = useState(0) // 0 = this week, 1 = next week, etc.

  // Calculate days until expiry
  const calculateDaysUntilExpiry = (expiryDate?: string): number | null => {
    if (!expiryDate) return null
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Group items by expiry date
  const itemsByDate = useMemo(() => {
    const grouped: { [key: string]: any[] } = {}
    
    items.forEach(item => {
      if (!item.expiry_date) return
      
      const daysLeft = calculateDaysUntilExpiry(item.expiry_date)
      if (daysLeft === null || daysLeft < -7) return // Skip expired items older than 1 week
      
      const expiryDate = new Date(item.expiry_date)
      const dateKey = expiryDate.toISOString().split('T')[0]
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      
      grouped[dateKey].push({
        ...item,
        daysLeft
      })
    })
    
    return grouped
  }, [items])

  // Get next 14 days
  const next14Days = useMemo(() => {
    const days = []
    const today = new Date()
    
    for (let i = 0; i < 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dateKey = date.toISOString().split('T')[0]
      const dayItems = itemsByDate[dateKey] || []
      
      days.push({
        date,
        dateKey,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        items: dayItems,
        isToday: i === 0,
        isTomorrow: i === 1
      })
    }
    
    return days
  }, [itemsByDate])

  // Get urgency color
  const getUrgencyColor = (daysLeft: number | null): string => {
    if (daysLeft === null) return '#8E8E93'
    if (daysLeft <= 0) return '#FF3B30' // Red - expired
    if (daysLeft <= 1) return '#FF6B6B' // Dark orange - 1 day
    if (daysLeft <= 3) return '#FF9500' // Orange - 3 days
    if (daysLeft <= 7) return '#FFA726' // Light orange - within week
    return '#34C759' // Green - fresh
  }

  const totalExpiringItems = useMemo(() => {
    return items.filter(item => {
      const daysLeft = calculateDaysUntilExpiry(item.expiry_date)
      return daysLeft !== null && daysLeft >= 0 && daysLeft <= 14
    }).length
  }, [items])

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      {/* Header */}
      <LinearGradient
        colors={['#FEFCF6', '#FFE9E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1D1D1F" />
          </Pressable>
          <Text style={styles.headerTitle}>Expiry Calendar</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <Text style={styles.headerSubtitle}>
          {totalExpiringItems} {totalExpiringItems === 1 ? 'item' : 'items'} expiring in next 2 weeks
        </Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar Days */}
        {next14Days.map((day, index) => (
          <View key={day.dateKey} style={styles.dayCard}>
            {/* Day Header */}
            <View style={styles.dayHeader}>
              <View style={styles.dayHeaderLeft}>
                <Text style={[
                  styles.dayName,
                  day.isToday && styles.todayText
                ]}>
                  {day.isToday ? 'Today' : day.isTomorrow ? 'Tomorrow' : day.dayName}
                </Text>
                <Text style={styles.dayDate}>
                  {day.month} {day.dayNumber}
                </Text>
              </View>
              
              {day.items.length > 0 && (
                <View style={[
                  styles.itemCountBadge,
                  { backgroundColor: getUrgencyColor(day.items[0].daysLeft) + '20' }
                ]}>
                  <Text style={[
                    styles.itemCountText,
                    { color: getUrgencyColor(day.items[0].daysLeft) }
                  ]}>
                    {day.items.length} {day.items.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              )}
            </View>

            {/* Items Expiring This Day */}
            {day.items.length > 0 ? (
              <View style={styles.dayItems}>
                {day.items.map((item, itemIndex) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.itemRow,
                      itemIndex === day.items.length - 1 && styles.lastItemRow
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      router.push('/(tabs)/pantry')
                    }}
                  >
                    <View style={[
                      styles.itemDot,
                      { backgroundColor: getUrgencyColor(item.daysLeft) }
                    ]} />
                    <Text style={styles.itemIcon}>{item.icon}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemCategory}>
                        {item.category} • {item.location}
                      </Text>
                    </View>
                    <View style={styles.itemAction}>
                      <Text style={[
                        styles.itemStatus,
                        { color: getUrgencyColor(item.daysLeft) }
                      ]}>
                        {item.daysLeft === 0 ? 'Today' :
                         item.daysLeft! < 0 ? 'Expired' :
                         `${item.daysLeft}d`}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.noItemsContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.noItemsText}>No items expiring</Text>
              </View>
            )}
          </View>
        ))}

        {/* Empty State */}
        {totalExpiringItems === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>All Good!</Text>
            <Text style={styles.emptyText}>
              No items expiring in the next 2 weeks
            </Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  todayText: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 14,
    color: '#8E8E93',
  },
  itemCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayItems: {
    padding: 16,
    paddingTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  lastItemRow: {
    borderBottomWidth: 0,
  },
  itemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  itemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 2,
  },
  itemCategory: {
    fontSize: 12,
    color: '#8E8E93',
  },
  itemAction: {
    marginLeft: 12,
  },
  itemStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  noItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  noItemsText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1D1D1F',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
})

