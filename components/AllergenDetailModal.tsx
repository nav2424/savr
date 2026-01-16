// SAVR Allergen Detail Modal - Shows detected allergens in a scanned product
import React from 'react'
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { AllergenCheckResult } from '../lib/BarcodeService'

interface AllergenDetailModalProps {
  visible: boolean
  allergenCheck: AllergenCheckResult | null
  productName: string
  onClose: () => void
}

export default function AllergenDetailModal({ 
  visible, 
  allergenCheck, 
  productName,
  onClose 
}: AllergenDetailModalProps) {
  if (!allergenCheck) {
    return null
  }

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <Pressable 
        style={styles.overlay}
        onPress={handleClose}
      >
        <Pressable
          style={styles.popupContainer}
          onPress={(e) => e.stopPropagation()}
        >
          <LinearGradient
            colors={(() => {
              const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
              switch (riskLevel) {
                case 'HIGH_RISK':
                  return ['#FFF5F5', '#FFE5E5']
                case 'POSSIBLE_RISK':
                case 'INSUFFICIENT_DATA':
                  return ['#FFFBEB', '#FEF3C7'] // Amber/yellow
                case 'NO_MATCH_FOUND':
                default:
                  return ['#F0FFF4', '#E5FFE9']
              }
            })()}
            style={styles.popupContent}
          >
            {/* Close Button */}
            <Pressable
              style={styles.closeButtonTop}
              onPress={handleClose}
            >
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <View style={[
                styles.iconContainer,
                (() => {
                  const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                  switch (riskLevel) {
                    case 'HIGH_RISK':
                      return styles.iconContainerDanger
                    case 'POSSIBLE_RISK':
                    case 'INSUFFICIENT_DATA':
                      return { backgroundColor: 'rgba(251, 191, 36, 0.1)' }
                    case 'NO_MATCH_FOUND':
                    default:
                      return styles.iconContainerSafe
                  }
                })()
              ]}>
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
                  size={32} 
                  color={(() => {
                    const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                    switch (riskLevel) {
                      case 'HIGH_RISK':
                        return '#FF6B6B'
                      case 'POSSIBLE_RISK':
                      case 'INSUFFICIENT_DATA':
                        return '#F59E0B' // Amber
                      case 'NO_MATCH_FOUND':
                      default:
                        return '#6A9571'
                    }
                  })()}
                />
              </View>
              <Text style={styles.modalTitle}>
                {(() => {
                  const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                  switch (riskLevel) {
                    case 'HIGH_RISK':
                      return 'Allergen Warning'
                    case 'POSSIBLE_RISK':
                      return 'Possible Allergy Risk'
                    case 'INSUFFICIENT_DATA':
                      return 'Unable to Verify'
                    case 'NO_MATCH_FOUND':
                    default:
                      return 'Safe to Consume'
                  }
                })()}
              </Text>
              <Text style={styles.productNameText}>{productName}</Text>
            </View>

            <ScrollView 
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {(() => {
                const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                
                if (riskLevel === 'INSUFFICIENT_DATA') {
                  return (
                    <>
                      {/* Insufficient Data Message */}
                      <View style={styles.warningBox}>
                        <Ionicons name="alert-circle" size={20} color="#F59E0B" />
                        <Text style={styles.warningText}>
                          {allergenCheck.message || 'We couldn\'t verify ingredients for this product. Please confirm from the label.'}
                        </Text>
                      </View>
                      <Text style={styles.disclaimerText}>
                        ⚠️ Always read product labels carefully, as ingredients may change. This product may contain allergens not listed in our database.
                      </Text>
                    </>
                  )
                }
                
                if (riskLevel === 'POSSIBLE_RISK' || riskLevel === 'HIGH_RISK') {
                  return (
                    <>
                      {/* Detected Allergens */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                          {riskLevel === 'POSSIBLE_RISK' ? '⚠️ Possible Allergens' : '⚠️ Detected Allergens'}
                        </Text>
                        <Text style={styles.sectionDescription}>
                          {riskLevel === 'POSSIBLE_RISK' 
                            ? 'This product may contain the following allergens due to cross-contact or facility warnings:'
                            : 'This product contains the following allergens from your household:'}
                        </Text>
                        <View style={styles.allergenList}>
                          {allergenCheck.detectedAllergens.map((allergen, index) => (
                            <View key={index} style={styles.allergenItem}>
                              <View style={styles.allergenDot} />
                              <Text style={styles.allergenText}>{allergen}</Text>
                            </View>
                          ))}
                        </View>
                        {/* Show evidence if available */}
                        {allergenCheck.matches && allergenCheck.matches.length > 0 && (
                          <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Detection Details</Text>
                            {allergenCheck.matches
                              .filter(m => m.allergen === allergenCheck.detectedAllergens[0] || allergenCheck.detectedAllergens.includes(m.allergen))
                              .map((match, index) => (
                                <View key={index} style={styles.matchItem}>
                                  <Text style={styles.matchText}>
                                    Found "{match.matchedTerm}" in {match.source === 'traces' ? 'cross-contact warning' : match.source}
                                    {match.confidence === 'MEDIUM' && ' (possible match)'}
                                  </Text>
                                </View>
                              ))}
                          </View>
                        )}
                      </View>

                      {/* Warning Message */}
                      <View style={[styles.warningBox, riskLevel === 'POSSIBLE_RISK' && { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                        <Ionicons 
                          name="alert-circle" 
                          size={20} 
                          color={riskLevel === 'POSSIBLE_RISK' ? '#F59E0B' : '#FF6B6B'} 
                        />
                        <Text style={styles.warningText}>
                          {riskLevel === 'POSSIBLE_RISK'
                            ? 'This product may contain allergens due to cross-contact. Exercise caution and read the label carefully.'
                            : 'Do not consume this product if you or anyone in your household is allergic to the listed ingredients.'}
                        </Text>
                      </View>
                    </>
                  )
                }
                
                // NO_MATCH_FOUND case
                return (
                  <>
                    {/* Safe Message */}
                    <View style={styles.safeBox}>
                      <Ionicons name="checkmark-circle" size={24} color="#6A9571" />
                      <Text style={styles.safeText}>
                        {allergenCheck.message || 'This product does not contain any of your household\'s known allergens.'}
                      </Text>
                    </View>

                    {/* Your Allergens List */}
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Your Household Allergens</Text>
                      <View style={styles.allergenList}>
                        {allergenCheck.userAllergens.map((allergen, index) => (
                          <View key={index} style={styles.safeAllergenChip}>
                            <Text style={styles.safeAllergenChipText}>{allergen}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <Text style={styles.disclaimerText}>
                      💡 Always read product labels carefully, as ingredients may change.
                    </Text>
                  </>
                )
              })()}
            </ScrollView>


            {/* Close Button */}
            <View style={styles.buttonContainer}>
              <Pressable
                style={[
                  styles.closeButton,
                  (() => {
                    const riskLevel = allergenCheck.riskLevel || (allergenCheck.hasAllergens ? 'HIGH_RISK' : 'NO_MATCH_FOUND')
                    switch (riskLevel) {
                      case 'HIGH_RISK':
                        return styles.closeButtonDanger
                      case 'POSSIBLE_RISK':
                      case 'INSUFFICIENT_DATA':
                        return { backgroundColor: '#F59E0B' } // Amber
                      case 'NO_MATCH_FOUND':
                      default:
                        return styles.closeButtonSafe
                    }
                  })()
                ]}
                onPress={handleClose}
              >
                <Text style={styles.closeButtonText}>Got It</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 40,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  popupContent: {
    flex: 1,
  },
  closeButtonTop: {
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconContainerDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  iconContainerSafe: {
    backgroundColor: 'rgba(106, 149, 113, 0.2)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  productNameText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  buttonContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  allergenList: {
    gap: 8,
  },
  allergenItem: {
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
  allergenText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  matchItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#999999',
  },
  matchText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  warningBox: {
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
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#C92A2A',
    lineHeight: 20,
    fontWeight: '500',
  },
  safeBox: {
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
  safeText: {
    flex: 1,
    fontSize: 15,
    color: '#2D5F3E',
    lineHeight: 22,
    fontWeight: '500',
  },
  safeAllergenChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  safeAllergenChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D5F3E',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  closeButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonDanger: {
    backgroundColor: '#FF6B6B',
  },
  closeButtonSafe: {
    backgroundColor: '#6A9571',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
})

