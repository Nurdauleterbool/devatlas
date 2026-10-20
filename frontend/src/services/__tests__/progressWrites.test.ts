import { describe, expect, it, vi } from 'vitest'
import type { UpdateProgressInput, UserSkillProgress } from '../../types/domain'
import { createProgressWriter } from '../progressWrites'

function record(input: UpdateProgressInput): UserSkillProgress {
  return {
    userId: 'student', ...input, verified: false, bestQuizScore: null,
    updatedAt: '2026-10-20T00:00:00.000Z',
  }
}
function gate() {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  return { pending, release }
}

describe('shared progress write ordering', () => {
  it('serializes an older delayed save before the newer same-skill intent', async () => {
    const old = gate()
    const saved: UpdateProgressInput[] = []
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => {
      if (input.status === 'completed') await old.pending
      saved.push(input)
      return record(input)
    })
    const write = createProgressWriter({ updateProgress })
    const first = write({ skillId: 'css', status: 'completed' })
    await Promise.resolve()
    const latest = write({ skillId: 'css', status: 'not_started' })
    expect(updateProgress).toHaveBeenCalledTimes(1)
    expect(saved).toEqual([])
    old.release()
    expect((await first).status).toBe('completed')
    expect((await latest).status).toBe('not_started')
    expect(saved).toEqual([
      { skillId: 'css', status: 'completed' },
      { skillId: 'css', status: 'not_started' },
    ])
  })

  it('serializes different skills through the same writer and retains every update', async () => {
    const firstGate = gate()
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => {
      if (input.skillId === 'html') await firstGate.pending
      return record(input)
    })
    const write = createProgressWriter({ updateProgress })
    const first = write({ skillId: 'html', status: 'completed' })
    await Promise.resolve()
    const second = write({ skillId: 'css', status: 'learning' })
    expect(updateProgress).toHaveBeenCalledTimes(1)
    firstGate.release()
    expect((await Promise.all([first, second])).map((item) => item.skillId)).toEqual(['html', 'css'])
    expect(updateProgress.mock.calls.map(([input]) => input.skillId)).toEqual(['html', 'css'])
  })

  it('snapshots the caller payload before the queued write starts', async () => {
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => record(input))
    const write = createProgressWriter({ updateProgress })
    const input: UpdateProgressInput = { skillId: 'css', status: 'completed' }
    const pending = write(input)
    input.skillId = 'html'
    input.status = 'not_started'
    expect(await pending).toMatchObject({ skillId: 'css', status: 'completed' })
    expect(updateProgress).toHaveBeenCalledWith({ skillId: 'css', status: 'completed' })
  })

  it('cancels queued calls before invoking the adapter', async () => {
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => record(input))
    const write = createProgressWriter({ updateProgress })
    const pending = write({ skillId: 'css', status: 'completed' })
    write.cancelPending()
    await expect(pending).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    expect(updateProgress).not.toHaveBeenCalled()
  })

  it('lets an in-flight request finish while rejecting later queued calls on cancellation', async () => {
    const current = gate()
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => {
      await current.pending
      return record(input)
    })
    const write = createProgressWriter({ updateProgress })
    const started = write({ skillId: 'html', status: 'completed' })
    await Promise.resolve()
    const queued = write({ skillId: 'css', status: 'learning' })
    const canceled = expect(queued).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    write.cancelPending()
    current.release()
    expect(await started).toMatchObject({ skillId: 'html', status: 'completed' })
    await canceled
    expect(updateProgress).toHaveBeenCalledTimes(1)
  })

  it('allows fresh writes after cancellation, including StrictMode effect replay', async () => {
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => record(input))
    const write = createProgressWriter({ updateProgress })
    const stale = write({ skillId: 'html', status: 'completed' })
    const canceled = expect(stale).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
    write.cancelPending()
    const fresh = write({ skillId: 'css', status: 'learning' })
    await canceled
    expect(await fresh).toMatchObject({ skillId: 'css', status: 'learning' })
    expect(updateProgress).toHaveBeenCalledTimes(1)
    expect(updateProgress).toHaveBeenCalledWith({ skillId: 'css', status: 'learning' })
  })

  it('does not poison the queue when the adapter fails and preserves its error', async () => {
    const failure = new Error('Unavailable')
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => record(input))
      .mockRejectedValueOnce(failure)
    const write = createProgressWriter({ updateProgress })
    const first = write({ skillId: 'css', status: 'completed' })
    const retry = write({ skillId: 'css', status: 'completed' })
    await expect(first).rejects.toBe(failure)
    expect(await retry).toMatchObject({ skillId: 'css', status: 'completed' })
    expect(updateProgress).toHaveBeenCalledTimes(2)
  })

  it('rejects uncloneable input without breaking later valid updates', async () => {
    const updateProgress = vi.fn(async (input: UpdateProgressInput) => record(input))
    const write = createProgressWriter({ updateProgress })
    const input = { skillId: 'css', status: 'completed', unsupported: () => undefined }
    await expect(write(input as UpdateProgressInput)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(updateProgress).not.toHaveBeenCalled()
    expect(await write({ skillId: 'css', status: 'learning' })).toMatchObject({ status: 'learning' })
  })
})
