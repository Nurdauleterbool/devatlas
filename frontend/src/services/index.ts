import type { DevAtlasService } from './DevAtlasService'
import { createMockService } from './mockService'
import { mockOptionsFromConfig } from './mockConfig'
import { createHttpService } from './httpService'

/** Live HTTP is the runtime default; isolated tests may opt in to mock. */
import { isLive } from './serviceMode'
export const service: DevAtlasService = isLive
  ? createHttpService()
  : createMockService({
      ...mockOptionsFromConfig(
        import.meta.env,
        typeof window === 'undefined' ? undefined : new URLSearchParams(window.location.search),
      ),
      initialSession: 'anonymous',
    })
