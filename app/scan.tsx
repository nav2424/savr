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
import * as FileSystem from 'expo-file-system'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { scanningService, ScannedItem, ScanResult as ReceiptScanResult } from '../lib/ScanningService'
import { usePantry } from '../lib/PantryContext'
import { receiptsService } from '../lib/ReceiptsService'
import { useAuth } from '../lib/AuthContext'
import { useReceipts } from '../lib/ReceiptsContext'
import { userPreferencesService } from '../lib/UserPreferencesService'
import { expiryPredictionService } from '../lib/ExpiryPredictionService'
import { priceLearningService } from '../lib/PriceLearningService'
import { barcodeService, ScanResult } from '../lib/BarcodeService'
import { getBestResult } from '../lib/AllergenResultStore'
import ScanResultModal from '../components/ScanResultModal'
import ManualProductEntry from '../components/ManualProductEntry'
import { logger } from '../lib/Logger'
import { runWithConcurrency } from '../lib/asyncBatch'
import { useToast } from '../lib/ToastContext'

const { width } = Dimensions.get('window')

type ScanMode = 'receipt' | 'barcode'
type ScreenState = 'camera' | 'analyzing' | 'results'

export default function ScanScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { user } = useAuth()
  const { addItem } = usePantry()
  const { refreshReceipts } = useReceipts()
  const { showToast } = useToast()
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
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null)
  const [receiptCalculatedTotal, setReceiptCalculatedTotal] = useState(0)
  const [receiptNeedsReview, setReceiptNeedsReview] = useState(false)
  const [estimatedTax, setEstimatedTax] = useState<number | null>(null)
  const [receiptSubtotal, setReceiptSubtotal] = useState<number | null>(null)
  const [receiptTax, setReceiptTax] = useState<number | null>(null)
  const [receiptScanResult, setReceiptScanResult] = useState<ReceiptScanResult | null>(null)
  const [receiptSaved, setReceiptSaved] = useState(false)
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null)
  const [editedName, setEditedName] = useState('')
  const [editedQuantity, setEditedQuantity] = useState('')
  const [editedPrice, setEditedPrice] = useState('')
  const [budgetImpact, setBudgetImpact] = useState<{ percentage: number; budget: number } | null>(null)
  const [barcodeResult, setBarcodeResult] = useState<ScanResult | null>(null)
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanEtaSeconds, setScanEtaSeconds] = useState<number | null>(null)
  const [addingToPantry, setAddingToPantry] = useState(false)
  const cameraRef = useRef<any>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const scanLineAnim = useRef(new Animated.Value(0)).current
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scanStartTimeRef = useRef<number | null>(null)
  const receiptFlowCompletedRef = useRef(false)

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

  const isWeightBasedItem = (item: ScannedItem) =>
    !!item.unit && ['kg', 'lb', 'lbs', 'g', 'oz'].includes(item.unit.toLowerCase())

  const getLineTotal = (item: ScannedItem) => {
    const price = typeof item.price === 'number' ? item.price : 0
    const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
    return isWeightBasedItem(item) ? price : price * quantity
  }

  const calculateReceiptTotal = (items: ScannedItem[]) =>
    items.reduce((sum, item) => sum + getLineTotal(item), 0)

  const getEstimatedTaxFromDifference = (
    extractedTotal: number | null,
    calculated: number,
    provided?: number | null,
    receiptSubtotalValue?: number | null
  ) => {
    if (calculated <= 0.01) return null
    if (typeof provided === 'number' && provided > 0) return provided
    if (typeof receiptSubtotalValue === 'number' && receiptSubtotalValue > 0 && extractedTotal) {
      if (calculated < receiptSubtotalValue * 0.7) return null
      const diff = extractedTotal - receiptSubtotalValue
      return diff > 0.01 ? diff : null
    }
    if (!extractedTotal || extractedTotal <= 0 || calculated <= 0) return null
    if (calculated < extractedTotal * 0.7) return null
    const diff = extractedTotal - calculated
    if (diff <= 0.01) return null
    const ratio = diff / extractedTotal
    if (ratio < 0.02 || ratio > 0.15) return null
    return diff
  }

  const updateReceiptSummary = (
    items: ScannedItem[],
    extractedTotal: number | null,
    providedTax?: number | null,
    providedSubtotal?: number | null
  ) => {
    const calculated = calculateReceiptTotal(items)
    const hasReceiptSubtotal = typeof providedSubtotal === 'number' && providedSubtotal > 0
    const hasReceiptTax = typeof providedTax === 'number' && providedTax > 0
    const hasReceiptTotal = typeof extractedTotal === 'number' && extractedTotal > 0
    
    // The key validation: calculated should match subtotal (not total)
    // Tax accounts for the difference between subtotal and total
    const subtotalDifference = hasReceiptSubtotal ? Math.abs(providedSubtotal - calculated) : null
    
    // Validation passes if calculated matches subtotal within $0.50
    const subtotalMatches = subtotalDifference !== null && subtotalDifference <= 0.50
    
    // If we don't have explicit subtotal but have total and tax, derive it
    let derivedSubtotal = providedSubtotal
    let derivedTax = providedTax
    if (!hasReceiptSubtotal && hasReceiptTotal) {
      // Try to estimate tax as the difference between total and calculated
      const potentialTax = extractedTotal - calculated
      if (potentialTax > 0 && potentialTax / extractedTotal <= 0.15) {
        derivedSubtotal = calculated
        derivedTax = potentialTax
      }
    }
    
    const hasAllPrices = items.every(item => typeof item.price === 'number' && item.price > 0)
    
    // Needs review if calculated doesn't match subtotal OR if scan result marked needsReview
    // Enforce "no OCR = no auto-save" - if OCR failed, needsReview is true
    const needsReview =
      !hasAllPrices ||
      calculated <= 0.01 ||
      (hasReceiptSubtotal && !subtotalMatches) ||
      receiptScanResult?.needsReview === true
    
    setReceiptCalculatedTotal(calculated)
    setReceiptNeedsReview(needsReview)
    setEstimatedTax(derivedTax ?? null)
    setReceiptSubtotal(derivedSubtotal ?? null)
    return { calculated, subtotalDifference, hasReceiptTotal, needsReview }
  }

  const persistReceipt = async (scanResult: ReceiptScanResult, items: ScannedItem[]) => {
    if (!user?.id) return
    
    // CRITICAL: Use EXACT scan result object - do not reconstruct
    // Only update items if they're actually different (shouldn't happen, but safety check)
    const scanResultToSave: ReceiptScanResult = {
      ...scanResult,
      items: items.length > scanResult.items.length ? items : scanResult.items, // Only use items if more items
      // Preserve all flags exactly as they are
      needsReview: scanResult.needsReview ?? false,
      validationPassed: scanResult.validationPassed ?? false,
      subtotalMismatch: scanResult.subtotalMismatch ?? false,
      totalMismatch: scanResult.totalMismatch ?? false
    }
    
    // Log exact object being saved to confirm needsReview stays true
    // CRITICAL: This log must show needsReview=true if it was true in the scan result
    logger.debug('Saving receipt with exact scan result (right before save)', {
      itemCount: scanResultToSave.items.length,
      needsReview: scanResultToSave.needsReview,
      validationPassed: scanResultToSave.validationPassed,
      receiptTotal: scanResultToSave.receiptTotal,
      receiptSubtotal: scanResultToSave.receiptSubtotal,
      receiptTax: scanResultToSave.receiptTax,
      subtotalMismatch: scanResultToSave.subtotalMismatch,
      totalMismatch: scanResultToSave.totalMismatch,
      ocrFailed: scanResultToSave.needsReview === true && scanResultToSave.validationPassed === false ? 'likely' : 'no'
    })
    
    // Calculate total for budget BEFORE saving
    const calculatedSubtotal = calculateReceiptTotal(items)
    const taxAmount = scanResult.receiptTax ?? scanResult.estimatedTax ?? 0
    const totalForBudget = scanResult.receiptTotal ?? (calculatedSubtotal + taxAmount)
    
    await receiptsService.saveReceipt({
      userId: user.id,
      scanResult: scanResultToSave // Use exact object, no reconstruction
    }).then(async (saveResult) => {
      if (saveResult.success) {
        logger.debug('Receipt saved successfully', { total: totalForBudget })
        setReceiptSaved(true)
        
        // Immediately refresh receipts to update budget
        try {
          await refreshReceipts()
          logger.debug('Receipts refreshed - budget updated!', { total: totalForBudget })
        } catch (error) {
          logger.error('Error refreshing receipts', { error })
        }

        const receiptItemsForLearning = items
          .filter(item => item.price && item.price > 0)
          .map(item => ({
            name: item.name,
            quantity: item.quantity || 1,
            price: item.price || 0,
            unit: item.unit
          }))

        if (receiptItemsForLearning.length > 0) {
          priceLearningService.learnFromReceipt(user.id, {
            store: scanResult.store || 'Unknown Store',
            date: new Date(),
            items: receiptItemsForLearning
          }).then(() => {
            logger.debug('Learned prices from receipt', { itemCount: receiptItemsForLearning.length })
          }).catch((error) => {
            logger.error('Error learning prices', { error })
          })
        }

        userPreferencesService.loadPreferences(user.id).then((preferences) => {
          const budgetGoal = preferences?.budget?.monthly || 0
          const monthlyBudget = typeof budgetGoal === 'number' ? budgetGoal : parseFloat(budgetGoal) || 0

          if (monthlyBudget > 0) {
            // Use total (includes tax) for budget impact
            const percentOfBudget = (totalForBudget / monthlyBudget) * 100
            logger.debug('Budget impact calculated', { percentOfBudget, monthlyBudget, total: totalForBudget })
            setBudgetImpact({ percentage: percentOfBudget, budget: monthlyBudget })
          }
        })
      } else {
        logger.error('Error saving receipt', { error: saveResult.error })
      }
    })
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

  React.useEffect(() => {
    if (screenState !== 'analyzing') {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current)
        scanTimerRef.current = null
      }
      scanStartTimeRef.current = null
      setScanProgress(0)
      setScanEtaSeconds(null)
      return
    }

    // Receipt scanning can take up to 2 minutes for large receipts
    const estimatedMs = scanMode === 'receipt' ? 90000 : 15000
    scanStartTimeRef.current = Date.now()
    setScanProgress(0.02)
    setScanEtaSeconds(Math.round(estimatedMs / 1000))

    scanTimerRef.current = setInterval(() => {
      if (!scanStartTimeRef.current) return
      const elapsed = Date.now() - scanStartTimeRef.current
      // Progress bar fills to 85% over estimated time, then slows down
      // This prevents showing 0s while still processing
      const baseProgress = Math.min(elapsed / estimatedMs, 0.85)
      // After 85%, slow down progress significantly
      const extraProgress = elapsed > estimatedMs ? Math.min((elapsed - estimatedMs) / (estimatedMs * 2), 0.10) : 0
      const targetProgress = baseProgress + extraProgress
      
      // Calculate remaining time - minimum 5s while still processing
      let remainingSeconds: number
      if (elapsed < estimatedMs) {
        remainingSeconds = Math.max(5, Math.round((estimatedMs - elapsed) / 1000))
      } else {
        // After estimated time, show "Almost done..." instead of 0
        remainingSeconds = -1 // Signal to show different text
      }
      
      setScanProgress((prev) => Math.max(prev, targetProgress))
      setScanEtaSeconds(remainingSeconds)
    }, 500)

    return () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current)
        scanTimerRef.current = null
      }
    }
  }, [screenState, scanMode])

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
              <Text style={styles.permissionButtonText}>Continue</Text>
            </LinearGradient>
          </Pressable>
        </LinearGradient>
      </View>
    )
  }

  const handleScan = async (imageUri: string) => {
    if (receiptFlowCompletedRef.current) return
    setScreenState('analyzing')
    startPulseAnimation()
    setScanProgress(0)
    setScanEtaSeconds(null)

    try {
      if (scanMode === 'receipt') {
        // Scan receipt (with validation and double-checking)
        // Pass imageUri directly - scanReceipt will preprocess it for OCR
        const result = await scanningService.scanReceipt(imageUri)
        if (!result.items.length) {
          Alert.alert('Scan Failed', 'No items were detected. Please retake the photo.')
          setScreenState('camera')
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          return
        }
        setScannedItems(result.items)
        setStoreName(result.store || 'Unknown Store')
        // Ensure receiptTotal is set - use calculated total if receiptTotal is missing
        const finalReceiptTotal = result.receiptTotal || 
          (result.receiptSubtotal && result.receiptTax 
            ? result.receiptSubtotal + result.receiptTax 
            : result.calculatedTotal || null)
        setReceiptTotal(finalReceiptTotal)
        setReceiptSubtotal(result.receiptSubtotal || null)
        setReceiptTax(result.receiptTax || null)
        setReceiptScanResult(result)
        setReceiptSaved(false)
        
        // Log receipt analysis with validation info
        const { calculated, needsReview } = updateReceiptSummary(
          result.items,
          result.receiptTotal || null,
          result.estimatedTax ?? null,
          result.receiptSubtotal ?? null
        )
        logger.debug('Receipt analysis complete', {
          store: result.store,
          itemCount: result.items.length,
          receiptTotal: result.receiptTotal,
          calculatedTotal: calculated,
          validationPassed: result.validationPassed,
          totalDifference: result.receiptTotal ? Math.abs(result.receiptTotal - calculated) : null,
          estimatedTax: result.estimatedTax,
          receiptSubtotal: result.receiptSubtotal,
          receiptTax: result.receiptTax,
          items: result.items.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            bulkPackApplied: item.bulkPackApplied
          }))
        })
        
        // Warn if validation failed
        if (result.receiptTotal && !result.validationPassed && !result.estimatedTax) {
          const difference = Math.abs(result.receiptTotal - calculated)
          logger.warn('Receipt total mismatch', {
            receiptTotal: result.receiptTotal,
            calculated,
            difference,
          })
        }
        
        // Warn if receipt total wasn't extracted
        if (!result.receiptTotal) {
          logger.warn('Receipt total not extracted - some items may be missing')
        }
        
        // Update UI state FIRST before async operations
        setScanProgress(1)
        setScreenState('results')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        
        // Removed review required alert - user can still save even if totals don't match
        if (false) { // Disabled review check
          // This block is intentionally disabled
        } else {
          // Never auto-save when needsReview is true or validation failed
          if (!needsReview && result.validationPassed) {
            // CRITICAL: Use EXACT result object - do not reconstruct or override flags
            await persistReceipt(result, result.items)
          } else {
            // CRITICAL: Log the EXACT needsReview from result object, not the local variable
            logger.debug('Receipt not auto-saved', {
              needsReview: result.needsReview,
              validationPassed: result.validationPassed,
              itemCount: result.items.length,
              receiptTotal: result.receiptTotal
            })
          }
        }
      } else {
        // Scan single item (scanItem expects base64)
        const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const item = await scanningService.scanItem(imageBase64)
        if (item) {
          setScanProgress(1)
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
      showToast('Scan failed. Please try again.', { kind: 'error', durationMs: 3500 })
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
        showToast('Invalid barcode format (not supported).', { kind: 'warning', durationMs: 3500 })
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
      showToast('Failed to process barcode. Please try again.', { kind: 'error', durationMs: 3500 })
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
    // Navigate to pantry instead of going back (safer - avoids GO_BACK error)
    router.push('/(tabs)/pantry')
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
    // Navigate to pantry instead of going back (safer - avoids GO_BACK error)
    router.push('/(tabs)/pantry')
  }

  const handleTakePhoto = async () => {
    if (scanMode === 'barcode') {
      showToast('Barcode mode: point camera at the barcode to scan automatically.', { kind: 'info', durationMs: 3000 })
      return
    }
    
    if (!cameraRef.current) {
      showToast('Camera not ready.', { kind: 'error', durationMs: 3000 })
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
      showToast('Failed to capture photo.', { kind: 'error', durationMs: 3500 })
    }
  }

  const handleChooseFromLibrary = async () => {
    try {
      // Request media library permissions if needed
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select images.',
          [{ text: 'OK' }]
        )
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1.0,
        base64: false, // We'll convert to base64 in handleScan if needed
      })

      if (!result.canceled && result.assets[0]) {
        try {
          await handleScan(result.assets[0].uri)
        } catch (scanError: any) {
          // Handle errors from handleScan separately
          logger.error('Scan error after library selection', { 
            error: scanError || 'Unknown scan error',
            errorType: typeof scanError,
            errorString: String(scanError)
          })
          Alert.alert(
            'Scan Error',
            scanError?.message || 'Failed to process the selected image. Please try again.'
          )
          setScreenState('camera')
        }
      }
    } catch (error: any) {
      // Handle null errors gracefully
      if (error === null || error === undefined) {
        logger.error('Library error (null)', { 
          errorType: 'null',
          message: 'Error object was null or undefined'
        })
        Alert.alert('Error', 'Failed to select photo. Please try again.')
        return
      }

      // Capture more error details
      const errorDetails = {
        message: error?.message || String(error) || 'Unknown error',
        code: error?.code,
        name: error?.name,
        type: typeof error,
        stringified: String(error),
      }
      logger.error('Library error', { error: errorDetails })
      Alert.alert(
        'Error',
        error?.message || String(error) || 'Failed to select photo. Please try again.'
      )
    }
  }

  const handleAddToPantry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setAddingToPantry(true)
    
    try {
      // 1. Batch add all items in parallel for speed
      const purchaseDate = new Date().toISOString().split('T')[0]
      let expiryPredictionsCount = 0
      
      const tasks = scannedItems.map((item) => async () => {
        // Auto-predict expiry date if not present
        let expiryDate = item.expiry_date
        let expiryPredicted = false
        
        if (!expiryDate) {
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
          }
        }
        
        return addItem({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          location: item.location,
          icon: item.emoji,
          price: item.price, // Include price for budget tracking
          store: storeName || undefined,
          purchase_date: purchaseDate,
          expiry_date: expiryDate, // Include predicted or existing expiry date
        })
      })
      
      // Add items with a small concurrency limit to avoid UI/network spikes on big receipts.
      // (Parallel enough to be fast, but not "500 requests at once".)
      const results = await runWithConcurrency(tasks, 8)
      
      // Log any failures but don't block the flow
      const failures = results.filter(r => r.status === 'rejected')
      if (failures.length > 0) {
        logger.warn('Some items failed to add to pantry', { 
          failedCount: failures.length, 
          totalCount: tasks.length 
        })
        // Show a warning but don't block - user can see what was added
        if (failures.length === tasks.length) {
          // All items failed - this is a real error
          throw new Error('Failed to add items to pantry')
        }
      }
      
      // 2. Save receipt to history and update budget
      if (receiptScanResult && user?.id) {
        // Calculate total for budget (use receipt total which includes tax - this is what user actually paid)
        const calculatedSubtotal = calculateReceiptTotal(scannedItems)
        const taxAmount = receiptTax ?? estimatedTax ?? 0
        const total = typeof receiptTotal === 'number' && receiptTotal > 0
          ? receiptTotal
          : calculatedSubtotal + taxAmount
        
        // Ensure receiptTotal is set in scan result if it wasn't already
        const scanResultToSave: ReceiptScanResult = {
          ...receiptScanResult,
          items: scannedItems,
          receiptTotal: receiptTotal ?? total,
          receiptSubtotal: receiptSubtotal ?? calculatedSubtotal,
          receiptTax: receiptTax ?? estimatedTax ?? taxAmount
        }
        
        // Save receipt to history (this will trigger budget update via realtime)
        await persistReceipt(scanResultToSave, scannedItems)
      }
      
      // 3. Mark receipt flow done, reset state, then replace with pantry (no back stack)
      receiptFlowCompletedRef.current = true
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setAddingToPantry(false)
      resetReceiptState()
      router.replace('/(tabs)/pantry')
      
    } catch (error) {
      logger.error('Error adding items to pantry', { error })
      setAddingToPantry(false)
      Alert.alert('Error', 'Failed to add items to pantry. Please try again.')
    }
  }

  const resetReceiptState = () => {
    setScreenState('camera')
    setScannedItems([])
    setStoreName('')
    setReceiptTotal(null)
    setReceiptSubtotal(null)
    setReceiptTax(null)
    setReceiptCalculatedTotal(0)
    setReceiptNeedsReview(false)
    setEstimatedTax(null)
    setReceiptScanResult(null)
    setReceiptSaved(false)
    setBudgetImpact(null)
  }

  const handleScanAnother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    receiptFlowCompletedRef.current = false
    resetReceiptState()
  }

  const handleEditItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const item = scannedItems[index]
    setEditingItemIndex(index)
    setEditedName(item.name)
    setEditedQuantity(item.quantity.toString())
    setEditedPrice(typeof item.price === 'number' ? item.price.toFixed(2) : '')
  }

  const handleSaveEdit = () => {
    if (editingItemIndex === null) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    const updatedItems = [...scannedItems]
    const parsedPrice = parseFloat(editedPrice)
    updatedItems[editingItemIndex] = {
      ...updatedItems[editingItemIndex],
      name: editedName,
      quantity: parseInt(editedQuantity) || updatedItems[editingItemIndex].quantity,
      price: !isNaN(parsedPrice) ? parsedPrice : updatedItems[editingItemIndex].price,
    }
    
    setScannedItems(updatedItems)
    const extractedTotal = receiptTotal ?? receiptScanResult?.receiptTotal ?? null
    const { needsReview } = updateReceiptSummary(
      updatedItems,
      extractedTotal,
      receiptScanResult?.estimatedTax ?? null,
      receiptScanResult?.receiptSubtotal ?? null
    )
    // Never auto-save when needsReview is true or validation failed
    if (!needsReview && receiptScanResult && !receiptSaved && receiptScanResult.validationPassed) {
      const calculatedTotal = calculateReceiptTotal(updatedItems)
      // CRITICAL: Use EXACT receiptScanResult object - only update items if needed
      // Preserve all flags (needsReview, validationPassed, etc.) exactly as they are
      const scanResultToSave: ReceiptScanResult = {
        ...receiptScanResult,
        items: updatedItems.length > receiptScanResult.items.length ? updatedItems : receiptScanResult.items,
        receiptTotal: extractedTotal || receiptScanResult.receiptTotal,
        calculatedTotal
        // DO NOT override validationPassed or needsReview - preserve original flags
      }
      
      persistReceipt(scanResultToSave, updatedItems)
    }
    setEditingItemIndex(null)
    setEditedName('')
    setEditedQuantity('')
    setEditedPrice('')
  }

  const handleCancelEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditingItemIndex(null)
    setEditedName('')
    setEditedQuantity('')
    setEditedPrice('')
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
        />
        {/* Overlay content using absolute positioning */}
        {/* Header */}
        <View style={styles.header}>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                receiptFlowCompletedRef.current = true
                resetReceiptState()
                router.replace('/(tabs)/pantry')
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

            <View style={styles.scanHintContainer}>
              <Text style={styles.scanHint}>
                {scanMode === 'receipt'
                  ? 'Position receipt within frame'
                  : 'Point camera at barcode - auto-detects'}
              </Text>
              {scanMode === 'receipt' && (
                <Text style={styles.receiptTip}>
                  Hold steady and frame the full receipt for fastest, most accurate results.
                </Text>
              )}
            </View>
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

          {scanMode === 'receipt' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(scanProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {scanEtaSeconds === null 
                  ? 'Starting...'
                  : scanEtaSeconds < 0 
                    ? 'Almost done, finalizing...' 
                    : `Estimated time remaining: ${scanEtaSeconds}s`}
              </Text>
              <Text style={styles.progressHint}>
                {scanEtaSeconds !== null && scanEtaSeconds < 0 
                  ? 'Large receipts may take a bit longer'
                  : 'This is an estimate and may vary by receipt size.'}
              </Text>
            </View>
          )}

          <ActivityIndicator size="large" color="#6A9571" style={styles.loader} />
        </LinearGradient>
      </View>
  )

  // Results Screen (for receipt scanning)
  const renderResultsScreen = () => (
    <View style={styles.container}>
      {addingToPantry && (
        <View style={styles.addingToPantryOverlay}>
          <ActivityIndicator size="large" color="#6A9571" />
          <Text style={styles.addingToPantryText}>Adding to pantry...</Text>
        </View>
      )}
      <LinearGradient colors={['#FEFCF6', '#E9F1EB']} style={styles.resultsContainer}>
        {/* Header */}
        <View style={styles.resultsHeader}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                receiptFlowCompletedRef.current = true
                resetReceiptState()
                router.replace('/(tabs)/pantry')
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
              <View>
                <Text style={styles.totalLabel}>RECEIPT TOTAL</Text>
                {receiptSubtotal !== null && (
                  <Text style={styles.totalSubtext}>
                    Subtotal: {`$${receiptSubtotal.toFixed(2)}`}
                  </Text>
                )}
                {(receiptTax ?? estimatedTax) !== null && (
                  <Text style={styles.totalSubtext}>
                    Tax: {`$${(receiptTax ?? estimatedTax ?? 0).toFixed(2)}`}
                  </Text>
                )}
              </View>
              <Text style={styles.totalAmount}>
                {(() => {
                  // Calculate total: prefer receiptTotal, then subtotal+tax, then calculated total
                  const total = receiptTotal ?? 
                    (receiptSubtotal !== null 
                      ? (receiptSubtotal + (receiptTax ?? estimatedTax ?? 0))
                      : receiptCalculatedTotal)
                  return `$${(total || 0).toFixed(2)}`
                })()}
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
                <View style={styles.itemPriceContainer}>
                  <Text style={styles.itemPrice}>${getLineTotal(item).toFixed(2)}</Text>
                  {!isWeightBasedItem(item) && item.quantity > 1 && (
                    <Text style={styles.itemPriceSubtext}>
                      ${item.price.toFixed(2)} each
                    </Text>
                  )}
                </View>
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

          <Pressable
            style={styles.actionButton}
            onPress={handleAddToPantry}
          >
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

                  <Text style={styles.inputLabel}>Price on Receipt</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editedPrice}
                    onChangeText={(text) => {
                      const sanitized = text.replace(/[^0-9.]/g, '')
                      setEditedPrice(sanitized)
                    }}
                    onBlur={() => {
                      if (editedPrice === '') return
                      const parsed = parseFloat(editedPrice)
                      if (!isNaN(parsed)) {
                        setEditedPrice(parsed.toFixed(2))
                      }
                    }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
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

      {/* Barcode Result Modal - Always available; use best result by source priority (MANUAL > OCR > OFF) */}
      <ScanResultModal
        visible={showBarcodeModal}
        product={barcodeResult?.product || null}
        allergenCheck={
          barcodeResult?.scanSessionId
            ? (getBestResult(barcodeResult.scanSessionId)?.result ?? barcodeResult?.allergenCheck)
            : barcodeResult?.allergenCheck
        }
        scanSessionId={barcodeResult?.scanSessionId}
        barcode={barcodeResult?.barcode}
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
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
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
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
  scanHintContainer: {
    marginTop: 24,
    marginBottom: 120,
  },
  scanHint: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  receiptTip: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 50,
    paddingHorizontal: 20,
    minHeight: 120,
    zIndex: 10,
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
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 6,
    backgroundColor: '#E0E8E2',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6A9571',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E6B58',
    marginBottom: 4,
  },
  progressHint: {
    fontSize: 12,
    color: '#6A6A6A',
    textAlign: 'center',
  },
  loader: {
    marginTop: 20,
  },
  addingToPantryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  addingToPantryText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
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
  totalSubtext: {
    fontSize: 12,
    color: '#6A9571',
    marginTop: 4,
    textAlign: 'right',
  },
  receiptWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  receiptWarningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
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
  itemPriceContainer: {
    alignItems: 'flex-end',
  },
  itemPriceSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 2,
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
  actionButtonDisabled: {
    opacity: 0.6,
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
