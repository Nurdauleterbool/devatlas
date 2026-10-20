/** Keep mode detection independent from the mutable service object used by mock E2E tests. */
export const isLive = import.meta.env.VITE_SERVICE_MODE !== 'mock'
