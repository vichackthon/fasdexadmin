import { useState, useEffect, useRef } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Bike, Search, CheckCircle, Clock, XCircle, Wifi, Star } from 'lucide-react'
import RiderProfileModal from '../components/RiderProfileModal'
import DeliveryHistoryModal from '../components/DeliveryHistoryModal'
import ConfirmDeleteModal from '../../../components/ui/ConfirmDeleteModal'
import { fetchAdminRiderRecords, type AdminRiderRecord } from '../../../lib/adminRiders'
import { isRiderActuallyOnline } from '../../../lib/riderPresence'
import {
    MIN_TIMED_DELIVERIES,
    deliveryTimeTone,
    formatDateTime,
    formatDuration,
    getOrderTimings,
    straightLineKm,
} from '../../../lib/orderTimings'
import { supabase } from '../../../lib/supabase'

type Rider = AdminRiderRecord
type RiderSort = 'newest' | 'fastest' | 'slowest' | 'rating'

// Riders with too few timed deliveries rank after those with enough, and
// riders with none rank last, so one lucky 8-minute trip can't top the board.
function speedBucket(rider: Rider) {
    const { timedDeliveries } = rider.delivery_speed
    if (timedDeliveries >= MIN_TIMED_DELIVERIES) return 0
    return timedDeliveries > 0 ? 1 : 2
}

function sortRiders(riders: Rider[], sortBy: RiderSort): Rider[] {
    if (sortBy === 'newest') return riders
    const sorted = [...riders]
    if (sortBy === 'rating') {
        return sorted.sort((a, b) =>
            (b.rider_total_ratings > 0 ? b.rider_rating ?? 0 : -1) -
            (a.rider_total_ratings > 0 ? a.rider_rating ?? 0 : -1))
    }
    const direction = sortBy === 'fastest' ? 1 : -1
    return sorted.sort((a, b) =>
        speedBucket(a) - speedBucket(b) ||
        direction * ((a.delivery_speed.avgRiderMinutes ?? 0) - (b.delivery_speed.avgRiderMinutes ?? 0)))
}

