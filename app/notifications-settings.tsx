// SAVR Notifications Settings
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/AuthContext'
import { notificationsService } from '../lib/NotificationsService'
import { userPreferencesService } from '../lib/UserPreferencesService'
import { useToast } from '../lib/ToastContext'
import { logger } from '../lib/Logger'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as Haptics from 'expo-haptics'
import { 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

export default function NotificationsSettingsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined')
  const [isDevice, setIsDevice] = useState(false)
  
  const [settings, setSettings] = useState({
    pushNotifications: true,
    expiryAlerts: true,
    listUpdates: true,
    weeklyReminders: true,
  })

  useEffect(() => {
    checkPermissions()
    loadSettings()
  }, [])

  const checkPermissions = async () => {
    try {
      const isPhysicalDevice = Device.isDevice
      setIsDevice(isPhysicalDevice)
      
      if (isPhysicalDevice) {
        const { status } = await Notifications.getPermissionsAsync()
        setPermissionStatus(status)
      }
    } catch (error) {
      logger.error('Error checking notification permissions', { error })
    }
  }

  const loadSettings = async () => {
    try {
      if (user?.id) {
        const preferences = await userPreferencesService.loadPreferences(user.id)
        if (preferences?.notifications) {
          setSettings({
            pushNotifications: preferences.notifications.pushNotifications ?? true,
            expiryAlerts: preferences.notifications.expiryAlerts ?? true,
            listUpdates: preferences.notifications.listUpdates ?? true,
            weeklyReminders: preferences.notifications.weeklyReminders ?? true,
          })
        }
      }
    } catch (error) {
      logger.error('Error loading notification settings', { error })
    }
  }

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      if (user?.id) {
        const currentPreferences = await userPreferencesService.loadPreferences(user.id) || {}
        const updatedPreferences = {
          ...currentPreferences,
          notifications: newSettings,
        }
        
        const { error } = await userPreferencesService.savePreferences(updatedPreferences as any, user.id)
        if (error) {
          logger.error('Error saving notification settings', { error })
          showToast('Failed to save notification settings. Please try again.', { kind: 'error', durationMs: 3500 })
          return
        }
        
        setSettings(newSettings)
        
        // Update scheduled notifications based on preferences
        if (newSettings.pushNotifications && newSettings.weeklyReminders) {
          // Reschedule weekly reminders if enabled
          // This will be handled by the service when it checks preferences
        } else if (!newSettings.pushNotifications || !newSettings.weeklyReminders) {
          // Cancel weekly reminders if disabled
          await Notifications.cancelAllScheduledNotificationsAsync()
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      logger.error('Error saving notification settings', { error })
      showToast('Failed to save notification settings. Please try again.', { kind: 'error', durationMs: 3500 })
    }
  }

  const requestPermissions = async () => {
    try {
      setLoading(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      if (!Device.isDevice) {
        showToast('Push notifications require a physical device (not simulator/Expo Go).', { kind: 'warning', durationMs: 4500 })
        setLoading(false)
        return
      }

      const token = await notificationsService.registerForPushNotifications()
      
      if (token) {
        await checkPermissions()
        showToast('Notifications enabled.', { kind: 'success' })
      } else {
        showToast('Permission denied. Enable notifications in your device settings.', { kind: 'warning', durationMs: 4500 })
      }
    } catch (error) {
      logger.error('Error requesting notification permissions', { error })
      showToast('Failed to enable notifications. Please try again.', { kind: 'error', durationMs: 3500 })
    } finally {
      setLoading(false)
    }
  }

  const toggleSetting = async (key: keyof typeof settings) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    }
    
    // If disabling push notifications, disable all
    if (key === 'pushNotifications' && !newSettings.pushNotifications) {
      newSettings.expiryAlerts = false
      newSettings.listUpdates = false
      newSettings.weeklyReminders = false
    }
    
    // If enabling any notification type, ensure push notifications are enabled
    if (key !== 'pushNotifications' && newSettings[key] && !newSettings.pushNotifications) {
      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Enable Push Notifications',
          'Please enable push notifications first to receive this type of notification.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Enable', onPress: requestPermissions },
          ]
        )
        return
      }
      newSettings.pushNotifications = true
    }
    
    await saveSettings(newSettings)
  }

  const renderSettingRow = (
    title: string,
    description: string,
    key: keyof typeof settings,
    icon: string
  ) => {
    const isEnabled = settings[key]
    const canToggle = key === 'pushNotifications' || settings.pushNotifications
    
    return (
      <Pressable
        style={styles.settingRow}
        onPress={() => canToggle && toggleSetting(key)}
        disabled={!canToggle && key !== 'pushNotifications'}
      >
        <View style={styles.settingLeft}>
          <Text style={styles.settingIcon}>{icon}</Text>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingTitle, !canToggle && styles.settingTitleDisabled]}>
              {title}
            </Text>
            <Text style={[styles.settingDescription, !canToggle && styles.settingDescriptionDisabled]}>
              {description}
            </Text>
          </View>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={() => canToggle && toggleSetting(key)}
          disabled={!canToggle && key !== 'pushNotifications'}
          trackColor={{ false: '#E5E5EA', true: '#6A9571' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E5EA"
        />
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      />
      <LinearGradient
        colors={['rgba(106, 149, 113, 0.15)', 'transparent', 'transparent']}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 1, y: 1 }}
        style={styles.glassmorphicOverlay}
      />
      
      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
        </View>

        {/* Permission Status Card */}
        <View style={styles.permissionCard}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.permissionCardGradient}
          >
            <View style={styles.permissionHeader}>
              <Text style={styles.permissionIcon}>
                {permissionStatus === 'granted' ? '✅' : '⚠️'}
              </Text>
              <View style={styles.permissionTextContainer}>
                <Text style={styles.permissionTitle}>
                  {permissionStatus === 'granted' 
                    ? 'Notifications Enabled' 
                    : permissionStatus === 'denied'
                    ? 'Notifications Disabled'
                    : 'Enable Notifications'}
                </Text>
                <Text style={styles.permissionDescription}>
                  {permissionStatus === 'granted'
                    ? 'You will receive push notifications from SAVR'
                    : !isDevice
                    ? 'Push notifications require a physical device'
                    : 'Tap below to enable push notifications'}
                </Text>
              </View>
            </View>
            {permissionStatus !== 'granted' && isDevice && (
              <Pressable
                style={styles.enableButton}
                onPress={requestPermissions}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#6A9571', '#8AB896']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.enableButtonGradient}
                >
                  <Text style={styles.enableButtonText}>
                    {loading ? 'Enabling...' : 'Enable Push Notifications'}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}
          </LinearGradient>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          
          <View style={styles.settingsCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.settingsCardGradient}
            >
              {renderSettingRow(
                'Push Notifications',
                'Receive notifications on your device',
                'pushNotifications',
                '📱'
              )}
              {renderSettingRow(
                'Expiry Alerts',
                'Get notified when items are about to expire',
                'expiryAlerts',
                '⏰'
              )}
              {renderSettingRow(
                'List Updates',
                'Notifications when lists are shared or updated',
                'listUpdates',
                '📋'
              )}
              {renderSettingRow(
                'Weekly Reminders',
                'Weekly pantry check and savings updates',
                'weeklyReminders',
                '📅'
              )}
            </LinearGradient>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            💡 You can change notification permissions anytime in your device settings.
          </Text>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glassmorphicOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: responsiveDims.isSmallScreen ? 60 : 70,
    paddingHorizontal: responsivePadding.lg,
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#6A9571',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  permissionCard: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  permissionCardGradient: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  permissionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  permissionTextContainer: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  enableButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  enableButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  settingsCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  settingsCardGradient: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142, 142, 147, 0.1)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  settingTitleDisabled: {
    color: '#8E8E93',
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  settingDescriptionDisabled: {
    color: '#C7C7CC',
  },
  infoSection: {
    marginTop: 8,
    padding: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomSpacing: {
    height: 20,
  },
})
