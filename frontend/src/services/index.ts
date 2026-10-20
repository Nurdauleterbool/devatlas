import type { DevAtlasService } from './DevAtlasService'
import { createMockService } from './mockService'
import { mockOptionsFromConfig } from './mockConfig'

// The sole composition root. A future HTTP adapter implements DevAtlasService and replaces this binding.
export const service: DevAtlasService = createMockService(mockOptionsFromConfig(
  import.meta.env,
  typeof window === 'undefined' ? undefined : new URLSearchParams(window.location.search),
))
