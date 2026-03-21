// SAVR Scan Result Modal - Shows scanned product and adds to pantry
import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable, Modal, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../lib/AuthContext'
import { ScannedProduct, AllergenCheckResult } from '../lib/BarcodeService'
import { reportIncorrectAllergenResult } from '../lib/AllergenReportService'
import { usePantry } from '../lib/PantryContext'
import { formatPantryItem } from '../lib/PantryItemFormatter'
import { capitalizeCategoryName } from '../lib/ScanningService'
import { expiryPredictionService } from '../lib/ExpiryPredictionService'
import { useListsUnified } from '../lib/useListsUnified'
import { useToast } from '../lib/ToastContext'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getSectionLabel } from '../lib/allergenEngine/sectionLabels'
import AllergenDisclaimer from './AllergenDisclaimer'

interface ScanResultModalProps {
  visible: boolean
  product: ScannedProduct | null
  allergenCheck?: AllergenCheckResult | null
  scanSessionId?: string
  barcode?: string
  onClose: () => void
  onAddAnother: () => void
}

export default function ScanResultModal({ visible, product, allergenCheck, scanSessionId, barcode, onClose, onAddAnother }: ScanResultModalProps) {
  const { addItem, refreshItems } = usePantry()
  const listsUnified = useListsUnified()
  const lists = Array.isArray(listsUnified.lists) ? listsUnified.lists : []
  const listsLoading = listsUnified.loading === true
  const listsLoadError = listsUnified.listsLoadError ?? null
  const { addItemToList, refreshLists } = listsUnified
  const { showToast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [listsRefreshing, setListsRefreshing] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [quantityText, setQuantityText] = useState('1')
  const [adding, setAdding] = useState(false)
  const [addingToList, setAddingToList] = useState(false)
  const [showListSelection, setShowListSelection] = useState(false)
  const [showAllergenDetail, setShowAllergenDetail] = useState(false)
  const [reportingIncorrect, setReportingIncorrect] = useState(false)
  // Expiry date scanning removed for barcode scans per user request
  // const [scannedExpiryDate, setScannedExpiryDate] = useState<string | null>(null)
  // const [scanningExpiry, setScanningExpiry] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const quantityInputRef = useRef<TextInput>(null)
  const quantitySectionRef = useRef<View>(null)
  const listModalOpenedAtRef = useRef<number>(0)

  // Reset allergen detail when modal closes
  useEffect(() => {
    if (!visible) {
      setShowAllergenDetail(false)
      setQuantity(1)
      setQuantityText('1')
      setShowListSelection(false)
    }
  }, [visible])

  const handleAddToGroceryList = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    listModalOpenedAtRef.current = Date.now()
    setShowListSelection(true)
    setListsRefreshing(true)
    try {
      if (typeof refreshLists === 'function') {
        await refreshLists()
      }
    } catch (e) {
      console.warn('Refresh lists failed', e)
    } finally {
      setListsRefreshing(false)
    }
  }

  const handleCloseListModal = () => {
    const now = Date.now()
    const elapsed = now - listModalOpenedAtRef.current
    if (elapsed < 400) return
    setShowListSelection(false)
  }

  const closeListModalImmediate = () => setShowListSelection(false)

  const handleSelectList = async (listId: string) => {
    setAddingToList(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      await addItemToList(listId, {
        name: product.name,
        category: product.category,
        quantity: quantity.toString(),
        notes: product.brand ? `Brand: ${product.brand}` : undefined,
      })

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      const listName = lists.find(l => l.id === listId)?.name || 'list'
      const message = quantity > 1
        ? `Added ${quantity} to ${listName}`
        : `Added to ${listName}`
      showToast(message, { kind: 'success' })
      setShowListSelection(false)
      setAddingToList(false)
    } catch (error) {
      console.error('Error adding to list:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      showToast('Failed to add item to list. Please try again.', { kind: 'error' })
      setAddingToList(false)
    }
  }

  if (!product) return null

  const riskLevel =
    allergenCheck?.riskLevel ||
    (allergenCheck?.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
  const matchedTerms = allergenCheck?.matches?.length
    ? Array.from(new Set(allergenCheck.matches.map(match => match.matchedTerm)))
    : []
  const headerColor =
    riskLevel === 'HIGH_RISK'
      ? '#DC2626'
      : riskLevel === 'NO_MATCH_FOUND'
        ? '#059669'
        : '#D97706'
  const headerBg =
    riskLevel === 'HIGH_RISK'
      ? 'rgba(220, 38, 38, 0.1)'
      : riskLevel === 'NO_MATCH_FOUND'
        ? 'rgba(5, 150, 105, 0.1)'
        : 'rgba(245, 158, 11, 0.15)'
  // UNKNOWN/INSUFFICIENT_DATA: never show safe-like copy
  const overlayTitle = (() => {
    switch (riskLevel) {
      case 'HIGH_RISK':
        return 'Allergens Detected'
      case 'POSSIBLE_RISK':
        return 'Uncertain — Possible Risk'
      case 'INSUFFICIENT_DATA':
        return 'Ingredients Unavailable'
      case 'NO_MATCH_FOUND':
      default:
        return 'No Allergens Found'
    }
  })()

  const unknownBannerMessage =
    riskLevel === 'INSUFFICIENT_DATA'
      ? "Ingredients unavailable — can't verify allergens for this barcode."
      : null
  const unknownDataIncomplete =
    riskLevel === 'INSUFFICIENT_DATA' &&
    allergenCheck?.sourceCoverageScore != null &&
    allergenCheck.sourceCoverageScore < 60

  const handleAddToPantry = async () => {
    setAdding(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Determine expiry date - use AI prediction only
      // NOTE: Expiry dates from barcode products and manual scanning are NOT used (removed per user request)
      let expiryDate: string | undefined = undefined
      let expirySource = 'predicted'

      // Predict expiry date using ExpiryPredictionService
      const purchaseDate = new Date().toISOString().split('T')[0]
      const prediction = expiryPredictionService.predictExpiry(
        product.name,
        product.category,
        'fridge', // Default to fridge storage
        purchaseDate
      )
      
      if (prediction.confidence !== 'low') {
        expiryDate = prediction.expiryDate
        expirySource = 'predicted'
        console.log(`📅 Predicted expiry for ${product.name}: ${prediction.days} days (${prediction.confidence} confidence)`)
      }

      // Use unified formatter for consistent item formatting
      const formattedItem = formatPantryItem({
        name: product.name,
        category: product.category,
        quantity,
        unit: 'unit',
        image: product.image,
        barcode: product.barcode,
        notes: product.brand || undefined,
        expiry_date: expiryDate,
      })

      await addItem(formattedItem)

      // No need to refresh - real-time subscription will update UI instantly
      // refreshItems() is redundant and causes unnecessary network requests

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      
      // Close modal after brief delay
      setTimeout(() => {
        setAdding(false)
        setQuantity(1)
        setQuantityText('1')
        onClose()
      }, 500)
    } catch (error) {
      console.error('Error adding to pantry:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setAdding(false)
    }
  }

  const handleAddAnotherScan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setQuantity(1)
    setQuantityText('1')
    onAddAnother()
  }

  // Expiry date scanning removed for barcode scans per user request
  // const handleScanExpiryDate = async () => { ... }

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          {/* Allergen Detail Overlay - Renders on top of everything */}
          {showAllergenDetail && allergenCheck && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999999,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}>
            {(() => {
              return allergenCheck && (
            <Pressable 
              style={{
                width: '100%',
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onPress={() => setShowAllergenDetail(false)}
            >
              <Pressable
                style={{
                  backgroundColor: allergenCheck.hasAllergens ? '#FFF5F5' : '#F0FFF4',
                  width: '100%',
                  maxWidth: 400,
                  maxHeight: '80%',
                  borderRadius: 24,
                  padding: 24,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                  elevation: 20
                }}
                onPress={(e) => e.stopPropagation()}
              >
                <ScrollView
                  style={{ maxHeight: Dimensions.get('window').height * 0.72 }}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  showsVerticalScrollIndicator={true}
                  bounces={true}
                >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 20, 
                    backgroundColor: headerBg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons 
                      name={riskLevel === 'HIGH_RISK' ? "warning" : riskLevel === 'NO_MATCH_FOUND' ? "checkmark-circle" : "alert-circle"} 
                      size={24} 
                      color={headerColor} 
                    />
                  </View>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: headerColor,
                    flex: 1
                  }}>
                    {overlayTitle}
                  </Text>
                </View>

                {/* Product Name */}
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: 20,
                  textAlign: 'center'
                }}>{product?.name || 'Unknown Product'}</Text>

                {/* Source: where ingredients/allergen evidence came from */}
                {allergenCheck.sourceLabel && (
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, textAlign: 'center' }}>
                    Source: {allergenCheck.sourceLabel}
                  </Text>
                )}

                {/* Status Message - UNKNOWN: never show safe-like copy */}
                <Text style={{
                  fontSize: 14,
                  color: riskLevel === 'INSUFFICIENT_DATA' ? '#92400E' : '#4B5563',
                  marginBottom: 16,
                  textAlign: 'center',
                  lineHeight: 20
                }}>
                  {riskLevel === 'INSUFFICIENT_DATA'
                    ? (unknownBannerMessage ?? allergenCheck.message)
                    : (allergenCheck.message || 'Allergen status unavailable.')}
                </Text>
                {riskLevel === 'INSUFFICIENT_DATA' && unknownDataIncomplete && (
                  <Text style={{ fontSize: 13, color: '#B45309', textAlign: 'center', marginBottom: 16 }}>
                    OFF data incomplete for this product.
                  </Text>
                )}

                {/* UNKNOWN: brief disclaimer near top */}
                {riskLevel === 'INSUFFICIENT_DATA' && (
                  <View style={{ marginBottom: 16 }}>
                    <AllergenDisclaimer variant="unknown" compact />
                  </View>
                )}

                {/* UNKNOWN fallback actions */}
                {riskLevel === 'INSUFFICIENT_DATA' && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 }}>
                      Help us verify ingredients
                    </Text>
                    <View style={{ gap: 10 }}>
                      {!!allergenCheck.fallbackCtas?.scanLabelPhoto && (
                        <Pressable
                          style={{
                            backgroundColor: '#111827',
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                          onPress={() => {
                            if (!scanSessionId || !barcode) return
                            setShowAllergenDetail(false)
                            setTimeout(() => router.push(`/scan-label-ocr?sessionId=${encodeURIComponent(scanSessionId)}&barcode=${encodeURIComponent(barcode)}` as any), 250)
                          }}
                          disabled={!scanSessionId || !barcode}
                        >
                          <Ionicons name="camera" size={18} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Scan label photo</Text>
                        </Pressable>
                      )}

                      {!!allergenCheck.fallbackCtas?.pasteIngredientsManually && (
                        <Pressable
                          style={{
                            backgroundColor: 'rgba(17, 24, 39, 0.06)',
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(17, 24, 39, 0.12)',
                          }}
                          onPress={() => {
                            if (!scanSessionId || !barcode) return
                            setShowAllergenDetail(false)
                            const pn = product?.name ? `&productName=${encodeURIComponent(product.name)}` : ''
                            setTimeout(() => router.push(`/paste-ingredients?sessionId=${encodeURIComponent(scanSessionId)}&barcode=${encodeURIComponent(barcode)}${pn}` as any), 250)
                          }}
                          disabled={!scanSessionId || !barcode}
                        >
                          <Ionicons name="clipboard" size={18} color="#111827" />
                          <Text style={{ color: '#111827', fontSize: 15, fontWeight: '800' }}>Paste ingredients</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {/* Detected Ingredients / Terms — Evidence-based (match_text + section) */}
                {(riskLevel === 'HIGH_RISK' || riskLevel === 'POSSIBLE_RISK') && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: 12
                    }}>
                      {riskLevel === 'HIGH_RISK' ? 'Evidence — ingredients flagged:' : 'Evidence — possible traces:'}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                      {(allergenCheck.matches && allergenCheck.matches.length > 0
                        ? allergenCheck.matches.map((match, index) => {
                            const sectionLabel = getSectionLabel(match.source, { bilingual: true })
                            const isHigh = riskLevel === 'HIGH_RISK'
                            const bg = isHigh ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.14)'
                            const border = isHigh ? 'rgba(220, 38, 38, 0.28)' : 'rgba(245, 158, 11, 0.28)'
                            const color = isHigh ? '#991B1B' : '#92400E'
                            return (
                              <View
                                key={`${match.allergen}-${match.matchedTerm}-${index}`}
                                style={{
                                  backgroundColor: bg,
                                  borderColor: border,
                                  borderWidth: 1,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderRadius: 14,
                                  maxWidth: '100%',
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Ionicons name={isHigh ? 'warning' : 'alert-circle'} size={16} color={color} />
                                  <Text style={{ fontSize: 14, fontWeight: '800', color }} numberOfLines={1}>
                                    {match.allergen}
                                  </Text>
                                </View>
                                <Text style={{ marginTop: 4, fontSize: 12, color: '#374151', lineHeight: 16 }}>
                                  “{match.matchedTerm}” · {sectionLabel}
                                </Text>
                              </View>
                            )
                          })
                        : (allergenCheck.detectedAllergens?.length ? allergenCheck.detectedAllergens : matchedTerms).map((term, index) => {
                            const isHigh = riskLevel === 'HIGH_RISK'
                            const bg = isHigh ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.14)'
                            const border = isHigh ? 'rgba(220, 38, 38, 0.28)' : 'rgba(245, 158, 11, 0.28)'
                            const color = isHigh ? '#991B1B' : '#92400E'
                            return (
                              <View
                                key={`${term}-${index}`}
                                style={{
                                  backgroundColor: bg,
                                  borderColor: border,
                                  borderWidth: 1,
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderRadius: 14,
                                }}
                              >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Ionicons name={isHigh ? 'warning' : 'alert-circle'} size={16} color={color} />
                                  <Text style={{ fontSize: 14, fontWeight: '800', color }}>{term}</Text>
                                </View>
                              </View>
                            )
                          }))}
                    </View>
                    {riskLevel === 'POSSIBLE_RISK' && (
                      <View style={{ marginTop: 12 }}>
                        <AllergenDisclaimer variant="may_contain" compact />
                      </View>
                    )}
                  </View>
                )}

                {/* Report incorrect result — CONTAINS / MAY_CONTAIN only (not for Ingredients Unavailable) */}
                {(riskLevel === 'HIGH_RISK' || riskLevel === 'POSSIBLE_RISK') && user && (
                  <Pressable
                    style={{ marginBottom: 16, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 10, alignItems: 'center' }}
                    onPress={async () => {
                      if (reportingIncorrect || !barcode) return
                      setReportingIncorrect(true)
                      try {
                        const overallStatus = riskLevel === 'HIGH_RISK' ? 'CONTAINS' : riskLevel === 'POSSIBLE_RISK' ? 'MAY_CONTAIN' : 'UNKNOWN'
                        await reportIncorrectAllergenResult({
                          userId: user.id,
                          scanSessionId,
                          barcode: barcode ?? '',
                          overallStatus,
                          matchedAllergens: (allergenCheck.matches ?? []).map(m => ({
                            allergen_id: m.allergenId ?? m.allergen,
                            match_text: m.matchedTerm,
                            section: m.source === 'allergens' ? 'contains' : m.source === 'traces' ? 'may_contain' : 'ingredients',
                          })),
                          enabledAllergenIds: allergenCheck.userAllergens ?? [],
                          offProductName: product?.name,
                          offBrands: product?.brand,
                          ingredientsText: allergenCheck.scannedText?.ingredientsText,
                          containsText: allergenCheck.scannedText?.allergensText,
                          mayContainText: allergenCheck.scannedText?.tracesText,
                        })
                        showToast('Report submitted. Thank you.', { kind: 'success' })
                      } catch (_e) {
                        showToast('Could not submit report.', { kind: 'error' })
                      } finally {
                        setReportingIncorrect(false)
                      }
                    }}
                    disabled={reportingIncorrect}
                  >
                    <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                      {reportingIncorrect ? 'Submitting…' : 'Report incorrect result'}
                    </Text>
                  </Pressable>
                )}

                {/* Safety disclaimer — only for HIGH_RISK and POSSIBLE_RISK (Ingredients Unavailable shows only the UNKNOWN disclaimer above) */}
                {(riskLevel === 'HIGH_RISK' || riskLevel === 'POSSIBLE_RISK') && (
                  <View style={{ marginBottom: 16 }}>
                    <AllergenDisclaimer variant="default" compact />
                  </View>
                )}

                {/* Action Button */}
                <Pressable
                  style={{
                    backgroundColor:
                      riskLevel === 'HIGH_RISK'
                        ? '#DC2626'
                        : riskLevel === 'NO_MATCH_FOUND'
                          ? '#059669'
                          : '#D97706',
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                  onPress={() => setShowAllergenDetail(false)}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Got it</Text>
                </Pressable>
                </ScrollView>
              </Pressable>
            </Pressable>
              )
            })()}
          </View>
          )}

          <LinearGradient
            colors={['#F8FAF9', '#FFFFFF']}
            style={styles.gradientContainer}
          >
            {/* Header */}
            <View style={styles.header}>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                setQuantity(1)
                onClose()
              }}
            >
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </Pressable>
            <Text style={styles.headerTitle}>Product Found!</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoidingView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView 
              ref={scrollViewRef}
              style={styles.content}
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
            {/* Success Badge */}
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={32} color="#6A9571" />
              <Text style={styles.successText}>Successfully Scanned</Text>
            </View>

            {/* Product Image */}
            {product.image && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: product.image }}
                  style={styles.productImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            )}

            {/* Product Info */}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              {product.brand && (
                <Text style={styles.productBrand}>{product.brand}</Text>
              )}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{capitalizeCategoryName(product.category)}</Text>
              </View>
              
              {/* Expiry Information */}
              {/* NOTE: Expiry date scanning removed for barcode scans per user request */}
              {/* Expiry dates will be predicted automatically when adding to pantry */}
              
              {/* Storage Instructions */}
              {product.storageInstructions && (
                <View style={styles.storageInfo}>
                  <Ionicons name="snow-outline" size={16} color="#8E8E93" />
                  <Text style={styles.storageText}>{product.storageInstructions}</Text>
                </View>
              )}
            </View>

            {/* Source: where ingredients/allergen evidence came from */}
            {allergenCheck && (
              <View style={styles.sourceLabelRow}>
                <Text style={styles.sourceLabelText}>
                  Source: {allergenCheck.sourceLabel ?? 'Open Food Facts'}
                </Text>
              </View>
            )}

            {/* Allergy Status Button (Glassmorphism) - Bulletproof with risk levels */}
            {allergenCheck && allergenCheck.userAllergens.length > 0 && (
              <Pressable
                style={styles.allergyStatusButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  setShowAllergenDetail(true)
                }}
              >
                <BlurView intensity={80} tint="light" style={styles.allergyBlurContainer}>
                  <LinearGradient
                    colors={(() => {
                      const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                      switch (riskLevel) {
                        case 'HIGH_RISK':
                          return ['rgba(255, 107, 107, 0.9)', 'rgba(220, 38, 38, 0.9)']
                        case 'POSSIBLE_RISK':
                        case 'INSUFFICIENT_DATA':
                          return ['rgba(251, 191, 36, 0.9)', 'rgba(245, 158, 11, 0.9)'] // Amber/yellow
                        case 'NO_MATCH_FOUND':
                        default:
                          return ['rgba(106, 149, 113, 0.9)', 'rgba(90, 132, 97, 0.9)']
                      }
                    })()}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.allergyGradient}
                  >
                    <View style={styles.allergyContent}>
                      <View style={styles.allergyIconContainer}>
                        <Ionicons 
                          name={(() => {
                            const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                            switch (riskLevel) {
                              case 'HIGH_RISK':
                                return 'warning'
                              case 'POSSIBLE_RISK':
                              case 'INSUFFICIENT_DATA':
                                return 'alert-circle'
                              case 'NO_MATCH_FOUND':
                              default:
                                return 'checkmark-circle'
                            }
                          })()}
                          size={24} 
                          color="#FFFFFF" 
                        />
                      </View>
                      <View style={styles.allergyTextContainer}>
                        <Text style={styles.allergyStatusText}>
                          {(() => {
                            const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                            switch (riskLevel) {
                              case 'HIGH_RISK':
                                return 'Allergies Detected'
                              case 'POSSIBLE_RISK':
                              case 'INSUFFICIENT_DATA':
                                return 'Uncertain'
                              case 'NO_MATCH_FOUND':
                              default:
                                return 'All Good'
                            }
                          })()}
                        </Text>
                        <Text style={styles.allergySubtext}>
                          {riskLevel === 'INSUFFICIENT_DATA'
                            ? "Can't verify — ingredients missing"
                            : (allergenCheck.message || (allergenCheck.hasAllergens
                              ? `${allergenCheck.detectedAllergens.length} allergen${allergenCheck.detectedAllergens.length > 1 ? 's' : ''} found`
                              : 'Safe for your household'))}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="rgba(255, 255, 255, 0.8)" />
                    </View>
                  </LinearGradient>
                </BlurView>
              </Pressable>
            )}

            {/* Quantity Selector */}
            <View 
              ref={quantitySectionRef}
              style={styles.quantitySection}
              onLayout={() => {
                // This ensures the section is measured
              }}
            >
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.quantityInputContainer}>
                <TextInput
                  ref={quantityInputRef}
                  style={styles.quantityInput}
                  placeholder="1"
                  placeholderTextColor="#8E8E93"
                  value={quantityText}
                  onChangeText={(text) => {
                    // Only allow numbers, but allow empty string while typing
                    const numbersOnly = text.replace(/[^0-9]/g, '')
                    setQuantityText(numbersOnly)
                    
                    // Update quantity value only if there's a valid number
                    if (numbersOnly !== '' && numbersOnly !== '0') {
                      setQuantity(parseInt(numbersOnly) || 1)
                    }
                  }}
                  onBlur={() => {
                    // When user finishes editing, ensure minimum of 1
                    if (quantityText === '' || quantityText === '0' || parseInt(quantityText) < 1) {
                      setQuantityText('1')
                      setQuantity(1)
                    } else {
                      // Ensure text matches the parsed value
                      const parsed = parseInt(quantityText)
                      if (!isNaN(parsed)) {
                        setQuantityText(parsed.toString())
                        setQuantity(parsed)
                      }
                    }
                  }}
                  onFocus={() => {
                    // Scroll to quantity section when keyboard appears
                    setTimeout(() => {
                      quantitySectionRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y, width, height) => {
                          scrollViewRef.current?.scrollTo({
                            y: Math.max(0, y - 150), // Scroll to show input with padding above
                            animated: true
                          })
                        },
                        () => {
                          // Fallback: scroll to end if measure fails
                          scrollViewRef.current?.scrollToEnd({ animated: true })
                        }
                      )
                    }, 300) // Delay to allow keyboard to appear
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  textAlign="center"
                  editable={true}
                  selectTextOnFocus={true}
                  blurOnSubmit={true}
                />
              </View>
            </View>

            {/* Safety disclaimer — above CTAs when allergen info present */}
            {allergenCheck && (
              <View style={{ marginBottom: 16 }}>
                <AllergenDisclaimer variant="default" />
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <Pressable
                style={styles.addToPantryButton}
                onPress={handleAddToPantry}
                disabled={adding}
              >
                <LinearGradient
                  colors={['#6A9571', '#5A8461']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addToPantryGradient}
                >
                  {adding ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="basket-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.addToPantryText}>Add to Pantry</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                style={styles.addToListButton}
                onPress={handleAddToGroceryList}
                disabled={addingToList}
              >
                <LinearGradient
                  colors={['#6A9571', '#5A8461']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addToListGradient}
                >
                  {addingToList ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="list-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.addToListText}>Add to List</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable
                style={styles.scanAnotherButton}
                onPress={handleAddAnotherScan}
              >
                <Ionicons name="scan-outline" size={20} color="#6A9571" />
                <Text style={styles.scanAnotherText}>Scan Another</Text>
              </Pressable>
            </View>

            {/* Source Indicator */}
            <View style={styles.sourceIndicator}>
              <Text style={styles.sourceText}>
                Source: {product.source === 'openfoodfacts' ? 'Open Food Facts' : 
                        product.source === 'local_db' ? 'SAVR Community' : 
                        'Manual Entry'}
              </Text>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
          </LinearGradient>

          {/* List selection overlay - inside same modal so it appears in front */}
          {showListSelection && (
            <View style={styles.listOverlay} pointerEvents="box-none">
              <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseListModal} />
              <SafeAreaView style={styles.listSheet} edges={['top', 'bottom']}>
                <View style={styles.listModalTopSpacer} />
                <View style={styles.listModalHeader}>
                  <Text style={styles.listModalTitle}>Select a List</Text>
                  <Pressable style={styles.listModalCloseButton} onPress={closeListModalImmediate}>
                    <Ionicons name="close" size={24} color="#1C1C1E" />
                  </Pressable>
                </View>
                <ScrollView style={styles.listModalScrollView} contentContainerStyle={styles.listModalScrollContent}>
                  {(listsRefreshing || listsLoading) ? (
                    <View style={styles.emptyListsContainer}>
                      <ActivityIndicator size="large" color="#6A9571" />
                      <Text style={styles.emptyListsSubtext}>Loading your lists…</Text>
                    </View>
                  ) : listsLoadError ? (
                    <View style={styles.emptyListsContainer}>
                      <Ionicons name="cloud-offline-outline" size={48} color="#8E8E93" />
                      <Text style={styles.emptyListsText}>Couldn&apos;t load lists</Text>
                      <Text style={styles.emptyListsSubtext}>Check your connection and try again</Text>
                      <Pressable
                        style={styles.createListButton}
                        onPress={async () => {
                          setListsRefreshing(true)
                          try {
                            if (typeof refreshLists === 'function') await refreshLists()
                          } finally {
                            setListsRefreshing(false)
                          }
                        }}
                        disabled={listsRefreshing}
                      >
                        <Text style={styles.createListButtonText}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : lists.length === 0 ? (
                    <View style={styles.emptyListsContainer}>
                      <Ionicons name="list-outline" size={48} color="#8E8E93" />
                      <Text style={styles.emptyListsText}>No grocery lists found</Text>
                      <Text style={styles.emptyListsSubtext}>Create a list first or retry if you have lists</Text>
                      <View style={styles.emptyListsActions}>
                        {typeof refreshLists === 'function' && (
                          <Pressable
                            style={[styles.createListButton, styles.retryListButton]}
                            onPress={async () => {
                              setListsRefreshing(true)
                              try {
                                await refreshLists()
                              } finally {
                                setListsRefreshing(false)
                              }
                            }}
                            disabled={listsRefreshing}
                          >
                            <Text style={styles.createListButtonText}>Retry</Text>
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.createListButton}
                          onPress={() => {
                            setShowListSelection(false)
                            onClose()
                            setTimeout(() => router.push('/(tabs)/lists?openNewList=true'), 300)
                          }}
                        >
                          <Text style={styles.createListButtonText}>Create a List</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    lists.map((list) => (
                      <Pressable
                        key={list.id}
                        style={styles.listItem}
                        onPress={() => handleSelectList(list.id)}
                        disabled={addingToList}
                      >
                        <View style={styles.listItemContent}>
                          <Text style={styles.listItemIcon}>{list.icon || '🛒'}</Text>
                        <View style={styles.listItemInfo}>
                          <Text style={styles.listItemName}>{list.name}</Text>
                          <Text style={styles.listItemMeta}>
                            {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
                            {list.completedCount > 0 && ` • ${list.completedCount} completed`}
                          </Text>
                        </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </SafeAreaView>
            </View>
          )}
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gradientContainer: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100, // Extra padding to ensure quantity input is visible above keyboard
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
    marginLeft: 12,
  },
  imageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  productBrand: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
  },
  expirySection: {
    marginTop: 12,
    gap: 8,
  },
  expiryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  expiryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },
  scanExpiryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  scanExpiryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  storageText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    flex: 1,
  },
  scalingInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  scalingDetails: {
    marginLeft: 12,
    flex: 1,
  },
  scalingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
    marginBottom: 4,
  },
  scalingText: {
    fontSize: 13,
    color: '#6A9571',
    lineHeight: 18,
  },
  nutritionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  servingSize: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6A9571',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666666',
  },
  additionalNutrition: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  additionalNutritionText: {
    fontSize: 13,
    color: '#666666',
  },
  quantitySection: {
    marginBottom: 24,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  quantityInputContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    minWidth: 100,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  addToPantryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addToPantryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addToPantryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addToListButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  addToListGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addToListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    gap: 8,
  },
  scanAnotherText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  sourceLabelRow: {
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  sourceLabelText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  sourceIndicator: {
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 12,
    color: '#999999',
  },
  allergyStatusButton: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  allergyBlurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  allergyGradient: {
    padding: 18,
  },
  allergyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allergyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  allergyTextContainer: {
    flex: 1,
  },
  allergyStatusText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  allergySubtext: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Allergen Overlay Styles
  allergenOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
    elevation: 999999,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  allergenOverlay: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  allergenPopup: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    zIndex: 1000000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 50,
      },
      android: {
        elevation: 100,
      },
    }),
  },
  allergenPopupContent: {
    flex: 1,
  },
  allergenCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  allergenHeader: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  allergenIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  allergenIconDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  allergenIconSafe: {
    backgroundColor: 'rgba(106, 149, 113, 0.2)',
  },
  allergenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  allergenProductName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  allergenScrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  allergenSection: {
    marginBottom: 20,
  },
  allergenSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  allergenSectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  allergenList: {
    gap: 8,
  },
  allergenListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  allergenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B6B',
    marginRight: 12,
  },
  allergenListText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  allergenWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  allergenWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#C92A2A',
    lineHeight: 20,
    fontWeight: '500',
  },
  allergenSafeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  allergenSafeText: {
    flex: 1,
    fontSize: 15,
    color: '#2D5F3E',
    lineHeight: 22,
    fontWeight: '500',
  },
  // List selection overlay - full screen for easy use
  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    zIndex: 99999,
    ...Platform.select({
      android: { elevation: 99999 },
    }),
  },
  listSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginVertical: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 24 },
    }),
  },
  listModalContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 1001,
      },
    }),
  },
  listModalTopSpacer: {
    height: 24,
    backgroundColor: '#FFFFFF',
  },
  listModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  listModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  listModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listModalScrollView: {
    flex: 1,
  },
  listModalScrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 32,
  },
  emptyListsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyListsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyListsSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyListsActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  retryListButton: {
    backgroundColor: 'rgba(106, 149, 113, 0.2)',
  },
  createListButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  createListButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  listItemMeta: {
    fontSize: 13,
    color: '#8E8E93',
  },
  allergenChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  allergenChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D5F3E',
  },
  allergenDisclaimer: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  allergenButtonContainer: {
    padding: 20,
  },
  allergenGotItButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allergenGotItButtonDanger: {
    backgroundColor: '#FF6B6B',
  },
  allergenGotItButtonSafe: {
    backgroundColor: '#6A9571',
  },
  allergenGotItButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

