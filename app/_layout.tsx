import { Stack, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"
import * as Linking from 'expo-linking'
import { SimpleThemeProvider } from "../lib/SimpleThemeContext"
import { useSimpleTheme } from "../lib/SimpleThemeContext"
import { AuthProvider, useAuth } from "../lib/AuthContext"
import { ListsProvider } from "../lib/ListsContext"
import { CollaborativeListsProvider } from "../lib/CollaborativeListsContext"
import { HouseholdProvider } from "../lib/HouseholdContext"
import { PantryProvider } from "../lib/PantryContext"
import { ToastProvider } from "../lib/ToastContext"
import { ReceiptsProvider } from "../lib/ReceiptsContext"
import { notificationsService } from "../lib/NotificationsService"
import { ErrorBoundary, MinimalErrorFallback } from "../lib/ErrorBoundary"
import { validateConfiguration } from "../lib/ConfigValidator"
import { logger } from "../lib/Logger"
import { config } from "../config"
import { processAuthDeepLink } from "../lib/authDeepLink"
import { initializeRevenueCat } from "../lib/revenuecat"
import * as Notifications from 'expo-notifications'

// Feature-flagged: set EXPO_PUBLIC_ENABLE_PAYWALL=true to enable
import { SubscriptionProvider } from "../lib/SubscriptionContext"
import { SubscriptionGate } from "../components/SubscriptionGate"
// Feature-flagged: set EXPO_PUBLIC_ENABLE_RECIPES=true to enable
import { RecipesProvider } from "../lib/RecipesContext"

function RootLayoutContent() {
  const { isDark, colors } = useSimpleTheme()
  const { user } = useAuth()
  const router = useRouter()
  
  // Handle deep links for password reset and email verification
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        // Normalize URL - handle both savr://password-reset and savr:///password-reset
        const normalizedUrl = url.replace(/savr:\/\/\/+/g, 'savr://')
        // Exchange PKCE / token_hash / implicit tokens before routing (child effects run in inconsistent order).
        await processAuthDeepLink(normalizedUrl)
        
        // Parse the URL to extract the path
        const parsed = Linking.parse(normalizedUrl)
        const path = parsed.path || ''
        const hostname = parsed.hostname || ''
        
        logger.info('🔗 Deep link received:', { url, normalizedUrl, path, hostname })
        
        // Handle password reset deep link (check both path and hostname, and raw URL)
        if (normalizedUrl.includes('password-reset') || path.includes('password-reset') || hostname === 'password-reset') {
          logger.info('🔐 Password reset deep link detected, routing to /password-reset')
          // Use setTimeout to ensure router is ready
          setTimeout(() => {
            router.replace('/password-reset')
          }, 100)
          return
        }
        
        // Handle email verification deep link (already handled in email-verification.tsx, but ensure route exists)
        if (normalizedUrl.includes('email-verification') || path.includes('email-verification') || hostname === 'email-verification') {
          logger.info('📧 Email verification deep link detected, routing to /email-verification')
          setTimeout(() => {
            router.replace('/email-verification')
          }, 100)
          return
        }

        // Family invite: savr://join-family?code=...
        if (
          normalizedUrl.includes('join-family') ||
          path.includes('join-family') ||
          hostname === 'join-family'
        ) {
          const qp = parsed.queryParams?.code
          const code = Array.isArray(qp) ? qp[0] : qp
          logger.info('👨‍👩‍👧 Family invite deep link', { hasCode: Boolean(code) })
          setTimeout(() => {
            router.replace(
              code
                ? (`/join-family?code=${encodeURIComponent(String(code))}` as const)
                : '/join-family'
            )
          }, 100)
          return
        }
      } catch (error) {
        logger.error('Error handling deep link:', error)
      }
    }

    // Check initial URL (when app is opened from a link) - run immediately
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('🔗 Initial URL detected:', url)
        void handleDeepLink(url)
      }
    }).catch((error) => {
      logger.error('Error getting initial URL:', error)
    })

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      logger.info('🔗 Deep link event received:', event.url)
      void handleDeepLink(event.url)
    })

    return () => {
      subscription.remove()
    }
  }, [router])
  
  // Set up notification listeners
  useEffect(() => {
    // Listen for notification taps (when user opens app from notification)
    const subscription = notificationsService.addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data
      
      // Navigate to appropriate screen based on notification type
      if (data?.screen) {
        router.push(data.screen as any)
      }
    })
    
    // Listen for foreground notifications
    const foregroundSubscription = notificationsService.addNotificationReceivedListener((notification) => {
      logger.info('Notification received in foreground', { title: notification.request.content.title })
    })
    
    return () => {
      subscription.remove()
      foregroundSubscription.remove()
    }
  }, [router])
  
  const content = (
    <>
      <StatusBar 
        style={isDark ? "light" : "dark"} 
        backgroundColor={colors.background} 
      />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: colors.background }
        }} 
      />
    </>
  )

  return config.enablePaywall ? <SubscriptionGate>{content}</SubscriptionGate> : content
}

function ProvidersWrapper({ children }: { children: React.ReactNode }) {
  const inner = (
    <ReceiptsProvider>
      <RecipesProvider>
        {children}
      </RecipesProvider>
    </ReceiptsProvider>
  )

  // Always mount BOTH list providers so useListsUnified can call hooks unconditionally.
  // This prevents Rules of Hooks violations and crashes when auth state changes.
  return (
    <ToastProvider>
      <ListsProvider>
        <CollaborativeListsProvider>
          <HouseholdProvider>
            <PantryProvider>
              {inner}
            </PantryProvider>
          </HouseholdProvider>
        </CollaborativeListsProvider>
      </ListsProvider>
    </ToastProvider>
  )
}

export default function Root() {
  // Validate configuration on app startup
  useEffect(() => {
    try {
      validateConfiguration()
    } catch (error) {
      logger.error('Configuration validation failed on startup', { error })
      // Error will be caught by ErrorBoundary
    }
  }, [])

  // Initialize RevenueCat once at app startup (when paywall enabled). EAS dev build / TestFlight only.
  useEffect(() => {
    if (!config.enablePaywall) return
    let cancelled = false
    initializeRevenueCat()
      .then(() => {
        if (!cancelled && __DEV__) {
          logger.info('[RevenueCat] Initialized')
        }
      })
      .catch((e) => {
        if (!cancelled && __DEV__) {
          logger.error('RevenueCat init failed', { error: e })
        }
      })
    return () => { cancelled = true }
  }, [])

  const app = (
    <ProvidersWrapper>
      <RootLayoutContent />
    </ProvidersWrapper>
  )

  // Outer ErrorBoundary catches errors in AuthProvider or when inner fallback can't render (e.g. loop).
  // Its fallback signs out and reloads so the user can reach the sign-in screen.
  return (
    <ErrorBoundary fallback={(onReset) => <MinimalErrorFallback onReset={onReset} />}>
      <AuthProvider>
        <SimpleThemeProvider>
          <SafeAreaProvider>
            <ErrorBoundary>
              <SubscriptionProvider>{app}</SubscriptionProvider>
            </ErrorBoundary>
          </SafeAreaProvider>
        </SimpleThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
