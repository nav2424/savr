/**
 * HouseholdService tests - collaborative pantry create, join, members
 */
import { householdService } from '../HouseholdService'

const mockUser = { id: 'user-owner-1', email: 'owner@test.com' }
const mockHousehold = {
  id: 'household-1',
  name: 'My Household',
  owner_id: mockUser.id,
  share_code: 'SAVR-H-ABC123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const mockFrom = jest.fn()
const mockGetUser = jest.fn()
const mockRpc = jest.fn()

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
    rpc: (fnName: string, args: Record<string, unknown>) => mockRpc(fnName, args),
  },
}))

jest.mock('../Logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}))

describe('HouseholdService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  })

  describe('createHousehold', () => {
    it('inserts household then adds owner to household_members', async () => {
      const membersInsertChain = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      }
      // Household chain must support both insert().select().single() and select().eq().maybeSingle() (generateShareCode)
      const householdChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockHousehold, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }
      mockFrom.mockImplementation((table: string) => {
        if (table === 'households') return householdChain
        if (table === 'household_members') return membersInsertChain
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) }
      })

      const { data, error } = await householdService.createHousehold('My Household')

      expect(error).toBeNull()
      expect(data).toEqual(mockHousehold)
      expect(mockFrom).toHaveBeenCalledWith('households')
      expect(householdChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Household',
          owner_id: mockUser.id,
          share_code: expect.stringMatching(/^SAVR-H-/),
        })
      )
      expect(mockFrom).toHaveBeenCalledWith('household_members')
      expect(membersInsertChain.insert).toHaveBeenCalledWith({
        household_id: mockHousehold.id,
        user_id: mockUser.id,
        role: 'owner',
        added_by: mockUser.id,
        accepted: true,
      })
    })

    it('returns null when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Not authenticated') })
      const { data, error } = await householdService.createHousehold('Test')
      expect(data).toBeNull()
      expect(error).toBeDefined()
      expect(mockFrom).not.toHaveBeenCalledWith('households')
    })
  })

  describe('getMyHouseholds', () => {
    it('returns owned households when user has no member rows', async () => {
      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [mockHousehold], error: null }),
      }
      const memberSelectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
      mockFrom.mockImplementation((table: string) => {
        if (table === 'households') return selectChain
        if (table === 'household_members') return memberSelectChain
        return {}
      })

      const { data, error } = await householdService.getMyHouseholds()

      expect(error).toBeNull()
      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(mockHousehold.id)
      expect(selectChain.eq).toHaveBeenCalledWith('owner_id', mockUser.id)
    })

    it('returns null data when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
      const { data, error } = await householdService.getMyHouseholds()
      expect(data).toBeNull()
      expect(error).toBeDefined()
    })
  })

  describe('joinByCode', () => {
    it('normalizes share code and joins household via RPC', async () => {
      mockRpc.mockResolvedValue({ data: [mockHousehold], error: null })

      const { data, error } = await householdService.joinByCode('abc123')

      expect(error).toBeNull()
      expect(data).toEqual(mockHousehold)
      expect(mockRpc).toHaveBeenCalledWith('join_household_by_code', { p_share_code: 'SAVR-H-ABC123' })
    })
  })
})
