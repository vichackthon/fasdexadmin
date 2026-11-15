import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/logisticsQuoteDocuments.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { quoteLink, quoteMessage, quotePrintHtml } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const q = { code: 'FQ-ABCDEF0123456789ABCD', fee: 1999.50, created_at: '2026-10-23T10:00:00Z', expires_at: '2026-10-25T10:00:00Z', pickup_address: '<script>alert(1)</script>', dropoff_address: 'Calabar Road', parcel_description: 'Documents & books', parcel_size: 'small', customer_name: '<img src=x onerror=alert(1)>', status: 'quoted', payment_status: 'pending' }
const link = quoteLink('https://customer.example/subpath/?old=1#old', q.code)
assert.equal(link, 'https://customer.example/subpath/#/logistics-quote?code=FQ-ABCDEF0123456789ABCD')
assert.throws(() => quoteLink('javascript:alert(1)', q.code))
assert.match(quoteMessage(q, link), /Quotation/)
assert.match(quoteMessage(q, link), /1,999.50/)
assert.doesNotMatch(quoteMessage(q, link), /Payment receipt/)
const html = quotePrintHtml(q, link)
assert.doesNotMatch(html, /<script>|<img/)
assert.match(html, /&lt;script&gt;/)
assert.match(html, /Documents &amp; books/)
assert.match(html, /Delivery quotation/)
const paid = { ...q, status: 'paid', payment_status: 'paid', paid_at: '2026-10-23T10:00:00Z', payment_reference: 'reference-123' }
assert.match(quotePrintHtml(paid, link), /Payment receipt/)
assert.match(quoteMessage(paid, link), /reference-123/)
assert.doesNotMatch(quoteMessage(paid, link), /Sign in to view and pay/)
console.log('Quote links, amounts, print escaping and paid-only receipt checks passed.')
