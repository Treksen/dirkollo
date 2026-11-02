import { describe, it, expect, vi, beforeAll } from 'vitest'
import { applyOp, pendingRow, applyAllPending, isNetErr, blankClient } from '../src/pending.js'

beforeAll(() => { vi.stubGlobal('navigator', { onLine: true }) }) // Node has no navigator.onLine; browsers do

const server = { ...blankClient('c1'), name: 'Anne', status: 'Booked', pay: [{ id: 'p0', d: '2026-10-01', amt: 1000, m: 'Cash', note: '' }], paid: 1000 }

describe('offline changes shown on screen before they reach the server', () => {
  it('creates a new client that the server has never seen', () => {
    const op = { k: 'save', id: 'new1', isNew: true, local: { name: 'Zed', status: 'Booked', codes: ['1'] }, pay: { id: 'p1', amount: 500, method: 'Deposit', paid_on: '2026-10-23' } }
    const r = pendingRow(null, 'new1', [op])
    expect(r.name).toBe('Zed')
    expect(r.paid).toBe(500)
  })
  it('a status change only touches the status', () => {
    const r = applyOp(server, { k: 'patch', id: 'c1', local: { status: 'Shot' } })
    expect(r.status).toBe('Shot')
    expect(r.name).toBe('Anne')
  })
  it('payments add up as changes, and the same payment never counts twice', () => {
    const pay = { k: 'pay', id: 'c1', local: { id: 'p9', d: '2026-10-23', amt: 250, m: 'M-Pesa', note: '' } }
    const once = applyOp(server, pay)
    expect(once.paid).toBe(1250)
    expect(applyOp(once, pay).paid).toBe(1250)
  })
  it('changes made in order are applied in order', () => {
    const ops = [{ k: 'patch', id: 'c1', local: { status: 'Shot' } }, { k: 'patch', id: 'c1', local: { status: 'Selecting' } }]
    expect(pendingRow(server, 'c1', ops).status).toBe('Selecting')
  })
  it('ignores failed changes, so the server copy is the truth', () => {
    expect(pendingRow(server, 'c1', [{ k: 'patch', id: 'c1', failed: true, local: { status: 'Delivered' } }]).status).toBe('Booked')
  })
  it('does not invent a client from a payment alone', () => {
    expect(pendingRow(null, 'ghost', [{ k: 'pay', id: 'ghost', local: { id: 'x', amt: 1 } }])).toBeNull()
  })
  it('lays all waiting changes over a fresh server list', () => {
    const list = applyAllPending([server], [{ k: 'patch', id: 'c1', local: { status: 'Editing' } }, { k: 'save', id: 'n', isNew: true, local: { name: 'New' } }])
    expect(list.map((c) => c.name).sort()).toEqual(['Anne', 'New'])
    expect(list.find((c) => c.id === 'c1').status).toBe('Editing')
  })
})

describe('network error detection', () => {
  it('recognises a dropped connection but not a refusal from the server', () => {
    expect(isNetErr('TypeError: Failed to fetch')).toBe(true)
    expect(isNetErr('new row violates row-level security policy')).toBe(false)
  })
})

describe('stage timing for offline status changes', () => {
  it('stamps the time the stage changed, so stuck-stage flags stay right offline', () => {
    const r = applyOp(server, { k: 'patch', id: 'c1', at: 1700000000000, local: { status: 'Shot' } })
    expect(r.statusAt).toBe(new Date(1700000000000).toISOString())
  })
  it('does not restamp when the status did not change', () => {
    const r = applyOp({ ...server, statusAt: 'x' }, { k: 'patch', id: 'c1', at: 1, local: { status: 'Booked' } })
    expect(r.statusAt).toBe('x')
  })
})
