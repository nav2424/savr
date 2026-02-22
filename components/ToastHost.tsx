import React, { useEffect, useRef } from 'react'
import { Animated, Platform, StyleSheet, Text, View } from 'react-native'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export function ToastHost({ message, kind }: { message: string | null; kind: ToastKind }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current

  useEffect(() => {
    const toValue = message ? 1 : 0
    Animated.parallel([
      Animated.timing(opacity, { toValue, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: message ? 0 : 12, duration: 160, useNativeDriver: true }),
    ]).start()
  }, [message, opacity, translateY])

  if (!message) return null

  return (
    <View pointerEvents="none" style={styles.container}>
      <Animated.View style={[styles.toast, stylesByKind[kind], { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.text} numberOfLines={3}>
          {message}
        </Text>
      </Animated.View>
    </View>
  )
}

const stylesByKind = StyleSheet.create({
  info: { backgroundColor: 'rgba(28, 28, 30, 0.92)' },
  success: { backgroundColor: 'rgba(52, 199, 89, 0.92)' },
  warning: { backgroundColor: 'rgba(255, 149, 0, 0.92)' },
  error: { backgroundColor: 'rgba(255, 59, 48, 0.92)' },
})

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toast: {
    maxWidth: 520,
    width: '100%',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
})

