// Feature Highlight & Tooltip System
import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Modal,
} from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'

const { width, height } = Dimensions.get('window')

interface FeatureHighlightProps {
  visible: boolean
  onClose: () => void
  title: string
  description: string
  targetPosition?: { x: number; y: number; width: number; height: number }
  placement?: 'top' | 'bottom' | 'left' | 'right'
  animation?: 'fade' | 'pulse' | 'bounce'
}

export function FeatureHighlight({
  visible,
  onClose,
  title,
  description,
  targetPosition,
  placement = 'bottom',
  animation = 'pulse',
}: FeatureHighlightProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start()

      // Start pulsing animation
      if (animation === 'pulse') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start()
      }
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const getTooltipPosition = () => {
    if (!targetPosition) {
      return {
        top: height / 2 - 100,
        left: width / 2 - 150,
      }
    }

    const tooltipWidth = 300
    const tooltipHeight = 150
    const padding = 20

    switch (placement) {
      case 'top':
        return {
          top: targetPosition.y - tooltipHeight - padding,
          left: targetPosition.x + targetPosition.width / 2 - tooltipWidth / 2,
        }
      case 'bottom':
        return {
          top: targetPosition.y + targetPosition.height + padding,
          left: targetPosition.x + targetPosition.width / 2 - tooltipWidth / 2,
        }
      case 'left':
        return {
          top: targetPosition.y + targetPosition.height / 2 - tooltipHeight / 2,
          left: targetPosition.x - tooltipWidth - padding,
        }
      case 'right':
        return {
          top: targetPosition.y + targetPosition.height / 2 - tooltipHeight / 2,
          left: targetPosition.x + targetPosition.width + padding,
        }
      default:
        return {
          top: height / 2 - tooltipHeight / 2,
          left: width / 2 - tooltipWidth / 2,
        }
    }
  }

  const tooltipPosition = getTooltipPosition()

  if (!visible) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <BlurView intensity={40} style={styles.blurOverlay} />
        
        {/* Highlight circle around target */}
        {targetPosition && (
          <Animated.View
            style={[
              styles.highlightCircle,
              {
                top: targetPosition.y - 10,
                left: targetPosition.x - 10,
                width: targetPosition.width + 20,
                height: targetPosition.height + 20,
                borderRadius: (targetPosition.width + 20) / 2,
                opacity: fadeAnim,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}

        {/* Tooltip */}
        <Animated.View
          style={[
            styles.tooltip,
            {
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.tooltipContent}>
            <Text style={styles.tooltipTitle}>{title}</Text>
            <Text style={styles.tooltipDescription}>{description}</Text>
            <Pressable style={styles.gotItButton} onPress={handleClose}>
              <Text style={styles.gotItButtonText}>Got it!</Text>
            </Pressable>
          </View>
          
          {/* Arrow pointing to target */}
          {targetPosition && (
            <View
              style={[
                styles.tooltipArrow,
                placement === 'top' && styles.tooltipArrowBottom,
                placement === 'bottom' && styles.tooltipArrowTop,
                placement === 'left' && styles.tooltipArrowRight,
                placement === 'right' && styles.tooltipArrowLeft,
              ]}
            />
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  )
}

// Tour Guide Component for multiple highlights in sequence
interface TourStep {
  id: string
  title: string
  description: string
  targetRef?: any
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

interface FeatureTourProps {
  visible: boolean
  steps: TourStep[]
  onComplete: () => void
  onSkip: () => void
}

export function FeatureTour({ visible, steps, onComplete, onSkip }: FeatureTourProps) {
  const [currentStep, setCurrentStep] = React.useState(0)
  const [targetPosition, setTargetPosition] = React.useState<any>(null)

  useEffect(() => {
    if (visible && steps[currentStep]?.targetRef?.current) {
      // Measure target position
      steps[currentStep].targetRef.current.measure(
        (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
          setTargetPosition({ x: pageX, y: pageY, width, height })
        }
      )
    }
  }, [currentStep, visible])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setCurrentStep(0)
    onComplete()
  }

  const handleSkipTour = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setCurrentStep(0)
    onSkip()
  }

  if (!visible || !steps[currentStep]) return null

  return (
    <Modal visible={visible} transparent animationType="none">
      <Pressable style={styles.overlay} onPress={handleNext}>
        <BlurView intensity={40} style={styles.blurOverlay} />

        {/* Skip button */}
        <Pressable style={styles.skipTourButton} onPress={handleSkipTour}>
          <Text style={styles.skipTourButtonText}>Skip Tour</Text>
        </Pressable>

        {/* Progress indicator */}
        <View style={styles.tourProgress}>
          <Text style={styles.tourProgressText}>
            {currentStep + 1} of {steps.length}
          </Text>
        </View>

        {/* Highlight */}
        {targetPosition && (
          <Animated.View
            style={[
              styles.highlightCircle,
              {
                top: targetPosition.y - 10,
                left: targetPosition.x - 10,
                width: targetPosition.width + 20,
                height: targetPosition.height + 20,
                borderRadius: 16,
              },
            ]}
          />
        )}

        {/* Tooltip */}
        <View style={styles.tourTooltip}>
          <Text style={styles.tourTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.tourDescription}>{steps[currentStep].description}</Text>
          
          <View style={styles.tourButtons}>
            {currentStep > 0 && (
              <Pressable
                style={styles.tourBackButton}
                onPress={() => setCurrentStep(currentStep - 1)}
              >
                <Text style={styles.tourBackButtonText}>Back</Text>
              </Pressable>
            )}
            <Pressable style={styles.tourNextButton} onPress={handleNext}>
              <Text style={styles.tourNextButtonText}>
                {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

// Floating Action Button Hint
interface FABHintProps {
  visible: boolean
  onClose: () => void
  text: string
  position?: { bottom: number; right: number }
}

export function FABHint({ visible, onClose, text, position = { bottom: 100, right: 20 } }: FABHintProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const translateYAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        onClose()
      }, 5000)

      return () => clearTimeout(timer)
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 20,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.fabHint,
        {
          bottom: position.bottom,
          right: position.right,
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <Pressable onPress={onClose}>
        <Text style={styles.fabHintText}>{text}</Text>
        <View style={styles.fabHintArrow} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  highlightCircle: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#6A9571',
    backgroundColor: 'transparent',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  tooltip: {
    position: 'absolute',
    width: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  tooltipContent: {
    alignItems: 'center',
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  tooltipDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  gotItButton: {
    backgroundColor: '#6A9571',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  gotItButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tooltipArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  tooltipArrowTop: {
    top: -10,
    left: '50%',
    marginLeft: -10,
  },
  tooltipArrowBottom: {
    bottom: -10,
    left: '50%',
    marginLeft: -10,
    borderTopWidth: 0,
    borderBottomWidth: 10,
    borderBottomColor: '#FFFFFF',
  },
  tooltipArrowLeft: {
    left: -10,
    top: '50%',
    marginTop: -10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  tooltipArrowRight: {
    right: -10,
    top: '50%',
    marginTop: -10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 10,
    borderLeftWidth: 0,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
  
  // Tour styles
  skipTourButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  skipTourButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tourProgress: {
    position: 'absolute',
    top: 60,
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  tourProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6A9571',
  },
  tourTooltip: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  tourTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  tourDescription: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 24,
  },
  tourButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tourBackButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourBackButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A9571',
  },
  tourNextButton: {
    flex: 2,
    height: 48,
    backgroundColor: '#6A9571',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourNextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // FAB hint styles
  fabHint: {
    position: 'absolute',
    backgroundColor: '#6A9571',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabHintText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  fabHintArrow: {
    position: 'absolute',
    bottom: -6,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#6A9571',
  },
})

