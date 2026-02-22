// Household Context - Active shared pantry household and members
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { householdService } from './HouseholdService'
import { userPreferencesService } from './UserPreferencesService'
import { supabase } from './supabase'
import { Household, HouseholdMember } from './supabase'
import { logger } from './Logger'

interface HouseholdContextType {
  currentHousehold: Household | null
  households: Household[]
  members: HouseholdMember[]
  loading: boolean
  membersLoading: boolean
  error: string | null
  createHousehold: (name?: string) => Promise<Household | null>
  joinByCode: (shareCode: string) => Promise<Household | null>
  setActiveHousehold: (householdId: string | null) => Promise<void>
  refreshHouseholds: () => Promise<void>
  getHouseholdMembers: (householdId: string) => Promise<HouseholdMember[]>
  inviteByEmail: (householdId: string, email: string, role?: 'editor' | 'viewer') => Promise<{ error: any }>
  leaveHousehold: (householdId: string) => Promise<{ error: any }>
  removeMember: (householdId: string, memberId: string) => Promise<{ error: any }>
  regenerateShareCode: (householdId: string) => Promise<string | null>
  updateHouseholdName: (householdId: string, name: string) => Promise<Household | null>
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [households, setHouseholds] = useState<Household[]>([])
  const [currentHousehold, setCurrentHouseholdState] = useState<Household | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHouseholds = useCallback(async () => {
    if (!user) {
      setHouseholds([])
      setCurrentHouseholdState(null)
      setMembers([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const { data, error: err } = await householdService.getMyHouseholds()
      if (err) throw err
      setHouseholds(data || [])
      const list = data || []
      const activeId = userPreferencesService.getActiveHouseholdId()
      if (activeId && list.some(h => h.id === activeId)) {
        const active = list.find(h => h.id === activeId) || null
        setCurrentHouseholdState(active)
      } else if (list.length > 0) {
        const first = list[0]
        setCurrentHouseholdState(first)
        await userPreferencesService.setActiveHouseholdId(user.id, first.id)
      } else {
        const created = await householdService.createHousehold('My Household')
        if (created) {
          setHouseholds(prev => [created, ...prev])
          setCurrentHouseholdState(created)
          await userPreferencesService.setActiveHouseholdId(user.id, created.id)
        } else {
          setCurrentHouseholdState(null)
        }
      }
    } catch (e) {
      logger.error('Failed to load households', { error: e })
      setError(e instanceof Error ? e.message : 'Failed to load households')
      setHouseholds([])
      setCurrentHouseholdState(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadHouseholds()
  }, [loadHouseholds])

  const loadMembers = useCallback(async (householdId: string) => {
    setMembersLoading(true)
    try {
      const { data, error: err } = await householdService.getHouseholdMembers(householdId)
      if (err) throw err
      setMembers(data || [])
    } catch (e) {
      logger.error('Failed to load household members', { error: e })
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentHousehold?.id) loadMembers(currentHousehold.id)
    else setMembers([])
  }, [currentHousehold?.id, loadMembers])

  const setActiveHousehold = useCallback(async (householdId: string | null) => {
    if (!user) return
    if (householdId === null) {
      setCurrentHouseholdState(null)
      await userPreferencesService.setActiveHouseholdId(user.id, null)
      setMembers([])
      return
    }
    const h = households.find(x => x.id === householdId)
    if (h) {
      setCurrentHouseholdState(h)
      await userPreferencesService.setActiveHouseholdId(user.id, h.id)
      await loadMembers(h.id)
    }
  }, [user, households, loadMembers])

  const createHousehold = useCallback(async (name?: string): Promise<Household | null> => {
    if (!user) return null
    try {
      setError(null)
      const { data, error: err } = await householdService.createHousehold(name)
      if (err) throw err
      if (data) {
        await loadHouseholds()
        setCurrentHouseholdState(data)
        await userPreferencesService.setActiveHouseholdId(user.id, data.id)
        return data
      }
      return null
    } catch (e) {
      logger.error('Failed to create household', { error: e })
      setError(e instanceof Error ? e.message : 'Failed to create household')
      return null
    }
  }, [user, loadHouseholds])

  const joinByCode = useCallback(async (shareCode: string): Promise<Household | null> => {
    if (!user) return null
    try {
      setError(null)
      const { data, error: err } = await householdService.joinByCode(shareCode)
      if (err) throw err
      if (data) {
        await loadHouseholds()
        setCurrentHouseholdState(data)
        await userPreferencesService.setActiveHouseholdId(user.id, data.id)
        return data
      }
      return null
    } catch (e) {
      logger.error('Failed to join household', { error: e })
      setError(e instanceof Error ? e.message : 'Failed to join household')
      return null
    }
  }, [user, loadHouseholds])

  const refreshHouseholds = useCallback(async () => {
    await loadHouseholds()
    if (currentHousehold?.id) await loadMembers(currentHousehold.id)
  }, [loadHouseholds, loadMembers, currentHousehold?.id])

  const getHouseholdMembers = useCallback(async (householdId: string): Promise<HouseholdMember[]> => {
    const { data } = await householdService.getHouseholdMembers(householdId)
    return data || []
  }, [])

  const inviteByEmail = useCallback(async (householdId: string, email: string, role: 'editor' | 'viewer' = 'editor') => {
    return householdService.inviteByEmail(householdId, email, role)
  }, [])

  const leaveHousehold = useCallback(async (householdId: string) => {
    const result = await householdService.leaveHousehold(householdId)
    if (!result.error && user) {
      // Clear stale active household so loadHouseholds picks the first remaining (or creates one)
      await userPreferencesService.setActiveHouseholdId(user.id, null)
      setCurrentHouseholdState(null)
      setMembers([])
      await loadHouseholds()
    }
    return result
  }, [loadHouseholds, user])

  const removeMember = useCallback(async (householdId: string, memberId: string) => {
    if (memberId.startsWith('owner-')) return { error: new Error('Cannot remove owner') }
    const { error } = await supabase
      .from('household_members')
      .delete()
      .eq('household_id', householdId)
      .eq('id', memberId)
    if (!error) await loadMembers(householdId)
    return { error }
  }, [loadMembers])

  const regenerateShareCode = useCallback(async (householdId: string): Promise<string | null> => {
    const { data, error: err } = await householdService.regenerateShareCode(householdId)
    if (err || !data) return null
    setHouseholds(prev => prev.map(h => h.id === householdId ? data : h))
    if (currentHousehold?.id === householdId) setCurrentHouseholdState(data)
    return data.share_code || null
  }, [currentHousehold?.id])

  const updateHouseholdName = useCallback(async (householdId: string, name: string): Promise<Household | null> => {
    const { data, error: err } = await householdService.updateHouseholdName(householdId, name)
    if (err || !data) return null
    setHouseholds(prev => prev.map(h => h.id === householdId ? data : h))
    if (currentHousehold?.id === householdId) setCurrentHouseholdState(data)
    return data
  }, [currentHousehold?.id])

  return (
    <HouseholdContext.Provider
      value={{
        currentHousehold,
        households,
        members,
        loading,
        membersLoading,
        error,
        createHousehold,
        joinByCode,
        setActiveHousehold,
        refreshHouseholds,
        getHouseholdMembers,
        inviteByEmail,
        leaveHousehold,
        removeMember,
        regenerateShareCode,
        updateHouseholdName,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (ctx === undefined) throw new Error('useHousehold must be used within a HouseholdProvider')
  return ctx
}
