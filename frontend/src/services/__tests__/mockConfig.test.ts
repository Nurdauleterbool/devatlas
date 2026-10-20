import { describe, expect, it } from 'vitest'
import { mockOptionsFromConfig } from '../mockConfig'

describe('mock UI scenario configuration', () => {
  it('defaults to successful asynchronous reads with zero added latency', () => {
    expect(mockOptionsFromConfig({})).toEqual({ scenario: 'success', latencyMs: 0 })
  })

  it('supports build-time environment settings and development-only query overrides', () => {
    const env = { DEV: true, VITE_MOCK_SCENARIO: 'error', VITE_MOCK_LATENCY_MS: '100' }
    expect(mockOptionsFromConfig(env)).toEqual({ scenario: 'error', latencyMs: 100 })
    expect(mockOptionsFromConfig(env, new URLSearchParams('mockScenario=empty&mockLatencyMs=1500')))
      .toEqual({ scenario: 'empty', latencyMs: 1500 })
  })

  it('ignores query overrides in production', () => {
    expect(mockOptionsFromConfig({ DEV: false }, new URLSearchParams('mockScenario=error&mockLatencyMs=invalid')))
      .toEqual({ scenario: 'success', latencyMs: 0 })
  })

  it.each(['invalid', 'loading', ''])('rejects unsupported scenario %j', (scenario) => {
    expect(() => mockOptionsFromConfig({ VITE_MOCK_SCENARIO: scenario })).toThrow('must be success, empty, or error')
  })

  it.each(['-1', 'NaN', 'Infinity', '', ' '])('rejects invalid latency %j', (latency) => {
    expect(() => mockOptionsFromConfig({ VITE_MOCK_LATENCY_MS: latency })).toThrow('finite nonnegative number')
  })
})
