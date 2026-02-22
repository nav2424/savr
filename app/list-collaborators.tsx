// SAVR List Collaborators - Manage list collaborators
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  Dimensions
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useCollaborativeLists } from '../lib/CollaborativeListsContext'
import * as Haptics from 'expo-haptics'
import { useToast } from '../lib/ToastContext'
import { logger } from '../lib/Logger'

const { width } = Dimensions.get('window')

interface Collaborator {
  id: string
  name: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  status: 'active' | 'pending' | 'inactive'
  addedDate: string
}

export default function ListCollaboratorsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams()
  const { getListCollaborators, removeCollaborator } = useCollaborativeLists()
  const { showToast } = useToast()
  
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)

  useEffect(() => {
    if (id) {
      loadCollaborators()
    }
  }, [id])

  const loadCollaborators = async () => {
    if (!id) return
    
    setLoading(true)
    try {
      const collaboratorsData = await getListCollaborators(id as string)
      // Map collaborators to the expected format
      const mappedCollaborators = collaboratorsData.map((collab: any) => ({
        id: collab.id || collab.user_id || (collab.role === 'owner' ? `owner-${collab.user_id}` : collab.user_id),
        name: collab.user?.name || collab.name || 'Unknown',
        avatar: (collab.user?.name || collab.name || 'U').charAt(0).toUpperCase(),
        role: collab.role || 'editor',
        status: collab.accepted ? 'active' : 'pending',
        addedDate: collab.added_at || new Date().toISOString()
      }))
      setCollaborators(mappedCollaborators)
    } catch (error) {
      logger.error('Error loading collaborators', { error })
      showToast('Failed to load collaborators.', { kind: 'error', durationMs: 3500 })
    } finally {
      setLoading(false)
    }
  }

  const handleCollaboratorPress = (collaborator: Collaborator) => {
    if (collaborator.role === 'owner') {
      showToast('This person owns the list and cannot be removed.', { kind: 'info', durationMs: 3000 })
      return
    }

    setSelectedCollaborator(collaborator)
    setShowActionModal(true)
  }

  const handleRemoveCollaborator = async () => {
    if (!selectedCollaborator) return

    // Prevent removing owner
    if (selectedCollaborator.role === 'owner' || selectedCollaborator.id.startsWith('owner-')) {
      showToast('The list owner cannot be removed.', { kind: 'warning', durationMs: 3000 })
      return
    }

    Alert.alert(
      'Remove Collaborator',
      `Are you sure you want to remove ${selectedCollaborator.name} from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await removeCollaborator(selectedCollaborator.id)
              if (result && result.error) {
                showToast(result.error.message || 'Failed to remove collaborator.', { kind: 'error', durationMs: 3500 })
                return
              }
              setCollaborators(prev => prev.filter(c => c.id !== selectedCollaborator.id))
              setShowActionModal(false)
              setSelectedCollaborator(null)
              showToast('Collaborator removed.', { kind: 'success' })
            } catch (error: any) {
              logger.error('Error removing collaborator', { error })
              showToast(error?.message || 'Failed to remove collaborator.', { kind: 'error', durationMs: 3500 })
            }
          }
        }
      ]
    )
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return '#6A9571'
      case 'editor': return '#8B5CF6'
      case 'viewer': return '#8E8E93'
      default: return '#8E8E93'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#6BCF7F'
      case 'pending': return '#FFB800'
      case 'inactive': return '#FF6B6B'
      default: return '#8E8E93'
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="dark" />
        <LinearGradient
          colors={['#FEFCF6', '#E9F1EB']}
          style={styles.gradientBackground}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading collaborators...</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      <LinearGradient
        colors={['#FEFCF6', '#E9F1EB']}
        style={styles.gradientBackground}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Collaborators</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Collaborators List */}
        <View style={styles.collaboratorsSection}>
          <Text style={styles.sectionTitle}>
            {collaborators.length} {collaborators.length === 1 ? 'Collaborator' : 'Collaborators'}
          </Text>
          
          {collaborators.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Collaborators</Text>
              <Text style={styles.emptySubtitle}>
                Invite people to collaborate on this list
              </Text>
            </View>
          ) : (
            <View style={styles.collaboratorsList}>
              {collaborators.map((collaborator) => (
                <Pressable
                  key={collaborator.id}
                  style={styles.collaboratorCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    handleCollaboratorPress(collaborator)
                  }}
                >
                  <View style={styles.collaboratorInfo}>
                    <View style={styles.collaboratorMain}>
                      <Text style={styles.collaboratorName}>{collaborator.name}</Text>
                      <Text style={styles.collaboratorEmail}>{collaborator.email}</Text>
                    </View>
                    <View style={styles.collaboratorMeta}>
                      <View style={[
                        styles.roleBadge,
                        { backgroundColor: getRoleColor(collaborator.role) }
                      ]}>
                        <Text style={styles.roleText}>{collaborator.role}</Text>
                      </View>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(collaborator.status) }
                      ]}>
                        <Text style={styles.statusText}>{collaborator.status}</Text>
                      </View>
                    </View>
                  </View>
                  {collaborator.role !== 'owner' && (
                    <View style={styles.actionIndicator}>
                      <Text style={styles.actionIndicatorText}>⋯</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Collaborator</Text>
            <Text style={styles.modalSubtitle}>
              {selectedCollaborator?.name} ({selectedCollaborator?.email})
            </Text>
            
            <View style={styles.modalActions}>
              <Pressable
                style={styles.removeButton}
                onPress={handleRemoveCollaborator}
              >
                <LinearGradient
                  colors={['#FF6B6B', '#FF5252']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.removeButtonGradient}
                >
                  <Text style={styles.removeButtonText}>Remove from List</Text>
                </LinearGradient>
              </Pressable>
              
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowActionModal(false)
                  setSelectedCollaborator(null)
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6A9571',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
    marginLeft: -40,
  },
  headerSpacer: {
    width: 40,
  },
  collaboratorsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  collaboratorsList: {
    gap: 12,
  },
  collaboratorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(106, 149, 113, 0.2)',
  },
  collaboratorInfo: {
    flex: 1,
  },
  collaboratorMain: {
    marginBottom: 8,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  collaboratorEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  collaboratorMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  actionIndicator: {
    padding: 8,
  },
  actionIndicatorText: {
    fontSize: 18,
    color: '#8E8E93',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 24,
  },
  modalActions: {
    gap: 12,
  },
  removeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  removeButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  bottomSpacing: {
    height: 100,
  },
})