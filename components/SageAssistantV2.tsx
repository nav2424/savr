// SAGE - Hyper-Personalized AI Assistant for SAVR
import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Audio } from 'expo-av'
import * as Speech from 'expo-speech'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { chatWithSage, parseCommandFromResponse } from '../lib/openai'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { usePantry } from '../lib/PantryContext'
import { userPreferencesService } from '../lib/UserPreferencesService'
import { receiptsService } from '../lib/ReceiptsService'
// RECIPES TEMPORARILY DISABLED FOR LAUNCH
// import SimpleRecipeImage from './SimpleRecipeImage'


interface Message {
  id: string
  text: string
  sender: 'user' | 'sage'
  timestamp: Date
  quickOptions?: string[]
  quickOptionsUsed?: boolean // Track if quick options have been used
  recipeOption?: {
    optionNumber: number
    name: string
    description: string
    calories: number
    protein: number
    carbs: number
    fat: number
    time: number
    keyIngredients: string
  }
  fullRecipe?: {
    id?: string // Recipe ID from database
    title: string
    description: string
    meal_type: string
    servings: number
    prep_time: number
    cook_time: number
    difficulty: string
    calories: number
    protein: number
    carbs: number
    fat: number
    ingredients: { name: string; quantity: string; unit: string }[]
    instructions: { step: number; description: string }[]
    tags: string[]
  }
}

interface SageAssistantProps {
  onPantryCommand?: (action: 'remove' | 'add', itemName: string, quantity: number, unit?: string, category?: string, location?: string) => void
  onListCommand?: (action: 'add', itemName: string, listName: string, quantity: number) => void
}

// Animated Quick Options Component - appears one by one
interface AnimatedQuickOptionsProps {
  options: string[]
  onOptionPress: (option: string) => void
}

