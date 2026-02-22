// SAVR Push Notifications Service
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { supabase } from './supabase'
import Constants from 'expo-constants'
import { userPreferencesService } from './UserPreferencesService'

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

class NotificationsService {
  private pushToken: string | null = null
  private hasShownRLSWarning = false // Track if RLS warning has been shown this session
  
  // Smart notification scheduling for user retention
  async scheduleSmartNotifications(userId: string, pantryItems?: any[]): Promise<void> {
    try {
      // Check user notification preferences
      const preferences = await userPreferencesService.loadPreferences(userId)
      const notificationPrefs = preferences?.notifications
      
      // If push notifications are disabled, cancel all and return
      if (notificationPrefs && !notificationPrefs.pushNotifications) {
        await Notifications.cancelAllScheduledNotificationsAsync()
        console.log('📵 Notifications disabled by user preferences')
        return
      }
      
      // Cancel existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync()
      
      // Schedule weekly reminders only if enabled
      if (!notificationPrefs || notificationPrefs.weeklyReminders) {
        // Schedule pantry check reminder (Wednesday 7 PM)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Pantry Check!',
            body: 'Check your pantry for expiring items',
            data: { type: 'pantry_check', screen: '/(tabs)/pantry' }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 4, // Wednesday
            hour: 19,
            minute: 0
          }
        })
        
