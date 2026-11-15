import { useEffect, useMemo, useState } from 'react'
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Bike, MapPin, Wifi, AlertTriangle } from 'lucide-react'
import { fetchRiderLocations, type RiderLocation } from '../../../lib/riderLocations'
import { supabase } from '../../../lib/supabase'

// Lagos, Nigeria — default center until riders load.
const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

function timeAgo(iso: string | null): string {
    if (!iso) return 'unknown'
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (Number.isNaN(secs)) return 'unknown'
    if (secs < 60) return `${secs}s ago`
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
    return `${Math.floor(secs / 3600)}h ago`
}

export default function LiveMapPage() {
    const [riders, setRiders] = useState<RiderLocation[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const load = async () => {
        try {
            const data = await fetchRiderLocations(supabase)
            setRiders(data)
        } catch (err) {
            console.error('Error fetching rider locations:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()

        const channel = supabase
            .channel('livemap-courier-locations-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_locations' }, () => {
                load()
            })
            .subscribe()

        // Safety-net refresh so stale-heartbeat riders dim even without a DB event.
        const interval = window.setInterval(load, 30000)

        return () => {
            supabase.removeChannel(channel)
            window.clearInterval(interval)
        }
    }, [])

    const freshRiders = useMemo(() => riders.filter((r) => r.isFresh), [riders])
    const onDelivery = useMemo(() => riders.filter((r) => r.activeOrder), [riders])
    const selected = useMemo(
        () => riders.find((r) => r.riderId === selectedId) ?? null,
        [riders, selectedId],
    )

    const mapCenter = freshRiders[0]
        ? { lat: freshRiders[0].latitude, lng: freshRiders[0].longitude }
        : DEFAULT_CENTER

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Live Rider Map</h1>
                    <p className="text-gray-500 text-sm">Real-time positions of riders currently on the road</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Riders Online', value: freshRiders.length, icon: <Wifi className="h-5 w-5 text-green-500" /> },
                        { label: 'On a Delivery', value: onDelivery.length, icon: <Bike className="h-5 w-5 text-[#FF6E15]" /> },
                        { label: 'With Location', value: riders.length, icon: <MapPin className="h-5 w-5 text-gray-500" /> },
                    ].map(({ label, value, icon }) => (
                        <Card key={label} className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-gray-500 text-sm font-medium">{label}</span>
                                    {icon}
                                </div>
                                <h2 className="text-[28px] font-bold text-gray-900">{value}</h2>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {!MAPS_API_KEY || MAPS_API_KEY === 'REPLACE_WITH_WEB_MAPS_API_KEY' ? (
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-8 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-gray-900">Google Maps key not configured</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Set <code className="px-1 bg-gray-100 rounded">VITE_GOOGLE_MAPS_API_KEY</code> in
                                    <code className="px-1 bg-gray-100 rounded ml-1">apps/admin-web/.env.local</code> to your
                                    HTTP-referrer-restricted "Maps - Web" key, then restart the dev server.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Map */}
                        <Card className="border-none shadow-sm lg:col-span-2 overflow-hidden">
                            <CardContent className="p-0">
                                <div className="h-[520px] w-full">
                                    <APIProvider apiKey={MAPS_API_KEY}>
                                        <Map
                                            defaultCenter={mapCenter}
                                            defaultZoom={12}
                                            gestureHandling="greedy"
                                            disableDefaultUI={false}
                                            mapTypeControl={false}
                                            streetViewControl={false}
                                            fullscreenControl={false}
                                        >
                                            {riders.map((rider) => (
                                                <Marker
                                                    key={rider.riderId}
                                                    position={{ lat: rider.latitude, lng: rider.longitude }}
                                                    onClick={() => setSelectedId(rider.riderId)}
                                                    opacity={rider.isFresh ? 1 : 0.4}
                                                />
                                            ))}

                                            {selected && (
                                                <InfoWindow
                                                    position={{ lat: selected.latitude, lng: selected.longitude }}
                                                    onCloseClick={() => setSelectedId(null)}
                                                >
                                                    <div className="min-w-[180px] p-1">
                                                        <p className="font-semibold text-gray-900">
                                                            {selected.fullName || 'Rider'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">{selected.phoneNumber || '—'}</p>
                                                        {selected.activeOrder ? (
                                                            <div className="mt-2 text-xs text-gray-600">
                                                                <p>
                                                                    <span className="font-medium">Order:</span>{' '}
                                                                    #{selected.activeOrder.orderNumber || '—'} ·{' '}
                                                                    {selected.activeOrder.status?.replace(/_/g, ' ')}
                                                                </p>
                                                                <p className="line-clamp-1">
                                                                    <span className="font-medium">To:</span>{' '}
                                                                    {selected.activeOrder.deliveryAddress || '—'}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="mt-2 text-xs text-gray-400">Idle — no active order</p>
                                                        )}
                                                        <p className="mt-2 text-[11px] text-gray-400">
                                                            Updated {timeAgo(selected.lastUpdated)}
                                                        </p>
                                                    </div>
                                                </InfoWindow>
                                            )}
                                        </Map>
                                    </APIProvider>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Side list */}
                        <Card className="border-none shadow-sm">
                            <CardContent className="p-0">
                                <div className="p-5 border-b border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-900">Active Riders</h3>
                                </div>
                                <div className="max-h-[460px] overflow-y-auto">
                                    {loading ? (
                                        <div className="p-8 text-center text-gray-500 text-sm">Loading…</div>
                                    ) : riders.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500 text-sm">
                                            No riders are sharing a location right now.
                                        </div>
                                    ) : (
                                        riders.map((rider) => (
                                            <button
                                                key={rider.riderId}
                                                onClick={() => setSelectedId(rider.riderId)}
                                                className={`w-full flex items-center gap-3 px-5 py-3 text-left border-b border-gray-50 hover:bg-gray-50/70 transition-colors ${
                                                    selectedId === rider.riderId ? 'bg-orange-50' : ''
                                                }`}
                                            >
                                                <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-200 shrink-0 relative">
                                                    <img
                                                        src={
                                                            rider.avatarUrl ||
                                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(rider.fullName || 'R')}&background=FF6E15&color=fff`
                                                        }
                                                        alt={rider.fullName || 'Rider'}
                                                        className="h-full w-full object-cover"
                                                    />
                                                    <span
                                                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
                                                            rider.isFresh ? 'bg-green-500' : 'bg-gray-400'
                                                        }`}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-gray-900 truncate text-sm">
                                                        {rider.fullName || '—'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate">
                                                        {rider.activeOrder
                                                            ? `#${rider.activeOrder.orderNumber || '—'} · ${rider.activeOrder.status?.replace(/_/g, ' ')}`
                                                            : `Idle · ${timeAgo(rider.lastUpdated)}`}
                                                    </p>
                                                </div>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}