function AnimatedQuickOptions({ options, onOptionPress }: AnimatedQuickOptionsProps) {
  const [animatedValues] = useState(() =>
    options.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(10)
    }))
  )

  useEffect(() => {
    // Reset animations for fresh start
    animatedValues.forEach(anim => {
      anim.opacity.setValue(0)
      anim.translateY.setValue(10)
    })

    // Animate each option one by one with stagger
    const animations = animatedValues.map((anim, index) => {
      return Animated.sequence([
        Animated.delay(index * 100), // 100ms delay between each option
        Animated.parallel([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateY, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ])
    })

    Animated.stagger(0, animations).start()
  }, [])

  return (
    <View style={styles.quickOptionsContainer}>
      {options.map((option, index) => (
        <Animated.View
          key={index}
          style={{
            opacity: animatedValues[index].opacity,
            transform: [{ translateY: animatedValues[index].translateY }],
          }}
        >
          <Pressable
            style={styles.quickOptionButton}
            onPress={() => onOptionPress(option)}
          >
            <LinearGradient
              colors={['rgba(106, 149, 113, 0.15)', 'rgba(138, 184, 150, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickOptionGradient}
            >
              <Text style={styles.quickOptionText}>{option}</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  )
}

export default function SageAssistant({ onPantryCommand, onListCommand }: SageAssistantProps) {
  const { user } = useAuth()
  const { items: pantryItems } = usePantry()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [showSage, setShowSage] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hey! I'm SAGE, your AI grocery assistant.\n\nI can help you manage collaborative grocery lists, track receipts, monitor your digital pantry, stay on budget, and check for allergens.\n\nJust ask me anything!",
      sender: 'sage',
      timestamp: new Date(),
      quickOptions: undefined // No quick options in initial message
    }
  ])
  const [inputText, setInputText] = useState('')
  const [pulseAnim] = useState(new Animated.Value(1))
  const scrollViewRef = useRef<ScrollView>(null)
  
  // Voice recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingAnim] = useState(new Animated.Value(1))
  
  // Voice response state
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [sound, setSound] = useState<Audio.Sound | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  // Live conversation mode
  const [liveMode, setLiveMode] = useState(false)
  const [liveModeAnim] = useState(new Animated.Value(1))
  const liveRecordingTimeout = useRef<NodeJS.Timeout | null>(null)

  // Pantry selection modal state
  const [showPantrySelector, setShowPantrySelector] = useState(false)
  const [selectedPantryNames, setSelectedPantryNames] = useState<string[]>([])
  const [userPreferences, setUserPreferences] = useState<any>(null)
  const [receipts, setReceipts] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        if (user?.id) {
          const prefs = await userPreferencesService.loadPreferences(user.id)
          setUserPreferences(prefs)
          
          // Load receipts for spending analysis
          const receiptsResult = await receiptsService.getUserReceipts(user.id)
          if (receiptsResult.success && receiptsResult.receipts) {
            setReceipts(receiptsResult.receipts)
          }
        }
      } catch (e) {
        console.error('Failed to load user data', e)
      }
    })()
  }, [user?.id])

  useEffect(() => {
    if (showSage) {
      startPulseAnimation()
    } else {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)
    }
  }, [showSage])

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }

  // Heuristic: derive quick options from a SAGE question when AI omitted [QUICK_OPTIONS]
  const deriveQuickOptionsFromMessage = (text?: string): string[] | undefined => {
    // DISABLED: No quick options should be shown
    return undefined
    const t = text ?? ''
    if (t.includes('how much time do you have')) {
      return ['Quick (15-30 min)', 'Moderate (30-60 min)', 'I have time (60+ min)']
    }
    if (t.includes('prefer something quick and easy') || t.includes('quick and easy') || (t.includes('effort') && (t.includes('willing') || t.includes('put in')))) {
      return ['Quick & easy', 'Willing to put in effort']
    }
    if (t.includes('difficulty level') || (t.includes('difficulty') && t.includes('preference'))) {
      return ['Quick & easy', 'Willing to put in effort']
    }
    if (t.includes('dietary preferences') || t.includes('dietary restrictions')) {
      return ['High protein', 'Low carb', 'Vegetarian', 'No restrictions']
    }
    if (t.includes('cuisine preference') || t.includes('any cuisine') || (t.includes('preference') && (t.includes('cuisine') || t.includes('style')))) {
      return ['Italian', 'Mexican', 'Asian', 'No preference']
    }
    // Catch-all for general preference questions that shouldn't use Yes/No
    if (
      (t.includes('preference') || t.includes('any particular') || t.includes('would you like')) &&
      !t.includes('yes') && !t.includes('no') &&
      !t.includes('eating alone') && !t.includes('use items')
    ) {
      // Check if it's asking about a specific type of preference (cuisine, dietary, etc.)
      if (t.includes('cuisine') || t.includes('style') || t.includes('flavor')) {
        return ['I have a preference', 'No preference']
      }
      // Generic preference question
      return ['I have a preference', 'No preference']
    }
    // LAST RESORT: Only use Yes/No for true yes/no questions (check for specific patterns)
    // For preference/choice questions, use descriptive options
    if (t.trim().endsWith('?')) {
      // Check if it's a preference/choice question - use descriptive options
      if (t.includes('preference') || t.includes('choice') || t.includes('any particular') || t.includes('style') || t.includes('cuisine')) {
        return ['I have a preference', 'No preference']
      }
      // Only for true yes/no questions
      if (t.includes('are you') || t.includes('do you') || t.includes('is it') || t.includes('can you')) {
        return ['Yes', 'No']
      }
      // Default to descriptive options for ambiguous questions
      return ['I have a preference', 'No preference']
    }
    return undefined
  }

  const openSage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowSage(true)
  }

  const closeSage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowSage(false)
    // Exit live mode if active
    if (liveMode) {
      exitLiveMode()
    }
    // Stop recording if active
    if (isRecording) {
      stopRecording()
    }
    // Stop and unload any playing audio
    if (sound) {
      try {
        await sound.stopAsync()
        await sound.unloadAsync()
      } catch (err) {
        console.error('Error stopping audio:', err)
      }
      setSound(null)
      setIsSpeaking(false)
    }
  }

  // Voice recording functions
  const startRecording = async () => {
    try {
      // If already recording, ignore
      if (isRecording || recording) {
        return
      }
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice input.')
        return
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      // Create new recording
      const newRecording = new Audio.Recording()
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await newRecording.startAsync()
      
      setRecording(newRecording)
      setIsRecording(true)
      
      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start()
      
    } catch (err) {
      console.error('Failed to start recording:', err)
      Alert.alert('Error', 'Failed to start recording. Please try again.')
      // Clean up on error
      setRecording(null)
      setIsRecording(false)
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      
      setIsRecording(false)
      recordingAnim.stopAnimation()
      recordingAnim.setValue(1)
      
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      })
      
      const uri = recording.getURI()
      setRecording(null)
      
      if (uri) {
        // Send audio to OpenAI Whisper for transcription
        await transcribeAudio(uri)
      }
      
    } catch (err) {
      console.error('Failed to stop recording:', err)
      Alert.alert('Error', 'Failed to process recording. Please try again.')
    }
  }

  const transcribeAudio = async (uri: string) => {
    try {
      // Show loading message
      const loadingId = Date.now().toString()
      const loadingMessage: Message = {
        id: loadingId,
        text: 'Transcribing...',
        sender: 'user',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, loadingMessage])
      
      // Call OpenAI Whisper API
      const formData = new FormData()
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any)
      formData.append('model', 'whisper-1')
      
      // Get API key from config
      const config = require('../config').default
      const apiKey = config?.openaiApiKey
      
      if (!apiKey) {
        // Remove loading message and fall back to typing
        setMessages(prev => prev.filter(m => m.id !== loadingId))
        Alert.alert('Voice unavailable', 'Voice transcription requires the server proxy with OPENAI_API_KEY.')
        return
      }
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Transcription failed')
      }
      
      const data = await response.json()
      const transcribedText = data.text
      
      // Remove loading message
      setMessages(prev => prev.filter(m => m.id !== loadingId))
      
      // Set input text and send
      if (transcribedText && transcribedText.trim()) {
        setInputText(transcribedText)
        // Trigger send after setting input text
        setTimeout(() => {
          sendMessage()
        }, 100)
      }
      
    } catch (err) {
      console.error('Failed to transcribe audio:', err)
      // Remove loading message
      setMessages(prev => prev.filter(m => m.text === 'Transcribing...'))
      Alert.alert('Error', 'Failed to transcribe audio. Please try typing instead.')
    }
  }

  // Text-to-speech function
  const speakText = async (text: string) => {
    if (!voiceEnabled) return
    
    try {
      // Stop any currently playing audio
      if (sound) {
        await sound.stopAsync()
        await sound.unloadAsync()
        setSound(null)
      }
      
      setIsSpeaking(true)
      
      // Get API key
      const config = require('../config').default
      const apiKey = config?.openaiApiKey
      
      if (!apiKey) {
        // Fallback to device TTS if no key
        Speech.speak(text, { language: 'en-US', rate: 0.95 })
        return
      }
      
      // Call OpenAI TTS API
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova', // Natural, warm female voice
          input: text,
          speed: 1.0,
        }),
      })
      
      if (!response.ok) {
        // Fallback to device TTS on API failure (e.g., 429 insufficient_quota)
        Speech.speak(text, { language: 'en-US', rate: 0.95 })
        setIsSpeaking(false)
        return
      }
      
      // Get audio blob and convert to base64
      const audioBlob = await response.blob()
      const reader = new FileReader()
      
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string
          
          // Configure audio mode for playback
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          })
          
          // Create and play sound
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: base64Audio },
            { shouldPlay: true }
          )
          
          setSound(newSound)
          
          // Listen for when playback finishes
          newSound.setOnPlaybackStatusUpdate((status: any) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsSpeaking(false)
              newSound.unloadAsync()
              setSound(null)
            }
          })
          
        } catch (err) {
          console.error('Error playing audio:', err)
          setIsSpeaking(false)
        }
      }
      
      reader.readAsDataURL(audioBlob)
      
    } catch (err) {
      console.error('Failed to generate speech:', err)
      // Final safety fallback to device TTS
      try {
        Speech.speak(text, { language: 'en-US', rate: 0.95 })
      } catch (innerErr) {
        console.error('Device TTS fallback failed:', innerErr)
      }
      setIsSpeaking(false)
    }
  }

  // Live conversation mode functions
  const enterLiveMode = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow microphone access for live mode.')
        return
      }
      
      setLiveMode(true)
      setVoiceEnabled(true) // Force voice on for live mode
      
      // Start pulsing animation for live mode
      Animated.loop(
        Animated.sequence([
          Animated.timing(liveModeAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(liveModeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start()
      
      // Add system message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: "Live mode active! Start speaking - I'll listen and respond naturally.",
        sender: 'sage',
        timestamp: new Date()
      }])
      
      // Auto-start first recording
      setTimeout(() => {
        startLiveRecording()
      }, 500)
      
    } catch (err) {
      console.error('Failed to enter live mode:', err)
      Alert.alert('Error', 'Failed to start live mode. Please try again.')
    }
  }

  const exitLiveMode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    setLiveMode(false)
    liveModeAnim.stopAnimation()
    liveModeAnim.setValue(1)
    
    // Clear timeout
    if (liveRecordingTimeout.current) {
      clearTimeout(liveRecordingTimeout.current)
      liveRecordingTimeout.current = null
    }
    
    // Stop recording if active
    if (isRecording && recording) {
      try {
        await recording.stopAndUnloadAsync()
        setRecording(null)
        setIsRecording(false)
      } catch (err) {
        console.error('Error stopping live recording:', err)
      }
    }
    
    // Add system message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: "Live mode ended. You can now use text or voice messages.",
      sender: 'sage',
      timestamp: new Date()
    }])
  }

  const startLiveRecording = async () => {
    // Don't start if already recording or SAGE is speaking
    if (isRecording || isSpeaking || !liveMode) return
    
    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      // Create new recording
      const newRecording = new Audio.Recording()
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      await newRecording.startAsync()
      
      setRecording(newRecording)
      setIsRecording(true)
      
      // Auto-stop after 10 seconds (or when user pauses)
      liveRecordingTimeout.current = setTimeout(() => {
        stopLiveRecording()
      }, 10000)
      
    } catch (err) {
      console.error('Failed to start live recording:', err)
    }
  }

  const stopLiveRecording = async () => {
    if (!recording || !liveMode) return
    
    try {
      // Clear timeout
      if (liveRecordingTimeout.current) {
        clearTimeout(liveRecordingTimeout.current)
        liveRecordingTimeout.current = null
      }
      
      setIsRecording(false)
      
      await recording.stopAndUnloadAsync()
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      })
      
      const uri = recording.getURI()
      setRecording(null)
      
      if (uri) {
        // Transcribe and process
        await transcribeAndProcessLive(uri)
      }
      
    } catch (err) {
      console.error('Failed to stop live recording:', err)
    }
  }

  const transcribeAndProcessLive = async (uri: string) => {
    try {
      // Get API key
      const config = require('../config').default
      const apiKey = config?.openaiApiKey
      
      if (!apiKey) {
        Alert.alert('Voice unavailable', 'Voice transcription requires the server proxy with OPENAI_API_KEY.')
        return
      }
      
      // Call OpenAI Whisper API
      const formData = new FormData()
      formData.append('file', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any)
      formData.append('model', 'whisper-1')
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Transcription failed')
      }
      
      const data = await response.json()
      const transcribedText = data.text
      
      // If text is meaningful, process it
      if (transcribedText && transcribedText.trim().length > 2) {
        // Hide ALL quick options from previous messages when user sends any message
        setMessages(prev => prev.map(msg => 
          msg.quickOptions ? { ...msg, quickOptionsUsed: true } : msg
        ))
        
        // Add user message
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          text: transcribedText,
          sender: 'user',
          timestamp: new Date()
        }])
        
        // Process with SAGE
        await processLiveMessage(transcribedText)
      } else {
        // Silent or no speech - restart recording
        if (liveMode) {
          setTimeout(() => startLiveRecording(), 300)
        }
      }
      
    } catch (err) {
      console.error('Failed to transcribe live audio:', err)
      // Restart recording on error
      if (liveMode) {
        setTimeout(() => startLiveRecording(), 500)
      }
    }
  }

  const processLiveMessage = async (userText: string) => {
    try {
      // Hide ALL quick options from previous messages when user sends any message
      setMessages(prev => prev.map(msg => 
        msg.quickOptions ? { ...msg, quickOptionsUsed: true } : msg
      ))
      
      // Get AI response
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text
      }))
      
      const aiResponse = await chatWithSage(userText, conversationHistory, pantryItems, userPreferences, receipts)
      const { type, data, cleanResponse, quickOptions } = parseCommandFromResponse(aiResponse)
      
      // DISABLED: No quick options should be shown
      const derivedQuickOptions = undefined
      
      // Execute commands
      if (type === 'pantry_remove' && onPantryCommand) {
        onPantryCommand('remove', data.itemName, data.quantity)
      } else if (type === 'pantry_add' && onPantryCommand) {
        onPantryCommand('add', data.itemName, data.quantity, data.unit, data.category, data.location)
      } else if (type === 'list_add' && onListCommand) {
        onListCommand('add', data.itemName, data.listName, data.quantity)
      }
      
      // Add SAGE response
      // DISABLED: No quick options should be shown
      const shouldShowQuickOptions = undefined
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: cleanResponse,
        sender: 'sage',
        timestamp: new Date(),
        quickOptions: shouldShowQuickOptions
      }])
      
      // Speak response
      await speakText(cleanResponse)
      
      // After speaking, restart recording
      if (liveMode) {
        setTimeout(() => startLiveRecording(), 500)
      }
      
    } catch (err) {
      console.error('Failed to process live message:', err)
      // Restart recording on error
      if (liveMode) {
        setTimeout(() => startLiveRecording(), 500)
      }
    }
  }

  const processCommand = (text: string) => {
    const lowerText = text.toLowerCase()
    
    // Parse pantry ADD commands: "add a banana to my pantry", "add 2 lbs of chicken to my pantry"
    const pantryAddPatterns = [
      /add (?:a |an )?(\d+)?\s*(?:(lbs?|oz|kg|g|pieces?|cartons?|bags?|bottles?|containers?)\s+of\s+)?(.+?)\s+to\s+(?:my\s+)?pantry/,
      /add (?:a |an )?(\d+)?\s*(.+?)\s+to\s+(?:my\s+)?(fridge|freezer|pantry)/,
    ]
    
    for (const pattern of pantryAddPatterns) {
      const match = lowerText.match(pattern)
      if (match) {
        const quantity = match[1] ? parseInt(match[1], 10) : 1
        const unit = match[2] || 'pieces'
        let itemName = (match[3] || match[2]).trim()
        const location = match[4] || 'pantry'
        
        // Determine category and location based on item name
        let category = 'pantry'
        let storageLocation: 'fridge' | 'freezer' | 'pantry' = 'pantry'
        
        // Produce - usually in fridge
        if (itemName.match(/(banana|apple|orange|tomato|lettuce|cucumber|carrot|broccoli|spinach|avocado|lemon|lime|onion|garlic|potato|pepper)/i)) {
          category = 'produce'
          storageLocation = 'fridge'
        }
        // Meat - fridge or freezer
        else if (itemName.match(/(chicken|beef|pork|fish|salmon|turkey|steak|meat|lamb)/i)) {
          category = 'meat'
          storageLocation = location === 'freezer' ? 'freezer' : 'fridge'
        }
        // Dairy - fridge
        else if (itemName.match(/(milk|cheese|yogurt|butter|cream|eggs?)/i)) {
          category = 'dairy'
          storageLocation = 'fridge'
        }
        // Grains - pantry
        else if (itemName.match(/(rice|pasta|bread|oats|cereal|flour|quinoa)/i)) {
          category = 'grains'
          storageLocation = 'pantry'
        }
        // Frozen items
        else if (location === 'freezer') {
          storageLocation = 'freezer'
          category = 'frozen'
        }
        
        if (onPantryCommand) {
          onPantryCommand('add', itemName, quantity, unit, category, storageLocation)
        }
        
        return `Added ${quantity} ${unit} of ${itemName} to your ${storageLocation}.`
      }
    }
    
    // Parse pantry REMOVE commands
    const pantryRemovePatterns = [
      /i ate (?:a |an )?(\d+)?\s*(.+)/,
      /ate (?:a |an )?(\d+)?\s*(.+)/,
      /consumed (?:a |an )?(\d+)?\s*(.+)/,
      /used (?:a |an )?(\d+)?\s*(.+)/,
      /finished (?:a |an )?(\d+)?\s*(.+)/,
    ]
    
    for (const pattern of pantryRemovePatterns) {
      const match = lowerText.match(pattern)
      if (match) {
        const quantity = match[1] ? parseInt(match[1], 10) : 1
        const itemName = match[2].trim()
        
        if (onPantryCommand) {
          onPantryCommand('remove', itemName, quantity)
        }
        
        return `I've removed ${quantity} ${itemName} from your pantry.`
      }
    }
    
    // Parse list commands
    const listAddPatterns = [
      /add (?:a |an )?(\d+)?\s*(.+?)\s+to\s+(.+)/,
      /put (?:a |an )?(\d+)?\s*(.+?)\s+(?:on|in|to)\s+(?:my\s+)?(.+?)(?:\s+list|\s+groceries)?$/,
    ]
    
    for (const pattern of listAddPatterns) {
      const match = lowerText.match(pattern)
      if (match) {
        const quantity = match[1] ? parseInt(match[1], 10) : 1
        const itemName = match[2].trim()
        const listName = match[3].trim()
        
        if (onListCommand) {
          onListCommand('add', itemName, listName, quantity)
        }
        
        return `Added ${quantity} ${itemName} to "${listName}".`
      }
    }
    
    // Default responses for other queries
    if (lowerText.includes('recipe') || lowerText.includes('cook') || lowerText.includes('make')) {
      return "I can help you find recipes! Try asking \"What can I make with chicken and rice?\" or browse the Recipes tab for inspiration."
    }
    
    return "I'm not sure I understood that. Try:\n• \"I ate a banana\"\n• \"Add milk to weekly groceries\"\n• \"What can I cook with chicken?\""
  }

  // Handle quick option button press
  const handleQuickOptionPress = async (option: string, messageId?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    // Hide ALL quick options from previous messages when user sends any message
    setMessages(prev => prev.map(msg => 
      msg.quickOptions ? { ...msg, quickOptionsUsed: true } : msg
    ))

    // Intercept pantry selection flow to show multi-select UI
    if (option.toLowerCase() === 'use pantry items') {
      setSelectedPantryNames([])
      setShowPantrySelector(true)
      return
    }
    
    // Add user message with the selected option
    const userMessage: Message = {
      id: Date.now().toString(),
      text: option,
      sender: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
    
    // Add "typing" indicator
    const typingMessage: Message = {
      id: 'typing',
      text: 'SAGE is thinking...',
      sender: 'sage',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, typingMessage])
    
    try {
      // Get conversation history for context
      const conversationHistory = messages
        .filter(m => m.id !== 'typing')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text
        }))
      
      // Call OpenAI with the selected option
      const aiResponse = await chatWithSage(option, conversationHistory, pantryItems, userPreferences, receipts)
      
      // Parse response for commands
      const { type, data, cleanResponse, quickOptions } = parseCommandFromResponse(aiResponse)
      // DISABLED: No quick options should be shown
      const derivedQuickOptions = undefined
      
      // Execute commands
      let recipeId: string | null = null
      if (type === 'create_recipe' && user) {
        recipeId = await createRecipeInDatabase(data, user.id)
      } else if (type === 'pantry_remove' && onPantryCommand) {
        onPantryCommand('remove', data.itemName, data.quantity)
      } else if (type === 'pantry_add' && onPantryCommand) {
        onPantryCommand('add', data.itemName, data.quantity, data.unit, data.category, data.location)
      } else if (type === 'list_add' && onListCommand) {
        onListCommand('add', data.itemName, data.listName, data.quantity)
      }
      
      // Format recipe data for display if CREATE_RECIPE
      let fullRecipe = undefined
      if (type === 'create_recipe' && data) {
        fullRecipe = {
          id: recipeId || undefined, // Add the recipe ID from database
          title: data.title || '',
          description: data.description || '',
          meal_type: data.meal_type || 'dinner',
          servings: data.servings ? parseInt(String(data.servings), 10) : 1, // Default to 1, not 2
          prep_time: data.prep_time ? parseInt(String(data.prep_time), 10) : 0,
          cook_time: data.cook_time ? parseInt(String(data.cook_time), 10) : 0,
          difficulty: data.difficulty || 'Easy',
          calories: data.calories ? parseInt(String(data.calories), 10) : 0,
          protein: data.protein ? parseInt(String(data.protein), 10) : 0,
          carbs: data.carbs ? parseInt(String(data.carbs), 10) : 0,
          fat: data.fat ? parseInt(String(data.fat), 10) : 0,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients.map((ing: string) => {
            const parts = ing.match(/^([\d.\/]+)\s+(\w+)\s+(.+)$/) || ['', '1', '', ing]
            return {
              name: parts[3] || ing,
              quantity: parts[1] || '1',
              unit: parts[2] || ''
            }
          }) : [],
          instructions: Array.isArray(data.instructions) ? data.instructions.map((inst: string | { step: number; description: string }, index: number) => 
            typeof inst === 'string' 
              ? { step: index + 1, description: inst }
              : inst
          ) : [],
          tags: data.tags || []
        }
      }
      
      // Remove typing indicator and add real response
      // DISABLED: No quick options should be shown
      const shouldShowQuickOptions = undefined
      
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== 'typing')
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: cleanResponse,
          sender: 'sage',
          timestamp: new Date(),
          quickOptions: shouldShowQuickOptions,
          recipeOption: type === 'recipe_option' ? data : undefined,
          fullRecipe
        }]
      })
      
      // Speak the response if voice is enabled
      if (voiceEnabled && cleanResponse) {
        speakText(cleanResponse)
      }
      
    } catch (error) {
      const errorMessage = 'Sorry, I encountered an error. Please make sure your OpenAI API key is configured correctly.'
      
      // Remove typing indicator and show error
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== 'typing')
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: errorMessage,
          sender: 'sage',
          timestamp: new Date()
        }]
      })
      
      // Speak error if voice is enabled
      if (voiceEnabled) {
        speakText(errorMessage)
      }
    }
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  // Create recipe in database
  const createRecipeInDatabase = async (recipeData: any, userId: string): Promise<string | null> => {
    try {
      // Format ingredients and instructions as JSONB
      const ingredients = recipeData.ingredients.map((ing: string) => {
        const parts = ing.match(/^([\d.\/]+)\s+(\w+)\s+(.+)$/) || ['', '1', '', ing]
        return {
          name: parts[3] || ing,
          quantity: parts[1] || '1',
          unit: parts[2] || ''
        }
      })

      const instructions = recipeData.instructions.map((inst: string, index: number) => ({
        step: index + 1,
        description: inst
      }))

      const { data, error } = await supabase
        .from('recipes')
        .insert({
          title: recipeData.title,
          description: recipeData.description,
          meal_type: recipeData.meal_type || 'dinner',
          servings: recipeData.servings || 4,
          prep_time: recipeData.prep_time || 15,
          cook_time: recipeData.cook_time || 30,
          difficulty: recipeData.difficulty || 'Easy',
          calories: recipeData.calories,
          protein: recipeData.protein,
          carbs: recipeData.carbs,
          fat: recipeData.fat,
          ingredients,
          instructions,
          tags: recipeData.tags || [],
          image_url: null, // Can be enhanced later with AI-generated images
          created_by: userId, // Use user's UUID, not 'sage'
          source: 'ai_generated',
          is_public: false // Keep AI recipes private
        })
        .select()
        .single()

      if (error) throw error
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      console.log('Recipe created successfully:', data)
      return data.id
      
    } catch (error) {
      console.error('Error creating recipe:', error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return null
    }
  }

  const sendMessage = async () => {
    if (!inputText.trim()) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    const userMessageText = inputText
    
    // Hide ALL quick options from previous messages when user sends any message
    setMessages(prev => prev.map(msg => 
      msg.quickOptions ? { ...msg, quickOptionsUsed: true } : msg
    ))
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: userMessageText,
      sender: 'user',
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInputText('')
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
    
    // Add "typing" indicator
    const typingMessage: Message = {
      id: 'typing',
      text: 'SAGE is thinking...',
      sender: 'sage',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, typingMessage])
    
    try {
      // Get conversation history for context
      const conversationHistory = messages
        .filter(m => m.id !== 'typing')
        .map(m => ({
          role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text
        }))
      
      // Call OpenAI with pantry context
      const aiResponse = await chatWithSage(userMessageText, conversationHistory, pantryItems, userPreferences, receipts)
      
      // Parse response for commands
      const { type, data, cleanResponse, quickOptions } = parseCommandFromResponse(aiResponse)
      // DISABLED: No quick options should be shown
      const derivedQuickOptions = undefined
      
      // Execute commands
      let recipeId: string | null = null
      if (type === 'create_recipe' && user) {
        recipeId = await createRecipeInDatabase(data, user.id)
      } else if (type === 'pantry_remove' && onPantryCommand) {
        onPantryCommand('remove', data.itemName, data.quantity)
      } else if (type === 'pantry_add' && onPantryCommand) {
        onPantryCommand('add', data.itemName, data.quantity, data.unit, data.category, data.location)
      } else if (type === 'list_add' && onListCommand) {
        onListCommand('add', data.itemName, data.listName, data.quantity)
      }
      
      // Format recipe data for display if CREATE_RECIPE
      let fullRecipe = undefined
      if (type === 'create_recipe' && data) {
        fullRecipe = {
          id: recipeId || undefined, // Add the recipe ID from database
          title: data.title || '',
          description: data.description || '',
          meal_type: data.meal_type || 'dinner',
          servings: data.servings ? parseInt(String(data.servings), 10) : 1, // Default to 1, not 2
          prep_time: data.prep_time ? parseInt(String(data.prep_time), 10) : 0,
          cook_time: data.cook_time ? parseInt(String(data.cook_time), 10) : 0,
          difficulty: data.difficulty || 'Easy',
          calories: data.calories ? parseInt(String(data.calories), 10) : 0,
          protein: data.protein ? parseInt(String(data.protein), 10) : 0,
          carbs: data.carbs ? parseInt(String(data.carbs), 10) : 0,
          fat: data.fat ? parseInt(String(data.fat), 10) : 0,
          ingredients: Array.isArray(data.ingredients) ? data.ingredients.map((ing: string) => {
            const parts = ing.match(/^([\d.\/]+)\s+(\w+)\s+(.+)$/) || ['', '1', '', ing]
            return {
              name: parts[3] || ing,
              quantity: parts[1] || '1',
              unit: parts[2] || ''
            }
          }) : [],
          instructions: Array.isArray(data.instructions) ? data.instructions.map((inst: string | { step: number; description: string }, index: number) => 
            typeof inst === 'string' 
              ? { step: index + 1, description: inst }
              : inst
          ) : [],
          tags: data.tags || []
        }
      }
      
      // Remove typing indicator and add real response
      // DISABLED: No quick options should be shown
      const shouldShowQuickOptions = undefined
      
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== 'typing')
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: cleanResponse,
          sender: 'sage',
          timestamp: new Date(),
          quickOptions: shouldShowQuickOptions,
          recipeOption: type === 'recipe_option' ? data : undefined,
          fullRecipe
        }]
      })
      
      // Speak the response if voice is enabled
      if (voiceEnabled && cleanResponse) {
        speakText(cleanResponse)
      }
      
    } catch (error) {
      const errorMessage = 'Sorry, I encountered an error. Please make sure your OpenAI API key is configured correctly.'
      
      // Remove typing indicator and show error
      setMessages(prev => {
        const withoutTyping = prev.filter(m => m.id !== 'typing')
        return [...withoutTyping, {
          id: Date.now().toString(),
          text: errorMessage,
          sender: 'sage',
          timestamp: new Date()
        }]
      })
      
      // Speak error if voice is enabled
      if (voiceEnabled) {
        speakText(errorMessage)
      }
    }
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true })
    }, 100)
  }

  return (
    <>
      {/* Floating SAGE Button */}
      <Animated.View style={[
        styles.sageButton,
        {
          bottom: Math.max(100, 60 + insets.bottom),
          right: Math.max(20, insets.right),
          transform: [{ scale: pulseAnim }],
        }
      ]}>
        <Pressable
          style={styles.sageButtonInner}
          onPress={openSage}
        >
          {/* Glassmorphic Background */}
          <View style={styles.glassBackground} />
          
          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(106, 149, 113, 0.7)', 'rgba(138, 184, 150, 0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sageGradient}
          />
          
          {/* Inner Glow */}
          <View style={styles.innerGlow} />
          
          {/* Icon Container */}
          <View style={styles.iconContainer}>
            <Text style={styles.sageIcon}>S</Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* SAGE Chat Modal */}
      <Modal
        visible={showSage}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeSage}
      >
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <LinearGradient
            colors={['#FEFCF6', '#E9F1EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.chatGradient}
          />
          
          {/* Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              <View style={styles.sageAvatar}>
                <LinearGradient
                  colors={['rgba(106, 149, 113, 0.7)', 'rgba(138, 184, 150, 0.9)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sageAvatarGradient}
                />
                <Text style={styles.sageAvatarText}>S</Text>
              </View>
              <View>
                <Text style={styles.chatTitle}>SAGE</Text>
                <Text style={styles.chatSubtitle}>AI Kitchen Assistant</Text>
              </View>
            </View>
            <Pressable style={styles.chatCloseButton} onPress={closeSage}>
              <Text style={styles.chatCloseText}>✕</Text>
            </Pressable>
          </View>
          
          {/* Messages */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message) => (
              <View key={message.id}>
                {/* Recipe Option Card */}
                {message.recipeOption && message.recipeOption.name && message.recipeOption.calories && message.recipeOption.time ? (
                  <View style={styles.recipeOptionCard}>
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.recipeOptionGradient}
                    >
                      {/* Option Header */}
                      <View style={styles.recipeOptionHeader}>
                        <View style={styles.recipeOptionNumber}>
                          <Text style={styles.recipeOptionNumberText}>
                            {message.recipeOption.optionNumber}
                          </Text>
                        </View>
                        <View style={styles.recipeOptionTitleSection}>
                          <Text style={styles.recipeOptionName}>{message.recipeOption.name}</Text>
                          <Text style={styles.recipeOptionDescription}>
                            {message.recipeOption.description}
                          </Text>
                        </View>
                      </View>

                      {/* Nutrition Grid */}
                      <View style={styles.nutritionGrid}>
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionValue}>{message.recipeOption.calories}</Text>
                          <Text style={styles.nutritionLabel}>Calories</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionValue}>{message.recipeOption.protein}g</Text>
                          <Text style={styles.nutritionLabel}>Protein</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionValue}>{message.recipeOption.carbs}g</Text>
                          <Text style={styles.nutritionLabel}>Carbs</Text>
                        </View>
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionValue}>{message.recipeOption.fat}g</Text>
                          <Text style={styles.nutritionLabel}>Fat</Text>
                        </View>
                      </View>

                      {/* Footer */}
                      <View style={styles.recipeOptionFooter}>
                        <View style={styles.recipeTimeContainer}>
                          <Text style={styles.recipeTimeIcon}>⏱️</Text>
                          <Text style={styles.recipeTimeText}>{message.recipeOption.time} min</Text>
                        </View>
                        <Text style={styles.recipeKeyIngredients}>
                          {message.recipeOption.keyIngredients}
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>
                ) : message.text ? (
                  /* Regular Message Bubble */
                  <View
                    style={[
                      styles.messageBubble,
                      message.sender === 'user' ? styles.userBubble : styles.sageBubble
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      message.sender === 'user' ? styles.userText : styles.sageText
                    ]}>
                      {message.text}
                    </Text>
                  </View>
                ) : null}
                
                {/* Recipe Card - Compact */}
                {message.fullRecipe && message.fullRecipe.title && (
                  <Pressable 
                    style={styles.sageRecipeCard}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="Open recipe details"
                    onStartShouldSetResponder={() => true}
                    onPress={() => {
                      if (!message.fullRecipe) return
                      
                      // RECIPES TEMPORARILY DISABLED FOR LAUNCH
                      Alert.alert('Recipes Feature', 'Recipe functionality is temporarily disabled for launch.')
                      return
                      
                      // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      // if (message.fullRecipe.id) {
                      //   router.push(`/recipe-detail?id=${message.fullRecipe.id}`)
                      // } else {
                      //   // If no ID yet, navigate with recipe data in state or create a detail view
                      //   // For now, try to navigate - the detail screen should handle missing ID
                      //   router.push({
                      //     pathname: '/recipe-detail',
                      //     params: {
                      //       id: message.fullRecipe.id || 'new',
                      //       title: message.fullRecipe.title,
                      //       description: message.fullRecipe.description,
                      //       meal_type: message.fullRecipe.meal_type,
                      //       servings: message.fullRecipe.servings,
                      //       prep_time: message.fullRecipe.prep_time || 0,
                      //       cook_time: message.fullRecipe.cook_time || 0,
                      //       difficulty: message.fullRecipe.difficulty,
                      //       calories: message.fullRecipe.calories || 0,
                      //       protein: message.fullRecipe.protein || 0,
                      //       carbs: message.fullRecipe.carbs || 0,
                      //       fat: message.fullRecipe.fat || 0,
                      //       ingredients: JSON.stringify(message.fullRecipe.ingredients),
                      //       instructions: JSON.stringify(message.fullRecipe.instructions),
                      //       tags: JSON.stringify(message.fullRecipe.tags || [])
                      //     }
                      //   } as any)
                      // }
                    }}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.sageRecipeCardGradient}
                      pointerEvents="none"
                    >
                      <View style={styles.sageRecipeImageContainer}>
                        {/* RECIPES TEMPORARILY DISABLED FOR LAUNCH */}
                        {/* <SimpleRecipeImage
                          recipeTitle={message.fullRecipe.title}
                          recipeDescription={message.fullRecipe.description}
                          style={styles.sageRecipeImage}
                        /> */}
                        <View style={[styles.sageRecipeImage, { backgroundColor: '#E9F1EB', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 48 }}>👨‍🍳</Text>
                        </View>
                        <View style={styles.sageRecipeSavedBadge}>
                          <Ionicons name="checkmark-circle" size={24} color="#6A9571" />
                        </View>
                      </View>
                      <View style={styles.sageRecipeInfo}>
                        <Text style={styles.sageRecipeTitle} numberOfLines={2}>
                          {message.fullRecipe.title}
                        </Text>
                        {/* Description removed from card - only shown when pressed */}
                        <View style={styles.sageRecipeStats}>
                          <View style={styles.sageRecipeStat}>
                            <Ionicons name="time-outline" size={14} color="#6A9571" />
                            <Text style={styles.sageRecipeStatText}>
                              {(() => {
                                const prep = message.fullRecipe.prep_time || 0
                                const cook = message.fullRecipe.cook_time || 0
                                const total = prep + cook
                                return total > 0 ? `${total} min` : 'N/A min'
                              })()}
                            </Text>
                          </View>
                          <View style={styles.sageRecipeStat}>
                            <Ionicons name="restaurant-outline" size={14} color="#6A9571" />
                            <Text style={styles.sageRecipeStatText}>
                              {message.fullRecipe.servings || 1} {message.fullRecipe.servings === 1 ? 'serving' : 'servings'}
                            </Text>
                          </View>
                          <View style={styles.sageRecipeStat}>
                            <Ionicons name="flame-outline" size={14} color="#6A9571" />
                            <Text style={styles.sageRecipeStatText}>
                              {(() => {
                                const cal = message.fullRecipe.calories
                                return (cal && cal > 0) ? `${cal} cal` : 'N/A cal'
                              })()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                )}
                
                {/* Quick Options Buttons - Only show if not used */}
                {message.quickOptions && message.quickOptions.length > 0 && !message.quickOptionsUsed && (
                  <AnimatedQuickOptions
                    options={message.quickOptions}
                    onOptionPress={(option) => handleQuickOptionPress(option, message.id)}
                  />
                )}
              </View>
            ))}
            <View style={styles.messagesBottomSpacing} />
          </ScrollView>
          
          {/* Text Input Area */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Ask SAGE anything..."
                placeholderTextColor="#999999"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                onSubmitEditing={sendMessage}
                blurOnSubmit={false}
              />
              <Pressable
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim()}
              >
                <LinearGradient
                  colors={inputText.trim() 
                    ? ['#6A9571', '#8AB896']
                    : ['#E0E0E0', '#CCCCCC']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButtonGradient}
                >
                  <Text style={styles.sendButtonText}>Send</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
          
          {/* Pantry Selection Modal */}
          <Modal visible={showPantrySelector} animationType="slide" transparent onRequestClose={() => setShowPantrySelector(false)}>
            <View style={styles.pantryModalBackdrop}>
              <View style={styles.pantryModalCard}>
                <Text style={styles.pantryModalTitle}>Select pantry items to use</Text>
                <Text style={styles.pantryModalSubtitle}>Tap to select. Choose everything you want to include.</Text>
                <ScrollView style={styles.pantryList} contentContainerStyle={{ paddingBottom: 16 }}>
                  {pantryItems && pantryItems.length > 0 ? (
                    pantryItems.map((item: any, idx: number) => {
                      const name = item?.name || ''
                      const isSelected = selectedPantryNames.includes(name)
                      return (
                        <Pressable key={idx} style={[styles.pantryRow, isSelected && styles.pantryRowSelected]} onPress={() => {
                          setSelectedPantryNames(prev => {
                            const exists = prev.includes(name)
                            if (exists) return prev.filter(n => n !== name)
                            return [...prev, name]
                          })
                        }}>
                          <Text style={styles.pantryRowName}>{name}</Text>
                          <Text style={styles.pantryRowMeta}>{(item.quantity || '') + (item.unit ? ` ${item.unit}` : '')}</Text>
                        </Pressable>
                      )
                    })
                  ) : (
                    <Text style={styles.pantryEmpty}>Your pantry is empty.</Text>
                  )}
                </ScrollView>
                <View style={styles.pantryActions}>
                  <Pressable style={styles.pantryCancel} onPress={() => setShowPantrySelector(false)}>
                    <Text style={styles.pantryActionText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.pantryConfirm} onPress={() => {
                    setShowPantrySelector(false)
                    const picked = selectedPantryNames.join(', ')
                    const text = picked.length > 0
                      ? `I want to use these pantry items: ${picked}`
                      : 'I want to use items from my pantry.'
                    // Send as if user typed it
                    setInputText(text)
                    setTimeout(() => {
                      sendMessage()
                    }, 50)
                  }}>
                    <Text style={[styles.pantryActionText, { color: '#FFFFFF', fontWeight: '700' }]}>Done</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  // Floating SAGE Button - size from layout system
  sageButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  sageButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  glassBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  sageGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
  innerGlow: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sageIcon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  
  // Chat Container
  chatContainer: {
    flex: 1,
  },
  chatGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  chatHeader: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sageAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  sageAvatarGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sageAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  chatTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  chatSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  chatCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatCloseText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '600',
  },
  
  // Messages
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  messageBubble: {
    maxWidth: '85%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 22,
    marginBottom: 16,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#6A9571',
    borderBottomRightRadius: 6,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(106, 149, 113, 0.15)',
    borderBottomLeftRadius: 6,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.3)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.2,
  },
  userText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  sageText: {
    color: '#000000',
    fontWeight: '400',
  },
  messagesBottomSpacing: {
    height: 24,
  },
  
  // Voice Chat Button
  inputContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sendButton: {
    borderRadius: 22,
    overflow: 'hidden',
    minWidth: 80,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  
  // Quick Options
  quickOptionsContainer: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 12,
    marginLeft: 0,
    paddingRight: 20,
    alignItems: 'flex-start',
  },
  quickOptionButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickOptionGradient: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: '#6A9571',
    borderRadius: 20,
  },
  quickOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6A9571',
    letterSpacing: -0.2,
  },
  
  // Recipe Option Cards
  recipeOptionCard: {
    marginBottom: 16,
    marginLeft: 60,
    marginRight: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  recipeOptionGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    borderRadius: 20,
  },
  recipeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  recipeOptionNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6A9571',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeOptionNumberText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recipeOptionTitleSection: {
    flex: 1,
  },
  recipeOptionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  recipeOptionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.15)',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#6A9571',
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  nutritionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeOptionFooter: {
    gap: 10,
  },
  recipeTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeTimeIcon: {
    fontSize: 16,
  },
  recipeTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  recipeKeyIngredients: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666666',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  
  // Sage Recipe Card - Compact
  sageRecipeCard: {
    marginBottom: 16,
    marginLeft: 60,
    marginRight: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 1,
  },
  sageRecipeCardGradient: {
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
    borderRadius: 20,
  },
  sageRecipeImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  sageRecipeImage: {
    width: '100%',
    height: '100%',
  },
  sageRecipeSavedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sageRecipeInfo: {
    padding: 16,
  },
  sageRecipeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  sageRecipeDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    lineHeight: 20,
    letterSpacing: -0.1,
    marginBottom: 12,
  },
  sageRecipeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sageRecipeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sageRecipeStatText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6A9571',
    letterSpacing: -0.2,
  },
  // Pantry modal styles
  pantryModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pantryModalCard: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(106,149,113,0.2)'
  },
  pantryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  pantryModalSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
  },
  pantryList: {
    flexGrow: 0,
  },
  pantryRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
  },
  pantryRowSelected: {
    backgroundColor: 'rgba(106,149,113,0.12)',
    borderColor: 'rgba(106,149,113,0.45)'
  },
  pantryRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  pantryRowMeta: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  pantryEmpty: {
    fontSize: 14,
    color: '#666666',
    paddingVertical: 12,
  },
  pantryActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  pantryCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#EFEFEF',
  },
  pantryConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#6A9571',
  },
  pantryActionText: {
    fontSize: 15,
    color: '#1C1C1E'
  },
})

