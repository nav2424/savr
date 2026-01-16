// SAVR Barcode Scanning Screen
import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import BarcodeScanner from '../components/BarcodeScanner'
import ScanResultModal from '../components/ScanResultModal'
import ManualProductEntry from '../components/ManualProductEntry'
import { ScanResult, ScannedProduct } from '../lib/BarcodeService'
import * as Haptics from 'expo-haptics'

export default function ScanBarcodeScreen() {
  const router = useRouter()
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showScanner, setShowScanner] = useState(true)

  const handleScanSuccess = (result: ScanResult) => {
    setScanResult(result)
    setShowScanner(false)

    if (result.found && result.product) {
      // Product found - show result
      setShowResultModal(true)
    } else {
      // Product not found - show manual entry
      setShowManualEntry(true)
    }
  }

  const handleCloseScanner = () => {
    router.back()
  }

  const handleCloseResult = () => {
    setShowResultModal(false)
    router.back()
  }

  const handleAddAnother = () => {
    setShowResultModal(false)
    setScanResult(null)
    setShowScanner(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleManualEntrySuccess = (product: ScannedProduct) => {
    setShowManualEntry(false)
    setScanResult({ found: true, product, barcode: product.barcode })
    setShowResultModal(true)
  }

  const handleCloseManualEntry = () => {
    setShowManualEntry(false)
    router.back()
  }

  return (
    <View style={styles.container}>
      {showScanner && (
        <BarcodeScanner
          onScanSuccess={handleScanSuccess}
          onClose={handleCloseScanner}
        />
      )}

      <ScanResultModal
        visible={showResultModal}
        product={scanResult?.product || null}
        allergenCheck={scanResult?.allergenCheck}
        onClose={handleCloseResult}
        onAddAnother={handleAddAnother}
      />

      <ManualProductEntry
        visible={showManualEntry}
        barcode={scanResult?.barcode || ''}
        onClose={handleCloseManualEntry}
        onSuccess={handleManualEntrySuccess}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
})

