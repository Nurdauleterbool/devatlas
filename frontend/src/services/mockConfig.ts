import { ServiceError } from './DevAtlasService'
import type { MockServiceOptions, MockScenario } from './mockService'

interface MockEnvironment {
  DEV?: boolean
  VITE_MOCK_SCENARIO?: string
  VITE_MOCK_LATENCY_MS?: string
}

/** Query overrides are development-only; production builds use explicit build-time settings. */
export function mockOptionsFromConfig(env: MockEnvironment, query = new URLSearchParams()): MockServiceOptions {
  const scenario = (env.DEV ? query.get('mockScenario') : null) ?? env.VITE_MOCK_SCENARIO ?? 'success'
  const latency = (env.DEV ? query.get('mockLatencyMs') : null) ?? env.VITE_MOCK_LATENCY_MS ?? '0'
  if (!['success', 'empty', 'error'].includes(scenario)) {
    throw new ServiceError('VALIDATION', 'VITE_MOCK_SCENARIO/mockScenario must be success, empty, or error.')
  }
  const latencyMs = Number(latency)
  if (!latency.trim() || !Number.isFinite(latencyMs) || latencyMs < 0) {
    throw new ServiceError('VALIDATION', 'VITE_MOCK_LATENCY_MS/mockLatencyMs must be a finite nonnegative number.')
  }
  return { scenario: scenario as MockScenario, latencyMs }
}
