// SAVR Allergen Disclaimer - Clear, premium, legally/ethically appropriate
// Use exact copy per spec; style as info note (not alarming)

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DISCLAIMER_TEXTS, type DisclaimerVariant } from '../lib/allergenDisclaimerTexts'

interface AllergenDisclaimerProps {
  variant?: DisclaimerVariant
  /** Compact mode for banner placement (single line when possible) */
  compact?: boolean
}

export default function AllergenDisclaimer({
  variant = 'default',
  compact = false,
}: AllergenDisclaimerProps) {
  const { en, fr } = DISCLAIMER_TEXTS[variant]

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Ionicons
        name="information-circle-outline"
        size={compact ? 16 : 18}
        color="#6B7280"
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <Text style={styles.textEn}>{en}</Text>
        <Text style={styles.textFr}>{fr}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(59, 130, 246, 0.4)',
    gap: 10,
  },
  containerCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  icon: {
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  textEn: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 19,
    marginBottom: 4,
  },
  textFr: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
})
