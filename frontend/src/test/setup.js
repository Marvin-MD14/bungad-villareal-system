import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom implements neither of these, and App.jsx / recharts call both during
// layout. Without them every chart test dies on an unrelated TypeError.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!global.SVGElement.prototype.getBBox) {
  global.SVGElement.prototype.getBBox = () => ({
    x: 0, y: 0, width: 0, height: 0,
  })
}
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// The app shows a SweetAlert on every write; silence it so tests assert on the
// API call / DOM, not on a third-party popup.
vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn(), mixin: vi.fn(() => ({ fire: vi.fn() })) },
  __esModule: true,
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})
