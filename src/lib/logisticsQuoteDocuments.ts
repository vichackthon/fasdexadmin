export interface LogisticsQuote {
    id: string
    code: string
    created_at: string
    expires_at: string
    customer_name: string | null
    customer_phone: string | null
    pickup_address: string
    dropoff_address: string
    pickup_latitude: number
    pickup_longitude: number
    dropoff_latitude: number
    dropoff_longitude: number
    parcel_size: string
    parcel_description: string
    recipient_name: string | null
    recipient_phone: string | null
    pickup_contact_name: string | null
    pickup_contact_phone: string | null
    special_instructions: string | null
    calculated_fee: number
    fee: number
    distance_km: number
    adjustment_reason: string | null
    status: string
    order_id: string | null
    order_number: number | string | null
    order_status: string | null
    payment_status: string | null
    paid_at: string | null
    payment_reference: string | null
}

export const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(value)
export const quoteDate = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(value))
export const quoteStatus = (value: string) => ({
    quoted: 'Quoted', expired: 'Expired', cancelled: 'Withdrawn',
    awaiting_payment: 'Awaiting payment', payment_expired: 'Payment window expired',
    booking_cancelled: 'Booking cancelled', paid: 'Paid',
}[value] || value)

export function quoteLink(baseUrl: string, code: string): string {
    const url = new URL(baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use a valid customer web app URL.')
    url.hash = `/logistics-quote?code=${encodeURIComponent(code)}`
    url.search = ''
    return url.toString()
}

export function quoteMessage(q: LogisticsQuote, link: string): string {
    const paid = q.payment_status === 'paid'
    return [
        `Fasdex Logistics — ${paid ? 'Payment receipt' : 'Quotation'}`,
        `Reference: ${q.code}`,
        `Status: ${quoteStatus(q.status)}`,
        `Pickup: ${q.pickup_address}`,
        `Destination: ${q.dropoff_address}`,
        `Parcel: ${q.parcel_description} (${q.parcel_size})`,
        `${paid ? 'Amount paid' : 'Delivery price'}: ${money(Number(q.fee))}`,
        paid ? `Paid: ${q.paid_at ? quoteDate(q.paid_at) : 'Confirmed'}` : `Valid until: ${quoteDate(q.expires_at)} (Lagos time)`,
        paid ? `Payment reference: ${q.payment_reference || 'Confirmed'}` : 'Sign in to view and pay. Keep this quotation code private.',
        link,
    ].join('\n')
}

// All customer-entered text is escaped before entering a print document.
export function escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

export function quotePrintHtml(q: LogisticsQuote, link: string): string {
    const paid = q.payment_status === 'paid'
    const fields = [
        ['Reference', q.code], ['Customer', q.customer_name || 'Customer'],
        ['Created', quoteDate(q.created_at)], ['Status', quoteStatus(q.status)],
        ['Pickup', q.pickup_address], ['Destination', q.dropoff_address],
        ['Contents', q.parcel_description], ['Parcel size', q.parcel_size],
        ['Receiver', [q.recipient_name, q.recipient_phone].filter(Boolean).join(' · ') || 'To be confirmed at checkout'],
        ['Instructions', q.special_instructions || '—'],
        ...(paid ? [['Paid', q.paid_at ? quoteDate(q.paid_at) : 'Confirmed'], ['Payment reference', q.payment_reference || 'Confirmed']]
            : [['Valid until (Lagos time)', quoteDate(q.expires_at)]]),
    ]
    return `<!doctype html><html><head><meta charset="utf-8"><title>Fasdex ${escapeHtml(q.code)}</title><style>
    body{font:15px system-ui,sans-serif;max-width:720px;margin:40px auto;padding:24px;color:#1f2937}h1{color:#ea580c}h2{font-size:24px}table{width:100%;border-collapse:collapse}td{padding:12px 0;border-bottom:1px solid #eee;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:36%;color:#666}.total{font-size:28px;font-weight:700;margin:28px 0}p{overflow-wrap:anywhere;line-height:1.7}button{padding:12px 20px;cursor:pointer}@media print{button{display:none}body{margin:0;max-width:none}}</style></head><body>
    <h1>Fasdex Logistics</h1><h2>${paid ? 'Payment receipt' : 'Delivery quotation'}</h2>
    <table>${fields.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
    <p class="total">${paid ? 'Amount paid' : 'Delivery price'}: ${escapeHtml(money(Number(q.fee)))}</p>
    <p>${paid ? 'Payment confirmed. Delivery is managed by Fasdex. Booking status: ' + escapeHtml(q.order_status || 'Processing') : 'This quotation reserves the stated price until its expiry. A delivery booking is confirmed after payment.'}</p>
    <p>${escapeHtml(link)}</p><p>Keep your quotation code private. Prices are in Nigerian naira.</p>
    <button onclick="window.print()">Print / Save as PDF</button></body></html>`
}
