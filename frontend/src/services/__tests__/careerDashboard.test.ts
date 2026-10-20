import { describe, expect, it, vi } from 'vitest'
import { createMockService } from '../mockService'
import { createCareerSelectionWriter, getCareerDashboard } from '../careerDashboard'
import { seedFixtures } from '../fixtures'

const clock = () => new Date('2026-10-20T12:00:00.000Z')

describe('career dashboard service composition', () => {
  it('does not request private data for anonymous visitors or invent selected paths', async () => {
    const service = createMockService({ initialSession: 'anonymous' })
    const privateRead = vi.spyOn(service, 'getSelectedCareers')
    const analytics = vi.spyOn(service, 'getAnalytics')
    const dashboard = await getCareerDashboard(service, false)
    expect(dashboard.careers).toHaveLength(3)
    expect(dashboard.selected).toEqual([])
    expect(dashboard.completionPercent).toBe(0)
    expect(privateRead).not.toHaveBeenCalled()
    expect(analytics).not.toHaveBeenCalled()
  })
  it('uses saved selection, keeps completion separate from verification and uses adapter reasons', async () => {
    const service = createMockService()
    await service.setSelectedCareers(['frontend'])
    const dashboard = await getCareerDashboard(service, true)
    expect(dashboard.selectedIds).toEqual(['frontend'])
    expect(dashboard.completed.map((skill) => skill.name)).toEqual(['HTML'])
    expect(dashboard.verified).toEqual([])
    expect(dashboard.gaps.map((skill) => skill.name)).toEqual(['CSS', 'JavaScript', 'React'])
    expect(dashboard.completionPercent).toBe(25)
    expect(dashboard.recommendations.map((item) => item.skill.id)).toEqual(['css', 'javascript'])
    expect(dashboard.recommendations[0].paths[0].reason).toContain('prerequisites completed or verified: HTML')
    expect(dashboard.analytics?.careers.find((career) => career.careerId === 'frontend')?.completionPercent).toBe(25)
  })
  it.each(['frontend', 'backend', 'analyst'])('switches to %s and retains service selection across view reads', async (id) => {
    const service = createMockService()
    await service.setSelectedCareers([id])
    expect((await getCareerDashboard(service, true)).selectedIds).toEqual([id])
    expect((await getCareerDashboard(service, true)).selected[0].id).toBe(id)
    expect((await service.getSelectedCareers()).map((item) => item.careerId)).toEqual([id])
  })
  it('deduplicates shared skills and recommendations while retaining per-path reasons and analytics', async () => {
    const service = createMockService()
    await service.setSelectedCareers(['backend', 'analyst'])
    await service.updateProgress({ skillId: 'sql', status: 'completed' })
    const dashboard = await getCareerDashboard(service, true)
    expect(dashboard.skills).toHaveLength(6)
    expect(dashboard.completed).toHaveLength(1)
    expect(dashboard.gaps).toHaveLength(5)
    expect(dashboard.completionPercent).toBe(17)
    expect(dashboard.recommendations.filter((item) => item.skill.id === 'python')).toHaveLength(1)
    expect(dashboard.recommendations.find((item) => item.skill.id === 'python')?.paths.map((path) => path.name)).toEqual(['Backend Developer', 'Data Analyst'])
    expect(dashboard.analytics?.careers.filter((career) => ['backend','analyst'].includes(career.careerId)).every((career) => career.completedSkills === 1)).toBe(true)
  })
  it('counts quiz verification independently, including an unfinished verified skill', async () => {
    const service = createMockService()
    await service.setSelectedCareers(['backend'])
    const quiz = (await service.getQuizForSkill('sql'))!
    await service.submitQuizAttempt({ quizId: quiz.id, responses: quiz.questions.map((question) => ({ questionId: question.id, optionId: seedFixtures.answerKeys[question.id].correctOptionId })) })
    const dashboard = await getCareerDashboard(service, true)
    expect(dashboard.completed).toHaveLength(0)
    expect(dashboard.verified.map((skill) => skill.id)).toEqual(['sql'])
    expect(dashboard.gaps.map((skill) => skill.id)).toContain('sql')
    expect(dashboard.recommendations.map((item) => item.skill.id)).not.toContain('sql')
  })
  it('handles no selection and a coherent empty catalogue with zero scoped totals', async () => {
    const service = createMockService()
    await service.setSelectedCareers([])
    for (const mock of [service, createMockService({ scenario: 'empty' })]) {
      const dashboard = await getCareerDashboard(mock, true)
      expect(dashboard.selected).toEqual([])
      expect(dashboard.skills).toEqual([])
      expect(dashboard.completionPercent).toBe(0)
      expect(dashboard.recommendations).toEqual([])
    }
  })
  it('handles completed paths without fabricating next recommendations', async () => {
    const service = createMockService()
    await service.setSelectedCareers(['frontend'])
    for (const skillId of ['html','css','javascript','react']) await service.updateProgress({skillId,status:'completed'})
    const dashboard = await getCareerDashboard(service, true)
    expect(dashboard.completionPercent).toBe(100)
    expect(dashboard.gaps).toEqual([])
    expect(dashboard.recommendations).toEqual([])
  })
  it('isolates accounts and restores each user selection after login', async () => {
    const service = createMockService({ initialSession:'anonymous',now:clock })
    const password = 'UnitTestOnly123!'
    await service.signUp({ displayName:'Alice',email:'alice@example.test',password })
    expect((await getCareerDashboard(service,true)).selected).toEqual([])
    await service.setSelectedCareers(['analyst'])
    await service.logOut()
    await service.signUp({ displayName:'Bob',email:'bob@example.test',password })
    expect((await getCareerDashboard(service,true)).selected).toEqual([])
    await service.setSelectedCareers(['backend'])
    await service.logOut()
    await service.logIn({email:'alice@example.test',password})
    expect((await getCareerDashboard(service,true)).selectedIds).toEqual(['analyst'])
  })
  it.each(['getSelectedCareers','getAnalytics','getRecommendations'] as const)('forwards %s failures rather than displaying false zero metrics', async (method) => {
    const service = createMockService({failMethods:[method]})
    await expect(getCareerDashboard(service,true)).rejects.toMatchObject({code:'UNAVAILABLE'})
  })
  it('rejects inconsistent selections, analytics and recommendations from an adapter', async () => {
    const service=createMockService()
    vi.spyOn(service,'getSelectedCareers').mockResolvedValue([{userId:'demo-student',careerId:'missing',selectedAt:clock().toISOString()}])
    await expect(getCareerDashboard(service,true)).rejects.toThrow('Selected career is unavailable')
    const metrics=createMockService()
    vi.spyOn(metrics,'getAnalytics').mockResolvedValue({...await metrics.getAnalytics(),careers:[]})
    await expect(getCareerDashboard(metrics,true)).rejects.toThrow('analytics are unavailable')
    const recommendations=createMockService()
    vi.spyOn(recommendations,'getRecommendations').mockResolvedValue([{careerId:'frontend',skillId:'missing',rank:1,priority:'start_next',prerequisiteIds:[],reason:'adapter reason'}])
    await expect(getCareerDashboard(recommendations,true)).rejects.toThrow('Recommended skill is unavailable')
  })
})

