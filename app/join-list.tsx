// SAVR Join List - Enter share code to join a collaborative list
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Haptics from 'expo-haptics'

// Try to use collaborative lists
function useListsContext() {
  try {
    const { useCollaborativeLists } = require('../lib/CollaborativeListsContext')
    return useCollaborativeLists()
  } catch {
    return null
  }
}

export default function JoinListScreen() {
  const router = useRouter()
  const lists = useListsContext()
  const [shareCode, setShareCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleJoinList = async () => {
    if (!shareCode.trim()) {
      Alert.alert('Error', 'Please enter a share code')
      return
    }

    if (!lists || !lists.joinListByCode) {
      Alert.alert('Error', 'You need to sign in to join collaborative lists')
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setLoading(true)

    try {
      const result = await lists.joinListByCode(shareCode.trim().toUpperCase())

      if (result.success) {
        Alert.alert(
          'Success!',
          'You\'ve joined the list! Check your Lists tab.',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        )
      } else {
        Alert.alert('Error', result.error || 'Failed to join list')
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
          >
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Join List</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View style={styles.formContainer}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔗</Text>
          </View>

          <Text style={styles.title}>Enter Share Code</Text>
          <Text style={styles.subtitle}>
            Enter the code shared with you to join a collaborative list
          </Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Share Code</Text>
            <TextInput
              style={styles.input}
              placeholder="SAVR-ABC123"
              placeholderTextColor="#8E8E93"
              value={shareCode}
              onChangeText={(text) => setShareCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={11}
              editable={!loading}
            />
            <Text style={styles.inputHint}>
              Format: SAVR-XXXXXX (e.g., SAVR-ABC123)
            </Text>
          </View>

          <Pressable
            style={[styles.joinButton, loading && styles.joinButtonDisabled]}
            onPress={handleJoinList}
            disabled={loading}
          >
            <LinearGradient
              colors={['#6A9571', '#8AB896']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.joinButtonGradient}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.joinButtonText}>Join List</Text>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>How it works:</Text>
            <Text style={styles.infoText}>
              1. Get a share code from someone{'\n'}
              2. Enter it above{'\n'}
              3. The list will appear in your Lists tab{'\n'}
              4. Start collaborating in real-time!
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  header: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#000000',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  inputCard: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputHint: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  joinButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 22,
  },
})


