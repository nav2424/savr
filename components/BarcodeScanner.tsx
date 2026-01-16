// SAVR Barcode Scanner Component - Beautiful camera-based barcode scanning
import React, { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Animated, Dimensions, Platform } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { barcodeService, ScanResult } from '../lib/BarcodeService'
import { useAuth } from '../lib/AuthContext'

const { width, height } = Dimensions.get('window')

interface BarcodeScannerProps {
  onScanSuccess: (result: ScanResult) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const { user } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string>('')
  const scanLineAnim = new Animated.Value(0)
  const lastScannedBarcode = useRef<string | null>(null)
  const lastScanTime = useRef<number>(0)

  useEffect(() => {
    // Animate scan line
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
  }, [])

  const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
    // Prevent duplicate scans: same barcode within 5 seconds
    const now = Date.now()
    if (lastScannedBarcode.current === data && (now - lastScanTime.current) < 5000) {
      console.log('Duplicate scan callback ignored - same barcode within 5 seconds')
      return
    }

    // Prevent if already scanned or scanning
    if (scanned || scanning || !user?.id) {
      console.log('Scan blocked - already scanned or scanning')
      return
    }

    // Mark this barcode as scanned IMMEDIATELY to prevent race conditions
    lastScannedBarcode.current = data
    lastScanTime.current = now
    setScanned(true)
    setScanning(true)
    setScanResult(data)

    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Validate barcode format
      const barcodeInfo = barcodeService.getBarcodeInfo(data)
      if (!barcodeInfo.valid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setScanResult('Invalid barcode format')
        setTimeout(() => {
          setScanned(false)
          setScanning(false)
          setScanResult('')
        }, 2000)
        return
      }

      // Scan barcode
      const result = await barcodeService.scanBarcode(data, user.id)

      if (result.found) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setScanResult(`Found: ${result.product?.name}`)
        setTimeout(() => {
          onScanSuccess(result)
        }, 500)
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setScanResult('Product not found')
        setTimeout(() => {
          onScanSuccess(result)
        }, 1000)
      }
    } catch (error) {
      console.error('Error scanning barcode:', error)
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setScanResult('Error scanning. Please try again.')
      setTimeout(() => {
        setScanned(false)
        setScanning(false)
        setScanResult('')
      }, 2000)
    }
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6A9571" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#F8FAF9', '#FFFFFF']}
          style={styles.permissionContainer}
        >
          <Ionicons name="camera-outline" size={80} color="#6A9571" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan product barcodes
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        </LinearGradient>
      </View>
    )
  }

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 250]
  })

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'qr'],
        }}
        onBarcodeScanned={(scanned || scanning) ? undefined : handleBarCodeScanned}
      >
        {/* Top Overlay */}
        <LinearGradient
          colors={['rgba(0, 0, 0, 0.7)', 'transparent']}
          style={styles.topOverlay}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onClose()
              }}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.headerTitle}>Scan Barcode</Text>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        {/* Scan Area */}
        <View style={styles.scanAreaContainer}>
          <View style={styles.scanArea}>
            {/* Corner Brackets */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />

            {/* Animated Scan Line */}
            {!scanned && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslateY }] }
                ]}
              />
            )}

            {/* Scanning Indicator */}
            {scanning && (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.scanningText}>
                  {scanResult || 'Scanning...'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.7)']}
          style={styles.bottomOverlay}
        >
          <View style={styles.instructions}>
            <Ionicons name="scan-outline" size={32} color="#FFFFFF" />
            <Text style={styles.instructionsText}>
              Position barcode within the frame
            </Text>
            <Text style={styles.instructionsSubtext}>
              The app will automatically scan and scale for your household
            </Text>
          </View>
        </LinearGradient>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  topOverlay: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scanAreaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanArea: {
    width: width * 0.7,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#6A9571',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
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
  scanningIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -60 }, { translateY: -40 }],
    alignItems: 'center',
  },
  scanningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  bottomOverlay: {
    paddingTop: 40,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  instructions: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  instructionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 12,
  },
  instructionsSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 24,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#6A9571',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 32,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
})

