// SAVR Advanced Scanning - Receipt & Item Recognition
import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Dimensions,
  Animated,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { scanningService, ScannedItem } from '../lib/ScanningService'
import { usePantry } from '../lib/PantryContext'
import { receiptsService } from '../lib/ReceiptsService'
import { useAuth } from '../lib/AuthContext'
import { useReceipts } from '../lib/ReceiptsContext'
import { userPreferencesService } from '../lib/UserPreferencesService'
import { expiryPredictionService } from '../lib/ExpiryPredictionService'
import { priceLearningService } from '../lib/PriceLearningService'
import { barcodeService, ScanResult } from '../lib/BarcodeService'
import ScanResultModal from '../components/ScanResultModal'
import ManualProductEntry from '../components/ManualProductEntry'
import { logger } from '../lib/Logger'

const { width } = Dimensions.get('window')

type ScanMode = 'receipt' | 'barcode'
type ScreenState = 'camera' | 'analyzing' | 'results'

export default function ScanScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { user } = useAuth()
  const { addItem } = usePantry()
  const { refreshReceipts } = useReceipts()
  const [permission, requestPermission] = useCameraPermissions()
  // Default to receipt mode if coming from pantry, otherwise barcode
  const initialMode = (params.mode === 'receipt' ? 'receipt' : 'barcode') as ScanMode
  const [scanMode, setScanMode] = useState<ScanMode>(initialMode)
  const [screenState, setScreenState] = useState<ScreenState>('camera')

  // Update scan mode when params change (e.g., when navigating from quick actions)
  React.useEffect(() => {
    if (params.mode === 'receipt') {
      setScanMode('receipt')
    } else if (params.mode === 'barcode') {
      setScanMode('barcode')
    }
  }, [params.mode])
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [storeName, setStoreName] = useState<string>('')
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editedName, setEditedName] = useState('')
  const [editedQuantity, setEditedQuantity] = useState('')
  const [budgetImpact, setBudgetImpact] = useState<{ percentage: number; budget: number } | null>(null)
  const [barcodeResult, setBarcodeResult] = useState<ScanResult | null>(null)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState(false)
  const [scanning, setScanning] = useState(false)
  const cameraRef = useRef<any>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scanLineAnim = useRef(new Animated.Value(0)).current

  // Pulse animation for analyzing state
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }

  // Scan line animation for barcode mode
  React.useEffect(() => {
    if (scanMode === 'barcode' && screenState === 'camera') {
      // Reset barcode scan state when entering barcode mode
      setScannedBarcode(false)
      setScanning(false)
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true
          })
        ])
      ).start()
    }
  }, [scanMode, screenState])

  if (!permission) {
    return <View style={styles.container} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#FEFCF6', '#E9F1EB']} style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#6A9571" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            SAVR needs camera access to scan receipts and grocery items
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <LinearGradient colors={['#6A9571', '#8AB896']} style={styles.permissionButtonGradient}>
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    )
  }

  const handleScan = async (imageUri: string) => {
    setScreenState('analyzing')
    startPulseAnimation()

    try {
      // Convert image to base64
      const base64 = await scanningService.imageUriToBase64(imageUri)

      if (scanMode === 'receipt') {
        // Scan receipt (with validation and double-checking)
        const result = await scanningService.scanReceipt(base64)
        setScannedItems(result.items)
        setStoreName(result.store || 'Unknown Store')
        
        // Log receipt analysis with validation info
        // Calculate total correctly: price is unit price, multiply by quantity
        const calculatedTotal = result.calculatedTotal || result.items.reduce((sum, item) => {
          const unitPrice = item.price || 0
          const quantity = item.quantity || 1
          return sum + (unitPrice * quantity)
        }, 0)
        logger.debug('Receipt analysis complete', {
          store: result.store,
          itemCount: result.items.length,
          receiptTotal: result.receiptTotal,
          calculatedTotal: calculatedTotal,
          validationPassed: result.validationPassed,
          totalDifference: result.receiptTotal ? Math.abs(result.receiptTotal - calculatedTotal) : null,
          items: result.items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            bulkPackApplied: item.bulkPackApplied
          }))
        })
        
        // Warn if validation failed
        if (result.receiptTotal && !result.validationPassed) {
          const difference = Math.abs(result.receiptTotal - calculatedTotal)
          console.warn(`⚠️ Receipt total mismatch: Receipt shows $${result.receiptTotal.toFixed(2)}, calculated $${calculatedTotal.toFixed(2)} (difference: $${difference.toFixed(2)})`)
        }
        
        // Warn if receipt total wasn't extracted
        if (!result.receiptTotal) {
          console.warn('⚠️ Receipt total not extracted - some items may be missing')
        }
        
        // Update UI state FIRST before async operations
        setScreenState('results')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        
        // Save receipt and show budget impact (non-blocking)
        if (user?.id) {
          // Calculate total correctly
          // For weight-based items, price is already the LINE TOTAL (don't multiply)
          // For count-based items, price is UNIT PRICE (multiply by quantity)
          const calculatedTotal = result.items.reduce((sum, item) => {
            const price = item.price || 0
            const quantity = item.quantity || 1
            const isWeightBased = item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes((item.unit || '').toLowerCase())
            
            if (isWeightBased) {
              return sum + price // Price is already line total
            } else {
              return sum + (price * quantity) // Price is unit price
            }
          }, 0)
          
          // Run async operations without blocking UI
          receiptsService.saveReceipt({
            userId: user.id,
            scanResult: result
          }).then((saveResult) => {
            if (saveResult.success) {
              logger.debug('Receipt saved successfully', { total: calculatedTotal })
              
              // Fallback: Manually refresh receipts if real-time doesn't work
              setTimeout(async () => {
                try {
                  await refreshReceipts()
                  logger.debug('Receipts refreshed as fallback')
                } catch (error) {
                  logger.error('Error refreshing receipts', { error })
                }
              }, 1000)
              
              // 🧠 AI LEARNING: Learn prices from this receipt
              const receiptItemsForLearning = result.items
                .filter(item => item.price && item.price > 0)
                .map(item => ({
                  name: item.name,
                  quantity: item.quantity || 1,
                  price: item.price || 0,
                  unit: item.unit
                }))
              
              if (receiptItemsForLearning.length > 0) {
                priceLearningService.learnFromReceipt(user.id, {
                  store: result.store || 'Unknown Store',
                  date: new Date(),
                  items: receiptItemsForLearning
                }).then(() => {
                  logger.debug('Learned prices from receipt', { itemCount: receiptItemsForLearning.length })
                }).catch((error) => {
                  logger.error('Error learning prices', { error })
                })
              }
              
              // Get budget to show impact
              userPreferencesService.loadPreferences(user.id).then((preferences) => {
                const budgetGoal = preferences?.budget?.monthly || 0
                const monthlyBudget = typeof budgetGoal === 'number' ? budgetGoal : parseFloat(budgetGoal) || 0
                
                if (monthlyBudget > 0) {
                  const percentOfBudget = (calculatedTotal / monthlyBudget) * 100
                  logger.debug('Budget impact calculated', { percentOfBudget, monthlyBudget })
                  setBudgetImpact({ percentage: percentOfBudget, budget: monthlyBudget })
                }
              }).catch((error) => {
                logger.error('Error loading preferences', { error })
              })
            }
          }).catch((error) => {
            logger.error('Error saving receipt', { error })
          })
        }
      } else {
        // Scan single item
        const item = await scanningService.scanItem(base64)
        if (item) {
          setScannedItems([item])
          setStoreName('')
          setScreenState('results')
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        } else {
          throw new Error('Could not identify item')
        }
      }
    } catch (error) {
      logger.error('Scan error', { error, mode: scanMode })
      Alert.alert('Scan Failed', 'Could not process the image. Please try again.')
      setScreenState('camera')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    logger.debug('Barcode detected', { data, scanMode, scannedBarcode, scanning })
    
    if (scanMode !== 'barcode' || scannedBarcode || scanning) {
      logger.debug('Ignoring scan - wrong state')
      return
    }
    
    logger.debug('Processing barcode')
    setScannedBarcode(true)
    setScanning(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    try {
      // Validate barcode format (same as BarcodeScanner component)
      const barcodeInfo = barcodeService.getBarcodeInfo(data)
      if (!barcodeInfo.valid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Alert.alert('Invalid Barcode', 'This barcode format is not supported')
        setTimeout(() => {
          setScannedBarcode(false)
          setScanning(false)
        }, 2000)
        return
      }

      // Scan barcode (includes allergen check!)
      const result = await barcodeService.scanBarcode(data, user?.id || '')
      
      if (result.found && result.product) {
        // Product found - show result modal with allergen info
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setBarcodeResult(result)
        setShowBarcodeModal(true)
      } else {
        // Product not found - show manual entry
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setBarcodeResult(result)
        setShowManualEntry(true)
      }
    } catch (error) {
      logger.error('Barcode scan error', { error, barcode: data })
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Scan Error', 'Failed to process barcode. Please try again.')
      setTimeout(() => {
        setScannedBarcode(false)
        setScanning(false)
      }, 2000)
    }
  }

  const handleCloseBarcodeModal = () => {
    setShowBarcodeModal(false)
    setBarcodeResult(null)
    setScannedBarcode(false)
    setScanning(false)
    router.back()
  }

  const handleAddAnother = () => {
    setShowBarcodeModal(false)
    setBarcodeResult(null)
    setScannedBarcode(false)
    setScanning(false)
    // Stay on camera screen to scan another
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleManualEntrySuccess = (product: any) => {
    setShowManualEntry(false)
    setBarcodeResult({ found: true, product, barcode: product.barcode, allergenCheck: product.allergenCheck })
    setShowBarcodeModal(true)
  }

  const handleCloseManualEntry = () => {
    setShowManualEntry(false)
    setScannedBarcode(false)
    setScanning(false)
    router.back()
  }

  const handleTakePhoto = async () => {
    if (scanMode === 'barcode') {
      Alert.alert('Barcode Mode', 'Point camera at barcode to scan automatically. No need to take photo.')
      return
    }
    
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready')
      return
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      
      // Capture photo directly from camera view
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        skipProcessing: true,
      })

      if (photo?.uri) {
        await handleScan(photo.uri)
      }
    } catch (error) {
      logger.error('Camera error', { error })
      Alert.alert('Error', 'Failed to capture photo')
    }
  }

  const handleChooseFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
      })

      if (!result.canceled && result.assets[0]) {
        await handleScan(result.assets[0].uri)
      }
    } catch (error) {
      logger.error('Library error', { error })
      Alert.alert('Error', 'Failed to select photo')
    }
  }

  const handleAddToPantry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    let expiryPredictionsCount = 0
    
    for (const item of scannedItems) {
      // Auto-predict expiry date if not present
      let expiryDate = item.expiry_date
      let expiryPredicted = false
      
      if (!expiryDate) {
        const purchaseDate = new Date().toISOString().split('T')[0]
        const prediction = expiryPredictionService.predictExpiry(
          item.name,
          item.category,
          item.location as 'fridge' | 'freezer' | 'pantry',
          purchaseDate
        )
        
        // Use AI suggestion if confidence is medium or high
        if (prediction.confidence === 'high' || prediction.confidence === 'medium') {
          expiryDate = prediction.expiryDate
          expiryPredicted = true
          expiryPredictionsCount++
          logger.debug('AI expiry prediction', { itemName: item.name, expiryDate: prediction.expiryDate, days: prediction.days, confidence: prediction.confidence })
        } else {
          logger.debug('Low confidence expiry prediction', { itemName: item.name })
        }
      }
      
      await addItem({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        icon: item.emoji,
        price: item.price, // Include price for budget tracking
        store: storeName || undefined,
        purchase_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate, // Include predicted or existing expiry date
      })
    }

    // Calculate total and show budget impact (price is unit price, multiply by quantity)
    const total = scannedItems.reduce((sum, item) => {
      const unitPrice = item.price || 0
      const quantity = item.quantity || 1
      return sum + (unitPrice * quantity)
    }, 0)
    
    let message = `Added ${scannedItems.length} ${scannedItems.length === 1 ? 'item' : 'items'} to pantry`
    
    if (total > 0) {
      message += `\n\n💰 Total: $${total.toFixed(2)}\n📊 Budget automatically updated!`
    }
    
    if (expiryPredictionsCount > 0) {
      message += `\n\n📅 Expiry dates auto-predicted for ${expiryPredictionsCount} ${expiryPredictionsCount === 1 ? 'item' : 'items'}!`
    }

    Alert.alert('Success!', message, [
      {
        text: 'View Budget',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.push('/budget-tracking')
        },
      },
      {
        text: 'OK',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.back()
        },
      },
    ])
  }

  const handleScanAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setScreenState('camera')
    setScannedItems([])
    setStoreName('')
  }

  const handleEditItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const item = scannedItems[index]
    setEditingItemIndex(index)
    setEditedName(item.name)
    setEditedQuantity(item.quantity.toString())
  }

  const handleSaveEdit = () => {
    if (editingItemIndex === null) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    const updatedItems = [...scannedItems]
    updatedItems[editingItemIndex] = {
      ...updatedItems[editingItemIndex],
      name: editedName,
      quantity: parseInt(editedQuantity) || updatedItems[editingItemIndex].quantity,
    }
    
    setScannedItems(updatedItems)
    setEditingItemIndex(null)
    setEditedName('')
    setEditedQuantity('')
  }

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingItemIndex(null)
    setEditedName('')
    setEditedQuantity('')
  }

  // Camera Screen
  const renderCameraScreen = () => (
    <View style={styles.container}>
        <CameraView 
          ref={cameraRef} 
          style={styles.camera} 
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: [
              'upc_a', 
              'upc_e', 
              'ean13', 
              'ean8', 
              'qr'
            ],
          }}
          onBarcodeScanned={!scannedBarcode ? handleBarcodeScanned : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                router.back()
              }}
            >
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggleContainer}>
            <View style={styles.modeToggle}>
              <Pressable
                style={[styles.modeButton, scanMode === 'receipt' && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setScanMode('receipt')
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    scanMode === 'receipt' && styles.modeButtonTextActive,
                  ]}
                >
                  Receipt
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setScanMode('barcode')
                }}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    scanMode === 'barcode' && styles.modeButtonTextActive,
                  ]}
                >
                  Barcode
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Scan Overlay */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              
              {/* Animated Scan Line for Barcode Mode */}
              {scanMode === 'barcode' && !scannedBarcode && (
                <Animated.View
                  style={[
                    styles.scanLine,
                    { 
                      transform: [{ 
                        translateY: scanLineAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, width * 0.85 * 1.4 - 50]
                        })
                      }] 
                    }
                  ]}
                />
              )}
              
              {/* Scanning Indicator for Barcode Mode */}
              {scanning && scanMode === 'barcode' && (
                <View style={styles.barcodeScanningIndicator}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.barcodeScanningText}>
                    Scanning...
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.scanHint}>
              {scanMode === 'receipt'
                ? 'Position receipt within frame'
                : 'Point camera at barcode - auto-detects'}
            </Text>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            {scanMode === 'receipt' && (
              <>
                <Pressable style={styles.libraryButton} onPress={handleChooseFromLibrary}>
                  <Ionicons name="images-outline" size={28} color="#FFFFFF" />
                  <Text style={styles.libraryButtonText}>Library</Text>
                </Pressable>

                <Pressable style={styles.captureButton} onPress={handleTakePhoto}>
                  <LinearGradient colors={['#6A9571', '#8AB896']} style={styles.captureButtonGradient}>
                    <Ionicons name="camera" size={32} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>

                <View style={styles.libraryButton} />
              </>
            )}
            
            {scanMode === 'barcode' && (
              <View style={styles.barcodeInstructions}>
                <Ionicons name="scan-outline" size={32} color="#FFFFFF" />
                <Text style={styles.barcodeInstructionsText}>
                  Point camera at barcode
                </Text>
                <Text style={styles.barcodeInstructionsSubtext}>
                  Auto-scans when detected • Checks for allergens
                </Text>
              </View>
            )}
          </View>
        </CameraView>
      </View>
  )

  // Analyzing Screen
  const renderAnalyzingScreen = () => (
    <View style={styles.container}>
        <LinearGradient colors={['#FEFCF6', '#E9F1EB']} style={styles.analyzingContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.analyzingIconContainer}>
              <LinearGradient
                colors={['#6A9571', '#8AB896']}
                style={styles.analyzingIconGradient}
              >
                <Ionicons name="scan" size={64} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </Animated.View>

          <Text style={styles.analyzingTitle}>
            {scanMode === 'receipt' ? 'Analyzing Receipt...' : 'Looking Up Product...'}
          </Text>
          <Text style={styles.analyzingSubtitle}>
            {scanMode === 'receipt' ? 'Extracting items from your receipt' : 'Scanning barcode database'}
          </Text>

          <ActivityIndicator size="large" color="#6A9571" style={styles.loader} />
        </LinearGradient>
      </View>
  )

  // Results Screen (for receipt scanning)
  const renderResultsScreen = () => (
    <View style={styles.container}>
      <LinearGradient colors={['#FEFCF6', '#E9F1EB']} style={styles.resultsContainer}>
        {/* Header */}
        <View style={styles.resultsHeader}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Ionicons name="close" size={24} color="#000000" />
          </Pressable>
          <Text style={styles.resultsHeaderTitle}>
            {scanMode === 'receipt' ? 'Receipt Results' : 'Item Scanned'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Store Name & Total */}
        {storeName && (
          <View style={styles.storeNameContainer}>
            <Ionicons name="storefront" size={20} color="#6A9571" />
            <Text style={styles.storeName}>{storeName}</Text>
          </View>
        )}
        
        {/* Total & Budget Impact */}
        {scanMode === 'receipt' && scannedItems.length > 0 && (
          <>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Calculated Total</Text>
              <Text style={styles.totalAmount}>
                ${scannedItems.reduce((sum, item) => {
                  const unitPrice = item.price || 0
                  const quantity = item.quantity || 1
                  return sum + (unitPrice * quantity)
                }, 0).toFixed(2)}
              </Text>
            </View>
            
            {/* Budget Impact Badge */}
            {budgetImpact && (
              <View style={styles.budgetImpactContainer}>
                <Ionicons name="trending-up-outline" size={20} color="#6A9571" />
                <Text style={styles.budgetImpactText}>
                  {budgetImpact.percentage.toFixed(1)}% of your ${budgetImpact.budget.toFixed(0)} monthly budget
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push('/budget-tracking')
                  }}
                  style={styles.budgetImpactButton}
                >
                  <Text style={styles.budgetImpactButtonText}>View →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* Items List */}
        <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
          <Text style={styles.itemsCount}>
            {scannedItems.length} {scannedItems.length === 1 ? 'Item' : 'Items'} Found
          </Text>

          {scannedItems.map((item, index) => (
            <Pressable 
              key={index} 
              style={styles.itemCard}
              onPress={() => handleEditItem(index)}
            >
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemDivider}>•</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                </View>
                {item.bulkPackApplied && (
                  <View style={styles.bulkBadge}>
                    <Text style={styles.bulkBadgeText}>
                      📦 Bulk Pack ({item.originalQuantity} → {item.quantity})
                    </Text>
                  </View>
                )}
              </View>
              {item.price && (
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
              )}
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <Pressable
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleScanAnother}
          >
            <Text style={styles.secondaryButtonText}>Scan Another</Text>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleAddToPantry}>
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              style={styles.primaryButtonGradient}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Add to Pantry</Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* Edit Item Modal */}
        <Modal
          visible={editingItemIndex !== null}
          animationType="slide"
          transparent={true}
          onRequestClose={handleCancelEdit}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <Pressable 
              style={styles.modalOverlay}
              onPress={handleCancelEdit}
              activeOpacity={1}
            >
              <Pressable 
                style={styles.modalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Item</Text>
                  <Pressable onPress={handleCancelEdit} style={styles.modalClose}>
                    <Ionicons name="close" size={24} color="#000000" />
                  </Pressable>
                </View>

                <ScrollView 
                  style={styles.modalBody}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <Text style={styles.inputLabel}>Item Name</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder="Item name"
                    autoFocus={false}
                  />

                  <Text style={styles.inputLabel}>Quantity</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedQuantity}
                    onChangeText={(text) => {
                      // Only allow numbers, but allow empty while typing
                      const numbersOnly = text.replace(/[^0-9]/g, '')
                      setEditedQuantity(numbersOnly)
                    }}
                    onBlur={() => {
                      // Validate on blur - ensure minimum of 1
                      if (editedQuantity === '' || editedQuantity === '0' || parseInt(editedQuantity) < 1) {
                        setEditedQuantity('1')
                      } else {
                        // Ensure it's a valid number
                        const parsed = parseInt(editedQuantity)
                        if (!isNaN(parsed)) {
                          setEditedQuantity(parsed.toString())
                        }
                      }
                    }}
                    placeholder="Quantity"
                    keyboardType="numeric"
                  />
                </ScrollView>

                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={handleCancelEdit}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable style={styles.modalButton} onPress={handleSaveEdit}>
                    <LinearGradient
                      colors={['#6A9571', '#8AB896']}
                      style={styles.modalSaveButton}
                    >
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

      </LinearGradient>
    </View>
  )

  // Main component return
  return (
    <>
      {/* Show appropriate screen */}
      {screenState === 'results' && renderResultsScreen()}
      {screenState === 'camera' && renderCameraScreen()}
      {screenState === 'analyzing' && renderAnalyzingScreen()}

      {/* Barcode Result Modal - Always available */}
      <ScanResultModal
        visible={showBarcodeModal}
        product={barcodeResult?.product || null}
        allergenCheck={barcodeResult?.allergenCheck}
        onClose={handleCloseBarcodeModal}
        onAddAnother={handleAddAnother}
      />

      {/* Manual Product Entry - Always available */}
      <ManualProductEntry
        visible={showManualEntry}
        barcode={barcodeResult?.barcode || ''}
        onClose={handleCloseManualEntry}
        onSuccess={handleManualEntrySuccess}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  camera: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  modeButton: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  modeButtonActive: {
    backgroundColor: '#6A9571',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.7,
  },
  modeButtonTextActive: {
    opacity: 1,
  },
  scanOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: width * 0.85,
    height: width * 0.85 * 1.4,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHint: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 120,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#6A9571',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  barcodeScanningIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -40 }],
    alignItems: 'center',
  },
  barcodeScanningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 50,
    paddingHorizontal: 20,
    minHeight: 120,
  },
  barcodeInstructions: {
    alignItems: 'center',
    flex: 1,
  },
  barcodeInstructionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  barcodeInstructionsSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  libraryButton: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  libraryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  captureButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  analyzingIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    marginBottom: 32,
  },
  analyzingIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  analyzingSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
  },
  loader: {
    marginTop: 20,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  storeNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  totalContainer: {
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6A9571',
  },
  budgetImpactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(106, 149, 113, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  budgetImpactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
  },
  budgetImpactButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  budgetImpactButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemQuantity: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  itemDivider: {
    fontSize: 14,
    color: '#8E8E93',
  },
  itemCategory: {
    fontSize: 14,
    color: '#8E8E93',
  },
  bulkBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  bulkBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF9800',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6A9571',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '90%', // Ensure modal doesn't take full screen
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  modalClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
    flexGrow: 0, // Prevent body from expanding
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#000000',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalCancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalSaveButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})
