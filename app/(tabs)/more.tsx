// SAVR More - Clean Settings & Profile Hub
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import { useSimpleTheme } from '../../lib/SimpleThemeContext'
import { useAuth } from '../../lib/AuthContext'
import * as Haptics from 'expo-haptics'
import SageAssistantV2 from '../../components/SageAssistantV2'
import { 
  responsivePadding, 
  responsiveFonts, 
  responsiveSpacing,
  getResponsiveDimensions 
} from '../../lib/responsive'

const { width } = Dimensions.get('window')
const responsiveDims = getResponsiveDimensions()

// Settings menu items
const SETTINGS_ITEMS = [
  {
    id: 'profile',
    title: 'Profile & Settings',
    description: 'Manage your account & preferences',
    icon: '👤',
    route: '/profile-settings',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Manage notification preferences',
    icon: '🔔',
    route: '/notifications-settings',
  },
  {
    id: 'receipts',
    title: 'Receipt History',
    description: 'View scanned receipts',
    icon: '🧾',
    route: '/receipts-history',
  },
]

export default function MoreScreen() {
  const { colors } = useSimpleTheme()
  const router = useRouter()
  const { user, signOut: authSignOut } = useAuth()
  
  // Generate user profile data
  const userProfile = {
    name: user?.name || user?.email?.split('@')[0] || 'User',
    email: user?.email || 'user@example.com',
    avatar: (user?.name || user?.email || 'U').charAt(0).toUpperCase(),
  }
  
  const handleVoiceListCommand = (action: 'add', itemName: string, listName: string, quantity: number) => {
    // Handler for SAGE voice commands in More tab
  }

  const handleItemPress = (item: typeof SETTINGS_ITEMS[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    if (item.route) {
      router.push(item.route as any)
    } else {
      Alert.alert(item.title, `${item.description}. Coming soon!`)
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            await authSignOut()
            router.replace('/welcome')
          },
        },
      ]
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
          <View>
            <Text style={styles.cleanAppTitle}>SAVR</Text>
            <Text style={styles.headerSubtitle}>Settings & Profile</Text>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Pressable style={styles.profileCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileCardGradient}
            >
              <View style={styles.profileContent}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{userProfile.avatar}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{userProfile.name}</Text>
                  <Text style={styles.profileEmail}>{userProfile.email}</Text>
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingsCard}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.settingsCardGradient}
            >
              {SETTINGS_ITEMS.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.settingsItem,
                    index === SETTINGS_ITEMS.length - 1 && styles.settingsItemLast
                  ]}
                  onPress={() => handleItemPress(item)}
                >
                  <View style={styles.settingsItemIcon}>
                    <Text style={styles.settingsItemEmoji}>{item.icon}</Text>
                  </View>
                  <View style={styles.settingsItemContent}>
                    <Text style={styles.settingsItemTitle}>{item.title}</Text>
                    <Text style={styles.settingsItemDescription}>{item.description}</Text>
                  </View>
                  <Text style={styles.settingsItemArrow}>›</Text>
                </Pressable>
              ))}
            </LinearGradient>
          </View>
        </View>

        {/* Sign Out Section */}
        <View style={styles.signOutSection}>
          <Pressable 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.4)', 'rgba(106, 149, 113, 0.1)', 'rgba(255, 255, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.signOutButtonGradient}
            >
              <View style={styles.signOutIcon}>
                <Text style={styles.signOutEmoji}>🚪</Text>
              </View>
              <View style={styles.signOutContent}>
                <Text style={styles.signOutTitle}>Sign Out</Text>
                <Text style={styles.signOutDescription}>Return to welcome screen</Text>
              </View>
              <Text style={styles.signOutArrow}>›</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {/* SAGE Assistant */}
      <SageAssistantV2 
        onListCommand={handleVoiceListCommand}
      />
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
    paddingTop: 0,
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    marginBottom: 16,
  },
  cleanAppTitle: {
    fontSize: responsiveDims.isSmallScreen ? responsiveFonts.title : responsiveFonts.largeTitle,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: responsiveSpacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  profileSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  profileCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  profileCardGradient: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '400',
  },
  settingsSection: {
    paddingHorizontal: 24,
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
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(142, 142, 147, 0.1)',
  },
  settingsItemLast: {
    borderBottomWidth: 0,
  },
  settingsItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingsItemEmoji: {
    fontSize: 22,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  settingsItemDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  settingsItemArrow: {
    fontSize: 24,
    color: '#6A9571',
    fontWeight: '300',
    marginLeft: 8,
  },
  signOutSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  signOutButton: {
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
  signOutButtonGradient: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  signOutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  signOutEmoji: {
    fontSize: 22,
  },
  signOutContent: {
    flex: 1,
  },
  signOutTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  signOutDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  signOutArrow: {
    fontSize: 24,
    color: '#6A9571',
    fontWeight: '300',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 20,
  },
})
