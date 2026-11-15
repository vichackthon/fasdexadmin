import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../src/lib/parcelAssignment.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { isAwaitingParcelAssignment, orderStatusLabel } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const waiting = { delivery_kind: 'parcel', status: 'ready_for_pickup', rider_id: null, payment_status: 'paid' }
assert.equal(isAwaitingParcelAssignment(waiting), true)
assert.equal(orderStatusLabel(waiting), 'Awaiting admin assignment')
for (const changed of [
    { delivery_kind: 'food' }, { payment_status: 'pending' },
    { payment_status: null }, { status: 'pending' }, { status: 'cancelled' },
    { status: 'out_for_delivery', rider_id: 'rider-1' }, { rider_id: 'rider-1' },
]) assert.equal(isAwaitingParcelAssignment({ ...waiting, ...changed }), false)
assert.equal(orderStatusLabel({ ...waiting, delivery_kind: 'food' }), 'Ready For Pickup')
console.log('Parcel assignment queue and status checks passed.')
