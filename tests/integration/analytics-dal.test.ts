import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser, makeClient, makeTeamMember } from '../lib/db'
import { signInAs, signOut } from '../lib/mock-headers'
import {
  getDashboardStats,
  getSubmissionTrend,
  getRecentActivity,
} from '@/lib/dal/analytics'

describe('analytics DAL (SUPER_ADMIN scoped)', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  it('returns zero stats for empty database', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const stats = await getDashboardStats()
    expect(stats.totalClients).toBe(0)
    expect(stats.totalSubmissions).toBe(0)
    expect(stats.totalComments).toBe(0)
    expect(stats.totalFiles).toBe(0)
    expect(stats.pendingReview).toBe(0)
    expect(stats.openInvites).toBe(0)
    expect(stats.clientsThisMonth).toBe(0)
  })

  it('returns empty trend for empty database', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const trend = await getSubmissionTrend(7)
    expect(Array.isArray(trend)).toBe(true)
    for (const day of trend) {
      expect(day.count).toBe(0)
    }
  })

  it('returns empty activity for empty database', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const activity = await getRecentActivity(5)
    expect(activity).toHaveLength(0)
  })

  it('blocks non-SUPER_ADMIN roles', async () => {
    const c = await makeUser({ role: 'CLIENT' })
    await signInAs(c)

    await expect(getDashboardStats()).rejects.toThrow()
    await expect(getSubmissionTrend(7)).rejects.toThrow()
  })
})