describe('serialized career selection writes', () => {
  it('copies caller input and skips queued superseded intents', async () => {
    const service=createMockService()
    const setter=vi.spyOn(service,'setSelectedCareers')
    const write=createCareerSelectionWriter(service)
    const first=write(['frontend'])
    const middle=write(['backend'])
    const ids=['analyst']
    const last=write(ids)
    ids[0]='frontend'
    expect(await Promise.all([first,middle,last])).toEqual([false,false,true])
    expect(setter).toHaveBeenCalledTimes(1)
    expect((await service.getSelectedCareers()).map((item) => item.careerId)).toEqual(['analyst'])
  })
  it('serializes writes already in flight so an older slow write cannot win', async () => {
    let release: (()=>void) | undefined
    const stored: string[][]=[]
    const setter=vi.fn(async (ids:string[]) => {
      if(ids[0]==='frontend') await new Promise<void>((resolve)=>{release=resolve})
      stored.push(ids)
      return []
    })
    const write=createCareerSelectionWriter({setSelectedCareers:setter})
    const first=write(['frontend'])
    await Promise.resolve()
    const second=write(['backend'])
    expect(setter).toHaveBeenCalledTimes(1)
    release!()
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(stored).toEqual([['frontend'],['backend']])
  })
  it('cancels queued intents when their workspace unmounts without invoking the service', async () => {
    const service=createMockService()
    const setter=vi.spyOn(service,'setSelectedCareers')
    const write=createCareerSelectionWriter(service)
    const pending=write(['backend'])
    write.cancelPending()
    expect(await pending).toBe(false)
    expect(setter).not.toHaveBeenCalled()
    // StrictMode can mount the same effect again; a fresh intent remains usable.
    expect(await write(['analyst'])).toBe(true)
  })
  it('preserves the last saved selection on failure and allows retry', async () => {
    const service=createMockService()
    const before=await service.getSelectedCareers()
    const setter=vi.spyOn(service,'setSelectedCareers').mockRejectedValueOnce(new Error('Unavailable'))
    const write=createCareerSelectionWriter(service)
    await expect(write(['backend'])).rejects.toThrow('Unavailable')
    expect(await service.getSelectedCareers()).toEqual(before)
    expect(await write(['backend'])).toBe(true)
    expect(setter).toHaveBeenCalledTimes(2)
  })
})
