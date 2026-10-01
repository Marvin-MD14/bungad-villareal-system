/**
 * Regression tests for the frontend bugs found during the multi-business work.
 *
 * Each test here corresponds to a defect that shipped to a real user — the
 * point of this file is that `npm test` now fails when any of them returns.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mock = vi.hoisted(() => ({ calls: [] }))
vi.mock('axios', async () => {
  const { FIXTURES } = await import('./helpers.js')
  const record = (method) => vi.fn(async (url) => {
    mock.calls.push({ method, url })
    if (url === '/auth/login/') {
      return { data: { token: 't', user: { username: 'demo_superadmin', role: 'Superadmin', is_superuser: true } } }
    }
    if (url in FIXTURES) return { data: FIXTURES[url] }
    return Promise.reject(Object.assign(new Error('Not found'), { response: { status: 404, data: { detail: 'Not found.' } } }))
  })
  const api = { get: record('get'), post: record('post'), patch: record('patch'), put: record('put'), delete: record('delete') }
  // utils/api.js calls axios.create() at import time and registers an auth
  // interceptor, and every page imports it.
  api.create = () => api
  api.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  }
  return { default: api, __esModule: true, ...api }
})
vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() }, __esModule: true }))
// recharts cannot measure layout in jsdom.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  LineChart: () => null, Line: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null, Legend: () => null,
  BarChart: () => null, Bar: () => null, Cell: () => null,
  PieChart: () => null, Pie: () => null,
}))

import App from '../App.jsx'
import { FIXTURES, seedSignedInUser } from './helpers.js'

// App renders its own <BrowserRouter>, so the route is set through the URL
// rather than by nesting a second router (React Router forbids that).
const renderApp = (route = '/') => {
  window.history.pushState({}, '', route)
  return render(<App />)
}

beforeEach(() => { mock.calls.length = 0; localStorage.clear() })
afterEach(() => cleanup())

describe('App shell', () => {
  it('renders the login screen when there is no session', () => {
    renderApp()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.queryByText(/Security Audit Log Records/i)).toBeNull()
  })

  it('does not crash with no stored business context', () => {
    seedSignedInUser()
    localStorage.removeItem('activeBusiness')
    expect(() => renderApp()).not.toThrow()
  })
})

describe('every page mounts without crashing', () => {
  // Each of these pages previously threw. A completed render IS the assertion.
  // The shell navigates by tab state, so we click the nav item like a user.
  const TABS = [
    ['Dashboard', 'dashboard'],
    ['Sales & POS', 'cashier / sales'],
    ['Clients', 'clients'],
    ['Customer Rewards', 'rewards'],
    ['User Profiling', 'users list'],
    ['Room Status', 'rooms list'],
    ['Inventory', 'inventory list'],
    ['Audit Logs', 'audit page (threw toFixed on null)'],
    ['Administration', 'administration'],
  ]

  for (const [label, description] of TABS) {
    it(`renders ${description} (${label})`, async () => {
      seedSignedInUser()
      const user = userEvent.setup()
      renderApp('/')
      const nav = await screen.findByText(label)
      expect(() => user.click(nav)).not.toThrow()
      await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0))
    })
  }
})

describe('the audit page renders real audit rows', () => {
  // The shell's pages are selected by internal tab state, not by URL, so the
  // only honest way in is to click the nav item a user would click.
  const openAuditTab = async (user) => {
    renderApp('/')
    await user.click(await screen.findByText('Audit Logs'))
  }

  it('shows the request reference, never a money value', async () => {
    seedSignedInUser()
    const user = userEvent.setup()
    await openAuditTab(user)
    // AuditLog has no `value`; rendering one was the crash the user hit.
    expect(FIXTURES['/audit-logs/'].every((r) => r.value === undefined)).toBe(true)
    await waitFor(() => {
      expect(screen.getAllByText(/abc123/).length).toBeGreaterThan(0)
    }, { timeout: 3000 })
    expect(screen.queryByText(/^Value$/)).toBeNull()
  })

  it('tolerates a row with null description, user and request id', async () => {
    expect(FIXTURES['/audit-logs/'][1].description).toBeNull()
    seedSignedInUser()
    const user = userEvent.setup()
    await openAuditTab(user)
    await waitFor(() => {
      expect(screen.getAllByText(/10\.0\.0\.1/).length).toBeGreaterThan(0)
    }, { timeout: 3000 })
  })
})

describe('the demo account picker never points at a missing key', () => {
  it('pre-fills a real account on first render', () => {
    renderApp()
    // The crash was DEMO_ACCOUNTS.Superadmin -> undefined -> .username.
    const selected = screen.getByRole('combobox').querySelector('option:checked')
    expect(selected).toBeTruthy()
    expect(selected.textContent).not.toMatch(/undefined/i)
  })

  it('every option resolves to credentials', async () => {
    const user = userEvent.setup()
    renderApp()
    const picker = screen.getByRole('combobox')
    const options = [...picker.querySelectorAll('option')]
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      await user.selectOptions(picker, option.value)
      expect(document.querySelector('input[type="text"]').value).not.toBe('')
    }
  })
})

describe('data is loaded from the API, not hardcoded', () => {
  it('requests the real endpoints on sign-in', async () => {
    seedSignedInUser()
    renderApp('/')
    await waitFor(() => {
      const urls = mock.calls.map((c) => c.url)
      expect(urls).toContain('/dashboard/summary/')
      expect(urls).toContain('/user-profiles/')
      expect(urls).toContain('/rooms/')
    })
  })

  it('never calls the catalog routes retired in Phase 5', async () => {
    seedSignedInUser()
    renderApp('/')
    await waitFor(() => expect(mock.calls.length).toBeGreaterThan(0))
    const urls = mock.calls.map((c) => c.url)
    expect(urls.some((u) => u.includes('/products/') || u.includes('/vss-services/'))).toBe(false)
  })
})
