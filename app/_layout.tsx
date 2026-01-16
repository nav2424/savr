import { Stack, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { SimpleThemeProvider } from "../lib/SimpleThemeContext"
import { useSimpleTheme } from "../lib/SimpleThemeContext"
import { AuthProvider, useAuth } from "../lib/AuthContext"
// PAYWALL TEMPORARILY DISABLED FOR TESTING
// import { SubscriptionProvider } from "../lib/SubscriptionContext"
// import { SubscriptionGate } from "../components/SubscriptionGate"
import { ListsProvider } from "../lib/ListsContext"
import { CollaborativeListsProvider } from "../lib/CollaborativeListsContext"
import { PantryProvider } from "../lib/PantryContext"
// RECIPES TEMPORARILY DISABLED FOR LAUNCH - Code preserved
// import { RecipesProvider } from "../lib/RecipesContext"
import { ReceiptsProvider } from "../lib/ReceiptsContext"
import { notificationsService } from "../lib/NotificationsService"
import { ErrorBoundary } from "../lib/ErrorBoundary"
import { validateConfiguration } from "../lib/ConfigValidator"
import { logger } from "../lib/Logger"
import * as Notifications from 'expo-notifications'

function RootLayoutContent() {
  const { isDark, colors } = useSimpleTheme()
  const { user } = useAuth()
  const router = useRouter()
  
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
  }, [])
  
  return (
    // PAYWALL TEMPORARILY DISABLED FOR TESTING
    // <SubscriptionGate>
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
    // </SubscriptionGate>
  )
}

function ProvidersWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  
  // Use collaborative lists when authenticated, local lists otherwise
  if (user) {
    return (
      <CollaborativeListsProvider>
        <PantryProvider>
          {/* RECIPES TEMPORARILY DISABLED FOR LAUNCH - Code preserved */}
          {/* <RecipesProvider> */}
            <ReceiptsProvider>
              {children}
            </ReceiptsProvider>
          {/* </RecipesProvider> */}
        </PantryProvider>
      </CollaborativeListsProvider>
    )
  }
  
  return (
    <ListsProvider>
      <PantryProvider>
        {/* RECIPES TEMPORARILY DISABLED FOR LAUNCH - Code preserved */}
        {/* <RecipesProvider> */}
          <ReceiptsProvider>
            {children}
          </ReceiptsProvider>
        {/* </RecipesProvider> */}
      </PantryProvider>
    </ListsProvider>
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

  return (
    <ErrorBoundary>
      <SimpleThemeProvider>
        <AuthProvider>
          {/* PAYWALL TEMPORARILY DISABLED FOR TESTING */}
          {/* <SubscriptionProvider> */}
            <ProvidersWrapper>
              <RootLayoutContent />
            </ProvidersWrapper>
          {/* </SubscriptionProvider> */}
        </AuthProvider>
      </SimpleThemeProvider>
    </ErrorBoundary>
  )
}
