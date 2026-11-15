/// <reference types="google.maps" />
import { useRef, useState } from 'react'
import { Map, Marker, useMapsLibrary } from '@vis.gl/react-google-maps'

export interface QuoteLocation { address: string; lat: number | null; lng: number | null }
const HUB = { lat: 4.945077, lng: 8.338061 }

export default function QuoteLocationPicker({ label, value, onChange, mapsEnabled, disabled }: {
    label: string; value: QuoteLocation; onChange: (value: QuoteLocation) => void; mapsEnabled: boolean; disabled?: boolean
}) {
    const geocoding = useMapsLibrary('geocoding')
    const [results, setResults] = useState<google.maps.GeocoderResult[]>([])
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const sequence = useRef(0)
    const [coordinateDraft, setCoordinateDraft] = useState('')
    const [mapCenter, setMapCenter] = useState(HUB)

    const search = async () => {
        if (!geocoding || !value.address.trim()) return
        const seq = ++sequence.current
        setBusy(true); setError('')
        try {
            const response = await new geocoding.Geocoder().geocode({ address: value.address, region: 'NG' })
            if (seq !== sequence.current) return
            setResults(response.results.slice(0, 5))
            if (!response.results.length) setError('No matching address. Try a nearby landmark or choose a point on the map.')
        } catch {
            if (seq === sequence.current) setError('Address search is unavailable. Choose a point on the map or enter coordinates.')
        } finally { if (seq === sequence.current) setBusy(false) }
    }
    const choose = async (lat: number, lng: number) => {
        const seq = ++sequence.current
        setResults([]); setError(''); setBusy(false)
        onChange({ ...value, lat, lng })
        setMapCenter({ lat, lng })
        if (!geocoding) return
        try {
            const response = await new geocoding.Geocoder().geocode({ location: { lat, lng } })
            if (seq === sequence.current && response.results[0]) onChange({ address: response.results[0].formatted_address, lat, lng })
        } catch { /* The admin can still supply the address for this pin. */ }
    }
    return <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-gray-200 p-4">
        <legend className="px-1 font-semibold">{label}</legend>
        <div className="flex gap-2">
            <input aria-label={`${label} address`} placeholder="Address or landmark" className="min-w-0 flex-1 rounded-lg border p-3 text-sm" value={value.address}
                onChange={e => { sequence.current++; setBusy(false); setResults([]); setError(''); onChange({ address: e.target.value, lat: null, lng: null }) }} />
            {mapsEnabled && <button type="button" disabled={busy || !geocoding || !value.address.trim()} onClick={search} className="rounded-lg border px-3 text-sm disabled:opacity-50">{busy ? 'Finding…' : 'Find'}</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {results.length > 0 && <ul className="max-h-48 overflow-auto rounded-lg border bg-white">{results.map(r => <li key={r.place_id}><button type="button" className="w-full p-3 text-left text-sm hover:bg-orange-50" onClick={() => { sequence.current++; setBusy(false); setResults([]); const point = { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }; setMapCenter(point); onChange({ address: r.formatted_address, ...point }) }}>{r.formatted_address}</button></li>)}</ul>}
        {mapsEnabled && <div className="h-48 overflow-hidden rounded-lg"><Map center={mapCenter} onCenterChanged={e => setMapCenter(e.detail.center)} defaultZoom={14} gestureHandling="cooperative" disableDefaultUI onClick={e => { if (!disabled && e.detail.latLng) void choose(e.detail.latLng.lat, e.detail.latLng.lng) }}>
            {value.lat != null && value.lng != null && <Marker position={{ lat: value.lat, lng: value.lng }} />}
        </Map></div>}
        <p className="text-xs text-gray-500">{value.lat != null && value.lng != null ? `Selected: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : 'Choose a search result or tap the exact location on the map.'}</p>
        <details className="text-xs text-gray-500"><summary className="cursor-pointer">Enter coordinates from Google Maps</summary>
            <p className="mt-2">Enter the address above, then use its latitude and longitude.</p>
            <div className="mt-2 flex gap-2"><input aria-label={`${label} coordinates`} className="min-w-0 flex-1 rounded border p-2" placeholder="4.945077, 8.338061" value={coordinateDraft} onChange={e => setCoordinateDraft(e.target.value)} />
                <button type="button" className="rounded border px-3" onClick={() => {
                    const parts = coordinateDraft.split(',').map(v => Number(v.trim()))
                    if (parts.length !== 2 || coordinateDraft.split(',').some(v => !v.trim()) || !parts.every(Number.isFinite) || Math.abs(parts[0]) > 90 || Math.abs(parts[1]) > 180) { setError('Enter a valid latitude and longitude.'); return }
                    void choose(parts[0], parts[1])
                }}>Use point</button></div>
        </details>
    </fieldset>
}
