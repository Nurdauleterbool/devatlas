import type { UpdateProgressInput, UserSkillProgress } from '../types/domain'
import type { DevAtlasService } from './DevAtlasService'
import { ServiceError } from './DevAtlasService'

export interface ProgressWriter {
  (input: UpdateProgressInput): Promise<UserSkillProgress>
  cancelPending(): void
}

/** Share across skill views so delayed older saves cannot overwrite a newer intent. */
export function createProgressWriter(service: Pick<DevAtlasService, 'updateProgress'>): ProgressWriter {
  let generation = 0
  let tail = Promise.resolve()

  async function write(input: UpdateProgressInput): Promise<UserSkillProgress> {
    const current = generation
    let snapshot: UpdateProgressInput
    try {
      snapshot = structuredClone(input)
    } catch {
      throw new ServiceError('VALIDATION', 'Progress update must contain cloneable data.')
    }
    const pending = tail.then(() => {
      if (current !== generation) {
        throw new ServiceError('SESSION_CHANGED', 'Session changed before the progress update started.')
      }
      // In-flight requests retain the adapter's own session/ownership checks.
      return service.updateProgress(snapshot)
    })
    tail = pending.then(() => undefined, () => undefined)
    return pending
  }

  return Object.assign(write, { cancelPending: () => { generation++ } })
}