        // Schedule savings update (Friday 8 PM)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Weekly Savings Update!',
            body: 'See how much you saved this week with SAVR',
            data: { type: 'savings_update', screen: '/budget-tracking' }
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: 6, // Friday
            hour: 20,
            minute: 0
          }
        })
        
        // Recipe-related notifications disabled – no cooking inspiration scheduled
      }
      
      // Schedule expiry notifications for pantry items (only if expiry alerts enabled)
      if (pantryItems && pantryItems.length > 0) {
        if (!notificationPrefs || notificationPrefs.expiryAlerts) {
          await this.scheduleExpiryNotifications(pantryItems)
        }
      }
      
      console.log('✅ Smart notifications scheduled')
    } catch (error) {
      console.error('Error scheduling notifications:', error)
    }
  }
  
  // Schedule notifications for expiring pantry items
  async scheduleExpiryNotifications(pantryItems: any[]): Promise<void> {
    try {
      const now = new Date()
      let scheduledCount = 0
      
      for (const item of pantryItems) {
        if (!item.expiry_date) continue
        
        const expiryDate = new Date(item.expiry_date)
        const diffTime = expiryDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        // Only schedule for future expiry dates (not expired items)
        if (diffDays < 0) continue
        
        // Schedule notification 3 days before expiry (if item expires in 3+ days)
        if (diffDays >= 3) {
          const notificationDate = new Date(expiryDate)
          notificationDate.setDate(notificationDate.getDate() - 3)
          notificationDate.setHours(10, 0, 0, 0) // 10 AM
          
          // Only schedule if the 3-day warning date is in the future
          if (notificationDate > now) {
            const secondsUntilNotification = Math.floor((notificationDate.getTime() - now.getTime()) / 1000)
            
            // Ensure it's a positive number (safety check)
            if (secondsUntilNotification > 0) {
              await Notifications.scheduleNotificationAsync({
              content: {
                title: `${item.name} Expiring Soon!`,
                body: `${item.name} expires in 3 days. Use it before it goes bad!`,
                  data: { 
                    type: 'expiry_warning',
                    itemId: item.id,
                    itemName: item.name,
                    screen: '/(tabs)/pantry'
                  }
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                  seconds: secondsUntilNotification
                }
              })
              scheduledCount++
            }
          }
        }
        
        // Schedule notification on expiry day (if item expires today or in the future)
        if (diffDays >= 0) {
          const notificationDate = new Date(expiryDate)
          notificationDate.setHours(9, 0, 0, 0) // 9 AM
          
          // Only schedule if expiry day is in the future (or today but not past 9 AM)
          if (notificationDate > now) {
            const secondsUntilNotification = Math.floor((notificationDate.getTime() - now.getTime()) / 1000)
            
            // Ensure it's a positive number (safety check)
            if (secondsUntilNotification > 0) {
              await Notifications.scheduleNotificationAsync({
              content: {
                title: `${item.name} Expires Today!`,
                body: `Use ${item.name} today or freeze it to prevent waste`,
                  data: { 
                    type: 'expiry_today',
                    itemId: item.id,
                    itemName: item.name,
                    screen: '/(tabs)/pantry'
                  }
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                  seconds: secondsUntilNotification
                }
              })
              scheduledCount++
            }
          }
        }
      }
      
      console.log(`✅ Expiry notifications scheduled: ${scheduledCount} notifications for ${pantryItems.length} items`)
    } catch (error) {
      console.error('Error scheduling expiry notifications:', error)
    }
  }
  
  // Recipe notifications disabled – no notifications associated with recipes
  async notifyRecipeSuggestion(_recipeName: string, _matchPercentage: number, _userId?: string): Promise<void> {
    // No-op: recipe notifications are disabled
  }
  
  // Send immediate notification for important events
  async sendInstantNotification(notification: {
    title: string
    body: string
    data?: any
  }, userId?: string): Promise<void> {
    try {
      // Check user notification preferences if userId provided
      if (userId) {
        const preferences = await userPreferencesService.loadPreferences(userId)
        const notificationPrefs = preferences?.notifications
        
        // If push notifications are disabled, don't send
        if (notificationPrefs && !notificationPrefs.pushNotifications) {
          return
        }
        
        // Check specific notification type preferences
      const notificationType = notification.data?.type
      const isListUpdate = notificationType === 'list_update' ||
        notificationType === 'item_added' ||
        notificationType === 'item_deleted' ||
        notificationType === 'item_completed' ||
        notificationType === 'item_uncompleted' ||
        notificationType === 'item_updated'

      if (isListUpdate && notificationPrefs && !notificationPrefs.listUpdates) {
          return
        }
        // Recipe notifications disabled – never send recipe-related notifications
        if (notificationType === 'recipe_suggestion') {
          return
        }
        if (notificationType === 'expiry_alert' && notificationPrefs && !notificationPrefs.expiryAlerts) {
          return
        }
      }
      
      await Notifications.scheduleNotificationAsync({
        content: notification,
        trigger: null // Send immediately
      })
    } catch (error) {
      console.error('Error sending instant notification:', error)
    }
  }

  // Register for push notifications and save token
  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check if running on physical device
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices')
        return null
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission not granted')
        return null
      }

      // Get push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      
      if (!projectId) {
        console.log('No project ID found. Push notifications require EAS build.')
        return null
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      })

      this.pushToken = token.data

      // Save token to database
      await this.savePushToken(token.data)

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6A9571',
        })
      }

      return token.data
    } catch (error) {
      console.error('Error registering for push notifications:', error)
      return null
    }
  }

  // Save push token to database
  private async savePushToken(token: string): Promise<void> {
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors gracefully
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          console.log('⚠️ Refresh token invalid - skipping push token save (user needs to sign in again)')
          return
        }
        console.error('Error getting user for push token:', authError)
        return
      }
      
      if (!userData.user) return

      // Use upsert to handle both insert and update atomically
      // This prevents duplicate key errors from race conditions
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userData.user.id,
          token,
          device_name: Device.deviceName || 'Unknown Device',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'token', // Use token as the conflict target
          ignoreDuplicates: false, // Update existing records
        })

      if (error) {
        if (error.code === '42501') {
          // RLS policy issue - provide helpful instructions (only show once per session)
          if (!this.hasShownRLSWarning) {
            this.hasShownRLSWarning = true
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('⚠️  SUPABASE RLS POLICY NEEDS UPDATE');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Your push_tokens table needs RLS policies');
            console.log('\n🔧 Quick Fix:');
            console.log('   1. Open Supabase Dashboard → SQL Editor');
            console.log('   2. Run: fix-push-tokens-rls-complete.sql');
            console.log('   3. Reload the app');
            console.log('\n💡 Push notifications will work after this fix');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          }
        } else {
          console.error('Error saving push token:', error);
        }
      } else {
        console.log('✅ Push token saved successfully')
      }
    } catch (error) {
      console.error('Error saving push token:', error)
    }
  }

  // Send notification to specific user
  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      // Check user notification preferences
      const preferences = await userPreferencesService.loadPreferences(userId)
      const notificationPrefs = preferences?.notifications
      
      // If push notifications are disabled, don't send
      if (notificationPrefs && !notificationPrefs.pushNotifications) {
        return
      }
      
      // Check specific notification type preferences
      const notificationType = data?.type
      const isListUpdate = notificationType === 'list_update' ||
        notificationType === 'item_added' ||
        notificationType === 'item_deleted' ||
        notificationType === 'item_completed' ||
        notificationType === 'item_uncompleted' ||
        notificationType === 'item_updated'

      if (isListUpdate && notificationPrefs && !notificationPrefs.listUpdates) {
        return
      }
      // Recipe notifications disabled – never send recipe-related notifications
      if (notificationType === 'recipe_suggestion') {
        return
      }
      if (notificationType === 'expiry_alert' && notificationPrefs && !notificationPrefs.expiryAlerts) {
        return
      }
      
      // Get user's push tokens
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId)

      if (!tokens || tokens.length === 0) return

      // Send to all user's devices
      for (const tokenData of tokens) {
        await this.sendPushNotification(tokenData.token, title, body, data)
      }
    } catch (error) {
      console.error('Error sending notification to user:', error)
    }
  }

  // Send notification to all list collaborators (including owner) except current user
  async notifyListCollaborators(
    listId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      // Prefer edge function (uses service role to access tokens across users)
      try {
        const { data: fnData, error: fnError } = await (supabase as any).functions.invoke(
          'notify-list-collaborators',
          { body: { listId, title, body, data } }
        )
        if (!fnError && fnData?.success) {
          return
        }
      } catch (invokeError) {
        console.warn('Edge function notify failed, falling back to client', invokeError)
      }

      const { data: userData, error: authError } = await supabase.auth.getUser()
      
      // Handle refresh token errors gracefully
      if (authError) {
        if (authError.message?.includes('Refresh Token') || authError.message?.includes('refresh_token')) {
          console.log('⚠️ Refresh token invalid - skipping notification (user needs to sign in again)')
          return
        }
        console.error('Error getting user for notification:', authError)
        return
      }
      
      if (!userData.user) return

      // Get the list to find the owner
      const { data: listData } = await supabase
        .from('lists')
        .select('owner_id')
        .eq('id', listId)
        .single()

      if (!listData) return

      // Get all collaborators for this list (excluding current user)
      const { data: collaborators } = await supabase
        .from('collaborators')
        .select('user_id')
        .eq('list_id', listId)
        .eq('accepted', true)
        .neq('user_id', userData.user.id) // Exclude current user

      // Collect all users to notify (owner + collaborators)
      const usersToNotify = new Set<string>()

      // Add owner if not the current user
      if (listData.owner_id && listData.owner_id !== userData.user.id) {
        usersToNotify.add(listData.owner_id)
      }

      // Add collaborators
      if (collaborators) {
        collaborators.forEach(collab => {
          if (collab.user_id !== userData.user.id) {
            usersToNotify.add(collab.user_id)
          }
        })
      }

      // Send notification to each user
      for (const userId of usersToNotify) {
        await this.sendNotificationToUser(
          userId,
          title,
          body,
          { ...data, listId }
        )
      }
    } catch (error) {
      console.error('Error notifying collaborators:', error)
    }
  }

  // Send push notification via Expo's push service
  private async sendPushNotification(
    expoPushToken: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high' as const,
    }

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      })
    } catch (error) {
      console.error('Error sending push notification:', error)
    }
  }

  // Listen for notification responses (when user taps notification)
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback)
  }

  // Listen for notifications received while app is in foreground
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback)
  }

  // Get current push token
  getPushToken(): string | null {
    return this.pushToken
  }
}

export const notificationsService = new NotificationsService()

// Helper function to format notification messages
export function formatListNotification(
  action: 'added' | 'completed' | 'uncompleted' | 'removed',
  userName: string,
  itemName: string,
  listName: string
): { title: string; body: string } {
  switch (action) {
    case 'added':
      return {
        title: `${listName}`,
        body: `${userName} added ${itemName}`,
      }
    case 'completed':
      return {
        title: `${listName}`,
        body: `${userName} completed ${itemName} ✓`,
      }
    case 'uncompleted':
      return {
        title: `${listName}`,
        body: `${userName} uncompleted ${itemName}`,
      }
    case 'removed':
      return {
        title: `${listName}`,
        body: `${userName} removed ${itemName}`,
      }
    default:
      return {
        title: listName,
        body: `${userName} made changes`,
      }
  }
}

