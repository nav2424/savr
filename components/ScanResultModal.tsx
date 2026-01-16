// SAVR Scan Result Modal - Shows scanned product and adds to pantry
import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TextInput, StyleSheet, Pressable, Modal, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { ScannedProduct, AllergenCheckResult } from '../lib/BarcodeService'
import { usePantry } from '../lib/PantryContext'
import { formatPantryItem } from '../lib/PantryItemFormatter'
import { capitalizeCategoryName, scanningService } from '../lib/ScanningService'
import { expiryPredictionService } from '../lib/ExpiryPredictionService'
import * as ImagePicker from 'expo-image-picker'
import { Alert } from 'react-native'

interface ScanResultModalProps {
  visible: boolean
  product: ScannedProduct | null
  allergenCheck?: AllergenCheckResult | null
  onClose: () => void
  onAddAnother: () => void
}

export default function ScanResultModal({ visible, product, allergenCheck, onClose, onAddAnother }: ScanResultModalProps) {
  const { addItem, refreshItems } = usePantry()
  const [quantity, setQuantity] = useState(1)
  const [quantityText, setQuantityText] = useState('1')
  const [adding, setAdding] = useState(false)
  const [showAllergenDetail, setShowAllergenDetail] = useState(false)
  const [scannedExpiryDate, setScannedExpiryDate] = useState<string | null>(null)
  const [scanningExpiry, setScanningExpiry] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const quantityInputRef = useRef<TextInput>(null)
  const quantitySectionRef = useRef<View>(null)

  // Reset allergen detail when modal closes
  useEffect(() => {
    if (!visible) {
      setShowAllergenDetail(false)
      setQuantity(1)
      setQuantityText('1')
    }
  }, [visible])

  if (!product) return null

  const handleAddToPantry = async () => {
    setAdding(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Determine expiry date - prioritize scanned > barcode > predicted
      let expiryDate = scannedExpiryDate || product.expiryDate
      let expirySource = scannedExpiryDate ? 'scanned' : (product.expiryDate ? 'barcode' : 'predicted')

      if (!expiryDate) {
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

      // Refresh pantry to immediately show the new item
      await refreshItems()

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      
      // Close modal after brief delay
      setTimeout(() => {
        setAdding(false)
        setQuantity(1)
        setQuantityText('1')
        setScannedExpiryDate(null)
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

  const handleScanExpiryDate = async () => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to scan expiry dates.')
        return
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      })

      if (result.canceled || !result.assets[0]) {
        return
      }

      setScanningExpiry(true)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Convert image to base64
      const base64 = result.assets[0].base64 || ''
      if (!base64) {
        throw new Error('Failed to process image')
      }

      // Scan expiry date
      const scanResult = await scanningService.scanExpiryDate(base64)

      if (scanResult.expiryDate) {
        setScannedExpiryDate(scanResult.expiryDate)
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert('Success', `Expiry date scanned: ${new Date(scanResult.expiryDate).toLocaleDateString()}`)
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Not Found', scanResult.error || 'Could not find an expiry date in the image. Please try again or enter manually.')
      }
    } catch (error) {
      console.error('Error scanning expiry date:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', 'Failed to scan expiry date. Please try again.')
    } finally {
      setScanningExpiry(false)
    }
  }

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
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 20, 
                    backgroundColor: allergenCheck.hasAllergens ? 'rgba(220, 38, 38, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12
                  }}>
                    <Ionicons 
                      name={allergenCheck.hasAllergens ? "warning" : "checkmark-circle"} 
                      size={24} 
                      color={allergenCheck.hasAllergens ? "#DC2626" : "#059669"} 
                    />
                  </View>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: allergenCheck.hasAllergens ? "#DC2626" : "#059669",
                    flex: 1
                  }}>
                    {allergenCheck.hasAllergens ? "Allergens Detected" : "Safe to Eat"}
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

                {/* Detected Allergens */}
                {allergenCheck.hasAllergens && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: 12
                    }}>Detected Allergens:</Text>
                    <View style={{ gap: 8 }}>
                      {allergenCheck.detectedAllergens.map((allergen, index) => (
                        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Ionicons name="close-circle" size={16} color="#DC2626" />
                          <Text style={{ fontSize: 14, color: '#DC2626', fontWeight: '500' }}>{allergen}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Button */}
                <Pressable
                  style={{
                    backgroundColor: allergenCheck.hasAllergens ? '#DC2626' : '#059669',
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    alignItems: 'center'
                  }}
                  onPress={() => setShowAllergenDetail(false)}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Got it</Text>
                </Pressable>
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
              <View style={styles.expirySection}>
                {(scannedExpiryDate || product.expiryDate || product.shelfLife) && (
                  <View style={styles.expiryInfo}>
                    <Ionicons name="time-outline" size={16} color="#8E8E93" />
                    <Text style={styles.expiryText}>
                      {scannedExpiryDate
                        ? `Expires: ${new Date(scannedExpiryDate).toLocaleDateString()} (scanned)`
                        : product.expiryDate 
                          ? `Expires: ${new Date(product.expiryDate).toLocaleDateString()}`
                          : product.shelfLife 
                            ? `Shelf life: ${product.shelfLife} days`
                            : ''
                      }
                    </Text>
                  </View>
                )}
                
                {/* Scan Expiry Date Button */}
                <Pressable
                  style={styles.scanExpiryButton}
                  onPress={handleScanExpiryDate}
                  disabled={scanningExpiry}
                >
                  {scanningExpiry ? (
                    <ActivityIndicator size="small" color="#6A9571" />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={18} color="#6A9571" />
                      <Text style={styles.scanExpiryText}>
                        {scannedExpiryDate ? 'Rescan Expiry Date' : 'Scan Expiry Date'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
              
              {/* Storage Instructions */}
              {product.storageInstructions && (
                <View style={styles.storageInfo}>
                  <Ionicons name="snow-outline" size={16} color="#8E8E93" />
                  <Text style={styles.storageText}>{product.storageInstructions}</Text>
                </View>
              )}
            </View>

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
                                return 'Possible Risk'
                              case 'INSUFFICIENT_DATA':
                                return 'Unable to Verify'
                              case 'NO_MATCH_FOUND':
                              default:
                                return 'All Good'
                            }
                          })()}
                        </Text>
                        <Text style={styles.allergySubtext}>
                          {allergenCheck.message || (allergenCheck.hasAllergens 
                            ? `${allergenCheck.detectedAllergens.length} allergen${allergenCheck.detectedAllergens.length > 1 ? 's' : ''} found`
                            : 'Safe for your household')}
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