export default function RidersPage() {
    const [riders, setRiders] = useState<Rider[]>([])
    const [selectedRider, setSelectedRider] = useState<Rider | null>(null)
    const [profileModalOpen, setProfileModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [totalRiders, setTotalRiders] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState<RiderSort>('newest')
    const [riderDeliveries, setRiderDeliveries] = useState<any[]>([])
    const [loadingDeliveries, setLoadingDeliveries] = useState(false)
    const [riderEarnings, setRiderEarnings] = useState<Record<string, number>>({})
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [riderToDelete, setRiderToDelete] = useState<Rider | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [stats, setStats] = useState({ total: 0, online: 0, verified: 0, pending: 0 })
    const [presenceNow, setPresenceNow] = useState(() => Date.now())

    const itemsPerPage = 10

    // The subscriptions below are set up once. Calling fetchRiders directly
    // from them would use the first render's closure, snapping the table
    // back to page 1, no search and the default sort every 30 seconds.
    const fetchRidersRef = useRef<() => void>(() => {})

    useEffect(() => {
        const refresh = () => fetchRidersRef.current()

        const profilesChannel = supabase
            .channel('riders-profiles-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refresh)
            .subscribe()

        const verificationsChannel = supabase
            .channel('riders-verifications-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_verifications' }, refresh)
            .subscribe()

        const courierLocationsChannel = supabase
            .channel('riders-courier-locations-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_locations' }, refresh)
            .subscribe()

        const presenceInterval = window.setInterval(() => {
            setPresenceNow(Date.now())
            refresh()
        }, 30000)

        return () => {
            supabase.removeChannel(profilesChannel)
            supabase.removeChannel(verificationsChannel)
            supabase.removeChannel(courierLocationsChannel)
            window.clearInterval(presenceInterval)
        }
    }, [])

    useEffect(() => { fetchRiders() }, [currentPage, searchQuery, sortBy])

    const fetchRiders = async () => {
        setLoading(true)
        try {
            const allRiders = await fetchAdminRiderRecords(supabase)
            const normalizedSearch = searchQuery.trim().toLowerCase()
            const filteredRiders = normalizedSearch
                ? allRiders.filter((rider) =>
                    rider.full_name?.toLowerCase().includes(normalizedSearch) ||
                    rider.phone_number?.toLowerCase().includes(normalizedSearch) ||
                    rider.email?.toLowerCase().includes(normalizedSearch)
                )
                : allRiders
            const sortedRiders = sortRiders(filteredRiders, sortBy)

            const from = (currentPage - 1) * itemsPerPage
            const paginatedRiders = sortedRiders.slice(from, from + itemsPerPage)

            setRiders(paginatedRiders)
            setTotalRiders(filteredRiders.length)
            setStats({
                total: allRiders.length,
                online: allRiders.filter((rider) =>
                    isRiderActuallyOnline(rider.is_online, rider.courier_location, presenceNow)
                ).length,
                verified: allRiders.filter((rider) => rider.verification_status === 'approved').length,
                pending: allRiders.filter((rider) => rider.verification_status === 'pending').length,
            })

            if (paginatedRiders.length > 0) {
                const riderIds = paginatedRiders.map((rider) => rider.id)
                const { data: payoutsData } = await supabase
                    .from('payouts').select('recipient_id, amount')
                    .in('recipient_id', riderIds).eq('status', 'paid').is('restaurant_id', null)

                const earningsMap: Record<string, number> = {}
                    ;(payoutsData || []).forEach((p: any) => {
                        earningsMap[p.recipient_id] = (earningsMap[p.recipient_id] || 0) + Number(p.amount)
                    })
                setRiderEarnings(earningsMap)
            } else {
                setRiderEarnings({})
            }
        } catch (error) {
            console.error('Error fetching riders:', error)
        } finally {
            setLoading(false)
        }
    }

    fetchRidersRef.current = fetchRiders

    const fetchRiderDeliveries = async (riderId: string) => {
        setLoadingDeliveries(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`id, order_number, status, total_amount, delivery_fee, delivery_address,
                    created_at, updated_at, accepted_at, picked_up_at, delivered_at,
                    delivery_kind, pickup_address, pickup_latitude, pickup_longitude,
                    delivery_latitude, delivery_longitude, recipient_name, recipient_phone,
                    restaurant:restaurants(name, address),
                    customer:profiles!orders_customer_id_fkey(full_name, phone_number)`)
                .eq('rider_id', riderId).eq('status', 'delivered')
                .order('delivered_at', { ascending: false, nullsFirst: false }).limit(20)
            if (error) throw error
            setRiderDeliveries(data || [])
        } catch (error) {
            setRiderDeliveries([])
        } finally {
            setLoadingDeliveries(false)
        }
    }

    const handleConfirmDelete = async () => {
        if (!riderToDelete) return
        setDeleting(true)
        try {
            const rid = riderToDelete.id
            await supabase.from('orders').update({ rider_id: null }).eq('rider_id', rid)
            await supabase.from('rider_verifications').delete().eq('rider_id', rid)
            await supabase.from('payouts').delete().eq('recipient_id', rid)
            await supabase.from('notifications').delete().eq('user_id', rid)
            await supabase.from('support_tickets').delete().eq('user_id', rid)
            await supabase.from('courier_locations').delete().eq('rider_id', rid)
            const { error } = await supabase.from('profiles').delete().eq('id', rid)
            if (error) throw error
            setDeleteModalOpen(false)
            setRiderToDelete(null)
            fetchRiders()
        } catch (err: any) {
            alert(`Failed to delete: ${err?.message || 'Unknown error'}`)
        } finally {
            setDeleting(false)
        }
    }

    const getVerificationBadge = (rider: Rider) => {
        const status = rider.verification_status
        if (status === 'approved') return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="h-3 w-3" /> Verified
            </span>
        )
        if (status === 'pending') return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700">
                <Clock className="h-3 w-3" /> Pending
            </span>
        )
        if (status === 'rejected') return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                <XCircle className="h-3 w-3" /> Rejected
            </span>
        )
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                Not submitted
            </span>
        )
    }

    const getOnlineBadge = (rider: Rider) => {
        if (isRiderActuallyOnline(rider.is_online, rider.courier_location, presenceNow)) return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> Online
            </span>
        )
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Offline
            </span>
        )
    }

    // A rider with no ratings is not a 0.0 rider. Showing "—" keeps a new
    // hire from being read as the worst performer on the page, and colours
    // only kick in once there is enough history to mean something.
    const renderRating = (rider: Rider) => {
        const average = rider.rider_rating
        const count = rider.rider_total_ratings

        if (average === null || count === 0) {
            return <span className="text-gray-400 text-xs">No ratings</span>
        }

        const tone =
            count < 3 ? 'text-gray-600'
                : average >= 4.5 ? 'text-green-600'
                    : average >= 3.5 ? 'text-gray-900'
                        : average >= 2.5 ? 'text-orange-600'
                            : 'text-red-600'

        return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className={`font-medium ${tone}`}>{average.toFixed(1)}</span>
                <span className="text-gray-400 text-xs">({count})</span>
            </span>
        )
    }

    // Average rider time, accepted → delivered. Same rule as ratings: no
    // colour until there are enough deliveries to mean something.
    const renderDeliverySpeed = (rider: Rider) => {
        const { avgRiderMinutes, timedDeliveries } = rider.delivery_speed
        if (avgRiderMinutes === null) {
            return <span className="text-gray-400 text-xs">No data</span>
        }
        const tone = timedDeliveries < MIN_TIMED_DELIVERIES
            ? 'text-gray-600'
            : deliveryTimeTone(avgRiderMinutes)
        return (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className={`font-medium ${tone}`}>{formatDuration(avgRiderMinutes)}</span>
                <span className="text-gray-400 text-xs">({timedDeliveries})</span>
            </span>
        )
    }

    const totalPages = Math.max(1, Math.ceil(totalRiders / itemsPerPage))

    const formattedDeliveries = riderDeliveries.map((d: any) => {
        const timings = getOrderTimings(d)
        const km = straightLineKm(d.pickup_latitude, d.pickup_longitude, d.delivery_latitude, d.delivery_longitude)
        const isParcel = d.delivery_kind === 'parcel'
        return {
            id: d.order_number || d.id.slice(0, 8).toUpperCase(),
            distance: km === null ? 'N/A' : `${km.toFixed(1)} km`,
            date: formatDateTime(d.delivered_at || d.updated_at || d.created_at),
            riderTime: formatDuration(timings.riderTime),
            riderTimeTone: deliveryTimeTone(timings.riderTime),
            breakdown: timings.toPickup !== null && timings.onTheRoad !== null
                ? `${formatDuration(timings.toPickup)} to pickup · ${formatDuration(timings.onTheRoad)} on the road`
                : null,
            pickup: {
                name: isParcel ? 'Parcel pickup' : (d.restaurant as any)?.name || 'Unknown',
                address: d.pickup_address || (d.restaurant as any)?.address || 'N/A',
            },
            // A parcel goes to its recipient, not to the account that paid.
            destination: {
                name: (isParcel ? d.recipient_name : (d.customer as any)?.full_name) || 'Customer',
                address: d.delivery_address || 'N/A',
            },
            customerContact: (isParcel ? d.recipient_phone : (d.customer as any)?.phone_number) || 'N/A',
            earnings: `₦${(Number(d.delivery_fee) || 0).toLocaleString()}`,
        }
    })

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Rider Management</h1>
                    <p className="text-gray-500 text-sm">Manage and monitor delivery riders • Live data</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Riders', value: stats.total, icon: <Bike className="h-5 w-5 text-[#FF6E15]" /> },
                        { label: 'Online Now', value: stats.online, icon: <Wifi className="h-5 w-5 text-green-500" /> },
                        { label: 'Verified', value: stats.verified, icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
                        { label: 'Pending Approval', value: stats.pending, icon: <Clock className="h-5 w-5 text-yellow-500" /> },
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

                {/* Search + sort */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative w-full md:max-w-[400px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search by name, phone or email"
                            className="h-11 pl-10 bg-white"
                            value={searchQuery}
                            onChange={(e) => { setCurrentPage(1); setSearchQuery(e.target.value) }}
                        />
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Sort by</span>
                        <select
                            value={sortBy}
                            onChange={(e) => { setCurrentPage(1); setSortBy(e.target.value as RiderSort) }}
                            className="h-11 px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full sm:w-[180px]"
                        >
                            <option value="newest">Newest</option>
                            <option value="fastest">Fastest delivery</option>
                            <option value="slowest">Slowest delivery</option>
                            <option value="rating">Highest rated</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">All Riders</h3>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-gray-500">Loading riders...</div>
                        ) : riders.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">
                                No riders found.
                                {!searchQuery && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        If older accounts are still missing, run `FIX_ADMIN_RIDER_VISIBILITY.sql` to repair historical rider roles.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-gray-100 bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Rider</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Contact</th>
                                                <th className="hidden 2xl:table-cell px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Address</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Status</th>
                                                <th className="px-4 py-3 font-medium text-gray-500">Deliveries</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Rating</th>
                                                <th
                                                    className="px-4 py-3 font-medium text-gray-500"
                                                    title="Average time from accepting an order to delivering it, over (n) timed deliveries."
                                                >
                                                    Avg delivery
                                                </th>
                                                <th className="px-4 py-3 font-medium text-gray-500">Earnings (₦)</th>
                                                <th className="hidden 2xl:table-cell px-4 py-3 font-medium text-gray-500 whitespace-nowrap">Joined</th>
                                                <th className="px-4 py-3 font-medium text-gray-500 text-right whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {riders.map((rider) => (
                                                <tr key={rider.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    {/* Name + Avatar */}
                                                    <td className="px-4 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                                                <img
                                                                    src={rider.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(rider.full_name || 'R')}&background=FF6E15&color=fff`}
                                                                    alt={rider.full_name || 'Rider'}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            </div>
                                                            <span className="font-medium text-gray-900">{rider.full_name || '—'}</span>
                                                        </div>
                                                    </td>

                                                    {/* Contact */}
                                                    <td className="px-4 py-4">
                                                        <p className="text-gray-900">{rider.phone_number || '—'}</p>
                                                        <p className="text-gray-400 text-xs">{rider.email || '—'}</p>
                                                    </td>

                                                    {/* Address */}
                                                    <td className="hidden 2xl:table-cell px-4 py-4 text-gray-600 max-w-[160px]">
                                                        <span className="line-clamp-2 text-xs">{(rider as any).address || '—'}</span>
                                                    </td>

                                                    {/* Online + verification, stacked to keep the table narrow */}
                                                    <td className="px-4 py-4">
                                                        <div className="flex flex-col items-start gap-1.5 whitespace-nowrap">
                                                            {getOnlineBadge(rider)}
                                                            {getVerificationBadge(rider)}
                                                        </div>
                                                    </td>

                                                    {/* Deliveries */}
                                                    <td className="px-4 py-4 text-gray-600">{rider.order_count}</td>

                                                    {/* Rating */}
                                                    <td className="px-4 py-4">{renderRating(rider)}</td>

                                                    {/* Delivery speed */}
                                                    <td className="px-4 py-4">{renderDeliverySpeed(rider)}</td>

                                                    {/* Earnings */}
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {riderEarnings[rider.id] ? riderEarnings[rider.id].toLocaleString() : '—'}
                                                    </td>

                                                    {/* Joined */}
                                                    <td className="hidden 2xl:table-cell px-4 py-4 text-gray-500 text-xs whitespace-nowrap">
                                                        {new Date(rider.created_at).toLocaleDateString('en-GB')}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button
                                                                onClick={() => { setSelectedRider(rider); setProfileModalOpen(true) }}
                                                                className="text-sm font-medium text-[#FF6E15] hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => { setRiderToDelete(rider); setDeleteModalOpen(true) }}
                                                                className="text-sm font-medium text-red-500 hover:underline"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, totalRiders)} of {totalRiders}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                                            Previous
                                        </Button>
                                        {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`h-8 w-8 flex items-center justify-center rounded-[6px] text-sm transition-colors ${currentPage === page ? 'bg-[#FF6E15] text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                        <Button size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            <RiderProfileModal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                onViewHistory={() => { setProfileModalOpen(false); if (selectedRider) fetchRiderDeliveries(selectedRider.id); setHistoryModalOpen(true) }}
                onVerificationChanged={() => { fetchRiders() }}
                rider={selectedRider ? {
                    id: selectedRider.id,
                    name: selectedRider.full_name || 'Unknown Rider',
                    avatar: selectedRider.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedRider.full_name || 'R')}&background=FF6E15&color=fff`,
                    joinedDate: new Date(selectedRider.created_at).toLocaleDateString(),
                    isVerified: selectedRider.verification_status === 'approved',
                    verificationStatus: selectedRider.verification_status,
                    email: selectedRider.email || 'N/A',
                    phone: selectedRider.phone_number || 'N/A',
                    location: (selectedRider as any).address || 'N/A',
                    deliveries: selectedRider.order_count,
                    rating: selectedRider.rider_rating,
                    totalRatings: selectedRider.rider_total_ratings,
                    deliverySpeed: selectedRider.delivery_speed,
                    earnings: riderEarnings[selectedRider.id] || 0,
                } : null}
            />

            <DeliveryHistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                riderName={selectedRider?.full_name || ''}
                deliveries={formattedDeliveries}
                loading={loadingDeliveries}
            />

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setRiderToDelete(null) }}
                onConfirm={handleConfirmDelete}
                loading={deleting}
                title={`Delete ${riderToDelete?.full_name || 'rider'}?`}
                description="This will permanently delete the rider profile, verification records, and unassign them from any orders."
            />
        </MainLayout>
    )
}
