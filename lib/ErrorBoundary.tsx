// SAVR Error Boundary - Catches React errors and displays fallback UI
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from './Logger'
import { AuthContext } from './AuthContext'

interface Props {
  children: ReactNode
  /** Custom fallback UI, or a function that receives onReset and returns the fallback (for outer boundary). */
  fallback?: ReactNode | ((onReset: () => void) => ReactNode)
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Minimal fallback that does NOT use AuthContext or router. Use when the error boundary
 * wraps the whole app (e.g. outside AuthProvider) so the user can still recover by
 * signing out and reloading. Safe to render even when the rest of the app is broken.
 */
export function MinimalErrorFallback({ onReset }: { onReset: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [reloadUnavailable, setReloadUnavailable] = React.useState(false)

  const handleStartOver = async () => {
    setLoading(true)
    setReloadUnavailable(false)
    try {
      const { supabase } = await import('./supabase')
      await supabase.auth.signOut()
    } catch (_) {
      // Ignore - we'll clear storage anyway
    }
    try {
      await AsyncStorage.clear()
    } catch (_) {}
    try {
      const Updates = require('expo-updates').default
      if (Updates.reloadAsync) {
        await Updates.reloadAsync()
        return
      }
    } catch (_) {
      // Reload not available (e.g. expo-updates not installed or not in OTA context)
      setReloadUnavailable(true)
    }
    setLoading(false)
    // Do not call onReset() when reload failed - that would re-render the crashing tree and loop
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>⚠️ Something went wrong</Text>
        <Text style={styles.message}>
          We're sorry, but something unexpected happened.
        </Text>
        <Text style={styles.recoveryHint}>
          Tap "Start over" to sign out and reload the app. You can then sign in again.
        </Text>
        {reloadUnavailable && (
          <Text style={styles.recoveryHint}>
            If the app doesn't reload, close it completely and reopen it.
          </Text>
        )}
        <TouchableOpacity style={styles.button} onPress={handleStartOver} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.buttonText}>Start over</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

/** Fallback UI used when ErrorBoundary catches an error. Rendered inside AuthProvider so signOut is available. */
function DefaultErrorFallback({
  onReset,
  error,
  errorInfo,
}: {
  onReset: () => void
  error: Error | null
  errorInfo: ErrorInfo | null
}) {
  const router = useRouter()
  const authContext = React.useContext(AuthContext)
  const signOut = authContext?.signOut
  const [signingOut, setSigningOut] = React.useState(false)

  const handleSignOut = async () => {
    if (!signOut) {
      onReset()
      return
    }
    setSigningOut(true)
    try {
      await signOut()
      // Navigate to welcome so after reset we land on sign-in screen, not the crashing tab
      router.replace('/welcome')
      onReset()
    } catch (e) {
      logger.error('ErrorBoundary: sign out failed', { error: e })
      onReset()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>⚠️ Something went wrong</Text>
        <Text style={styles.message}>
          We're sorry, but something unexpected happened. The error has been logged and we'll look into it.
        </Text>
        <Text style={styles.recoveryHint}>
          If this keeps happening, sign out and sign back in to recover.
        </Text>

        {error && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>{__DEV__ ? 'Error Details (Dev Only):' : 'What went wrong:'}</Text>
            <Text style={styles.debugText} numberOfLines={5}>
              {error.message || error.toString()}
            </Text>
            {__DEV__ && errorInfo && (
              <Text style={styles.debugText}>
                {errorInfo.componentStack}
              </Text>
            )}
          </View>
        )}

        {signOut && (
          <TouchableOpacity style={styles.button} onPress={handleSignOut} disabled={signingOut}>
            {signingOut ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign out and start over</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={onReset}
          disabled={signingOut}
        >
          <Text style={styles.buttonSecondaryText}>Try Again</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('React Error Boundary caught an error', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      componentStack: errorInfo.componentStack,
    })

    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const fallback = this.props.fallback
        return typeof fallback === 'function' ? fallback(this.handleReset) : fallback
      }

      return (
        <DefaultErrorFallback
          onReset={this.handleReset}
          error={this.state.error}
          errorInfo={this.state.errorInfo}
        />
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  recoveryHint: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  debugContainer: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
    maxHeight: 300,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#999999',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    minWidth: 200,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6A9571',
  },
  buttonSecondaryText: {
    color: '#6A9571',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
})
