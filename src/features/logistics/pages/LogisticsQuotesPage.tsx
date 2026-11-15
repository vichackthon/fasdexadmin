import { useEffect, useRef, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../../components/layout/MainLayout'
import { useAdminCapabilities } from '../../../hooks/useAdminCapabilities'
import { calculateLogisticsQuote, cancelLogisticsQuote, listLogisticsQuotes, saveLogisticsQuote } from '../../../lib/logisticsQuotes'
import type { LogisticsQuote, QuoteDetails } from '../../../lib/logisticsQuotes'
import { money, quoteDate, quoteLink, quoteMessage, quotePrintHtml, quoteStatus } from '../../../lib/logisticsQuoteDocuments'
import QuoteLocationPicker from '../components/QuoteLocationPicker'
import type { QuoteLocation } from '../components/QuoteLocationPicker'

const EMPTY_LOCATION: QuoteLocation = { address: '', lat: null, lng: null }
const inputClass = 'w-full rounded-lg border border-gray-200 bg-white p-3 text-sm disabled:opacity-50'
const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const mapsEnabled = !!mapsKey && mapsKey !== 'REPLACE_WITH_WEB_MAPS_API_KEY'
const customerUrl = import.meta.env.VITE_CUSTOMER_APP_URL || 'https://app.fasdex.ng'
const initial = { customer_name: '', customer_phone: '', parcel_size: 'small' as const, parcel_description: '', pickup_contact_name: '', pickup_contact_phone: '', recipient_name: '', recipient_phone: '', special_instructions: '' }
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

function QuotesContent() {
    const permissions = useAdminCapabilities()
    const allowed = permissions.can('orders.reassign_rider')
    const navigate = useNavigate()
    const [pickup, setPickup] = useState<QuoteLocation>(EMPTY_LOCATION)
    const [dropoff, setDropoff] = useState<QuoteLocation>(EMPTY_LOCATION)
    const [form, setForm] = useState<Omit<QuoteDetails, 'pickup_address' | 'pickup_latitude' | 'pickup_longitude' | 'dropoff_address' | 'dropoff_latitude' | 'dropoff_longitude'>>(initial)
    const [override, setOverride] = useState('')
    const [reason, setReason] = useState('')
    const [hours, setHours] = useState(48)
    const [price, setPrice] = useState<{ fee: number; distance: number } | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [search, setSearch] = useState('')
    const [quotes, setQuotes] = useState<LogisticsQuote[]>([])
    const [selected, setSelected] = useState<LogisticsQuote | null>(null)
    const [listLoading, setListLoading] = useState(false)
    const [listError, setListError] = useState('')
    const [refresh, setRefresh] = useState(0)
    const listSequence = useRef(0)

    useEffect(() => { setPrice(null) }, [pickup, dropoff, form.parcel_size])
    useEffect(() => {
        if (!allowed) return
        let alive = true
        const load = async () => {
            const seq = ++listSequence.current
            setListLoading(true)
            try {
                const rows = await listLogisticsQuotes(search)
                if (!alive || seq !== listSequence.current) return
                setQuotes(rows); setListError('')
                setSelected(previous => previous ? rows.find(q => q.id === previous.id) || previous : null)
            } catch (e) { if (alive && seq === listSequence.current) setListError(errorText(e)) }
            finally { if (alive && seq === listSequence.current) setListLoading(false) }
        }
        const timer = window.setTimeout(() => void load(), 250)
        const interval = window.setInterval(() => void load(), 30000)
        return () => { alive = false; window.clearTimeout(timer); window.clearInterval(interval) }
    }, [allowed, search, refresh])

    const details = (): QuoteDetails => {
        if (pickup.lat == null || pickup.lng == null || dropoff.lat == null || dropoff.lng == null || !pickup.address.trim() || !dropoff.address.trim()) throw new Error('Select both addresses and their exact locations.')
        return { ...form, pickup_address: pickup.address, pickup_latitude: pickup.lat, pickup_longitude: pickup.lng, dropoff_address: dropoff.address, dropoff_latitude: dropoff.lat, dropoff_longitude: dropoff.lng }
    }
    const run = async (action: () => Promise<void>) => {
        setBusy(true); setError(''); setNotice('')
        try { await action() } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
    }
    const share = async (kind: 'copy' | 'print') => {
        if (!selected) return
        try {
            const link = quoteLink(customerUrl, selected.code)
            if (kind === 'copy') { await navigator.clipboard.writeText(quoteMessage(selected, link)); setNotice('Copied. You can paste it into WhatsApp or a message.') }
            else {
                const popup = window.open('', '_blank')
                if (!popup) throw new Error('Allow popups to open the printable quotation.')
                popup.opener = null
                popup.document.write(quotePrintHtml(selected, link)); popup.document.close()
            }
        } catch (e) { setError(errorText(e)) }
    }
    if (permissions.isLoading) return <p>Checking access…</p>
    if (permissions.isError) return <div role="alert">Unable to check your permissions. <button onClick={() => void permissions.refetch()}>Try again</button></div>
    if (!allowed) return <p>Logistics quotations are available to operations managers and super admins. Ask your administrator to review your access.</p>

    return <div className="space-y-6">
        <header><h1 className="text-2xl font-bold">Logistics quotations</h1><p className="mt-1 text-sm text-gray-500">Price enquiries, share a quotation, and let the customer pay with their code.</p></header>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        <div className="grid items-start gap-6 xl:grid-cols-2">
            <form onSubmit={e => { e.preventDefault(); void run(async () => {
                if (!form.parcel_description.trim()) throw new Error('Describe the parcel contents.')
                const fee = override.trim() ? Number(override) : null
                if (fee != null && (!Number.isFinite(fee) || fee <= 0)) throw new Error('Enter a valid custom price.')
                if (fee != null && !reason.trim()) throw new Error('Add a reason for the custom price.')
                const saved = await saveLogisticsQuote(details(), fee, reason, hours)
                setSelected(saved); setRefresh(n => n + 1)
                setNotice('Quotation saved. Its price is fixed until expiry. Share the code or printable quotation below.')
            }) }} className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold">New quotation</h2>
                <fieldset disabled={busy} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">{(['customer_name', 'customer_phone'] as const).map(key => <label key={key} className="space-y-1 text-sm"><span>{key === 'customer_name' ? 'Customer name (optional)' : 'Customer phone (optional)'}</span><input className={inputClass} value={form[key]} type={key.endsWith('phone') ? 'tel' : 'text'} maxLength={200} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>
                    {!mapsEnabled && <p className="text-sm text-amber-700">Map search is not configured. You can enter addresses and paste their coordinates from Google Maps.</p>}
                    <QuoteLocationPicker label="Pickup" value={pickup} onChange={setPickup} mapsEnabled={mapsEnabled} disabled={busy} />
                    <QuoteLocationPicker label="Destination" value={dropoff} onChange={setDropoff} mapsEnabled={mapsEnabled} disabled={busy} />
                    <label className="block space-y-1 text-sm"><span>Parcel size</span><select className={inputClass} value={form.parcel_size} onChange={e => setForm({ ...form, parcel_size: e.target.value as QuoteDetails['parcel_size'] })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
                    <label className="block space-y-1 text-sm"><span>Contents</span><input className={inputClass} required maxLength={2000} placeholder="e.g. documents" value={form.parcel_description} onChange={e => setForm({ ...form, parcel_description: e.target.value })} /></label>
                    <details><summary className="cursor-pointer text-sm font-medium">Pickup, receiver and rider details (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{([
                        ['pickup_contact_name', 'Pickup contact name'], ['pickup_contact_phone', 'Pickup contact phone'], ['recipient_name', 'Receiver name'], ['recipient_phone', 'Receiver phone'], ['special_instructions', 'Instructions for the rider'],
                    ] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><input className={inputClass} maxLength={key === 'special_instructions' ? 2000 : 200} type={key.endsWith('phone') ? 'tel' : 'text'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}</div></details>
                    <button type="button" className="rounded-lg border px-4 py-3 text-sm font-medium" onClick={() => void run(async () => setPrice(await calculateLogisticsQuote(details())))}>Calculate price</button>
                    {price && <div className="rounded-lg bg-orange-50 p-4"><p className="text-xs text-gray-600">Standard price · {price.distance.toFixed(2)} km</p><p className="text-2xl font-bold">{money(price.fee)}</p></div>}
                    <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Custom price (optional)</span><input className={inputClass} type="number" min="0.01" max="10000000" step="0.01" value={override} onChange={e => setOverride(e.target.value)} placeholder="Use the standard price" /></label><label className="space-y-1 text-sm"><span>Valid for</span><select className={inputClass} value={hours} onChange={e => setHours(Number(e.target.value))}>{[2, 24, 48, 72, 168].map(h => <option key={h} value={h}>{h} hours</option>)}</select></label></div>
                    {override && <label className="block space-y-1 text-sm"><span>Reason for custom price</span><input className={inputClass} required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>}
                    <p className="text-xs text-gray-500">The standard price is checked again when saving. A saved quotation keeps its price even if your tariff changes. After checkout starts, the customer has two hours to complete payment.</p>
                    <button className="w-full rounded-lg bg-[#FF6E15] px-4 py-3 font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>{busy ? 'Working…' : 'Save quotation and generate code'}</button>
                </fieldset>
            </form>
            <div className="space-y-5">
                {selected && <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{selected.payment_status === 'paid' ? 'Payment receipt' : 'Saved quotation'}</h2><span className="rounded-full bg-orange-50 px-3 py-1 text-xs">{quoteStatus(selected.status)}</span></div>
                    <p className="break-all font-mono text-lg font-semibold">{selected.code}</p>
                    <p className="text-3xl font-bold">{money(Number(selected.fee))}</p>
                    <p className="text-sm"><b>Pickup:</b> {selected.pickup_address}</p><p className="text-sm"><b>Destination:</b> {selected.dropoff_address}</p>
                    <p className="text-sm">{selected.parcel_description} · {selected.parcel_size}</p>
                    <p className="text-sm text-gray-500">Valid until {quoteDate(selected.expires_at)} (Lagos time)</p>
                    {selected.adjustment_reason && <p className="text-xs text-gray-500">Staff adjustment: {money(Number(selected.calculated_fee))} → {money(Number(selected.fee))}. {selected.adjustment_reason}</p>}
                    <p className="text-xs text-gray-500">The customer can open the payment link or enter this code under Send parcel → Have a quotation code?</p>
                    <div className="flex flex-wrap gap-2"><button className="rounded-lg bg-orange-500 px-4 py-2 text-sm text-white" onClick={() => void share('copy')}>Copy message and payment link</button><button className="rounded-lg border px-4 py-2 text-sm" onClick={() => void share('print')}>Print / Save as PDF</button><button className="rounded-lg border px-4 py-2 text-sm" onClick={() => void run(async () => { await navigator.clipboard.writeText(selected.code); setNotice('Quotation code copied.') })}>Copy code</button></div>
                    {selected.order_id && <p className="text-sm">Booking #{selected.order_number || selected.order_id.slice(0, 8)}</p>}
                    {selected.order_id ? <button className="text-sm font-medium text-orange-600" onClick={() => navigate(`/orders?orderId=${encodeURIComponent(selected.order_id!)}`)}>Open booking and assign rider</button> : selected.status === 'quoted' && <button disabled={busy} className="text-sm text-red-600" onClick={() => { if (window.confirm('Withdraw this quotation? The customer will no longer be able to pay it.')) void run(async () => { setSelected(await cancelLogisticsQuote(selected.id)); setRefresh(n => n + 1); setNotice('Quotation withdrawn.') }) }}>Withdraw quotation</button>}
                </section>}
                <section className="space-y-3 rounded-xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-semibold">Saved quotations</h2><button className="text-sm text-orange-600" onClick={() => setRefresh(n => n + 1)}>Refresh</button></div>
                    <input aria-label="Search quotations" className={inputClass} placeholder="Search code, customer or address" value={search} onChange={e => setSearch(e.target.value)} />
                    {listError && <p role="alert" className="text-sm text-red-600">{listError}</p>}
                    {listLoading && <p className="text-xs text-gray-500">Updating…</p>}
                    <div className="max-h-[650px] space-y-2 overflow-auto">{quotes.map(q => <button key={q.id} onClick={() => { setSelected(q); setError(''); setNotice('') }} className={`w-full rounded-lg border p-3 text-left ${selected?.id === q.id ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}><div className="flex flex-wrap justify-between gap-1 text-sm"><span className="break-all font-mono font-medium">{q.code}</span><b>{money(Number(q.fee))}</b></div><p className="mt-1 text-sm">{q.customer_name || 'Customer enquiry'} · {quoteStatus(q.status)}</p><p className="mt-1 truncate text-xs text-gray-500">{q.pickup_address} → {q.dropoff_address}</p></button>)}</div>
                    {!listLoading && !listError && quotes.length === 0 && <p className="py-5 text-center text-sm text-gray-500">No quotations found.</p>}
                    <p className="text-xs text-gray-400">Latest 100 matching quotations. Updates every 30 seconds.</p>
                </section>
            </div>
        </div>
    </div>
}

export default function LogisticsQuotesPage() {
    return <MainLayout>{mapsEnabled ? <APIProvider apiKey={mapsKey}><QuotesContent /></APIProvider> : <QuotesContent />}</MainLayout>
}
