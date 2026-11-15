import { useState, useEffect } from 'react'
import { X, ExternalLink, Star } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { formatDateOfBirth } from '../../../lib/formatters'
import { supabase } from '../../../lib/supabase'
import {
    MIN_TIMED_DELIVERIES,
    deliveryTimeTone,
    formatDuration,
    type RiderDeliverySpeed,
} from '../../../lib/orderTimings'

interface RatingEntry {
    id: string
    rating: number
    comment: string | null
    created_at: string
    order: { order_number: string | null } | null
    customer: { full_name: string | null } | null
}

interface VerificationDetails {
    vehicle_type: string | null
    plate_number: string | null
    date_of_birth: string | null
    guarantor_name: string | null
    guarantor_phone: string | null
    guarantor_address: string | null
    guarantor_relationship: string | null
    license_image_url: string | null
    document_url: string | null
    submitted_at: string | null
}

interface RiderProfileModalProps {
    isOpen: boolean
    onClose: () => void
    onViewHistory: () => void
    rider: {
        id: string
        name: string
        avatar: string
        joinedDate: string
        isVerified: boolean
        verificationStatus: string | null
        email: string
        phone: string
        location: string
        deliveries: number
        rating: number | null
        totalRatings: number
        deliverySpeed: RiderDeliverySpeed
        earnings: number
    } | null
    onVerificationChanged?: () => void
}

export default function RiderProfileModal({ isOpen, onClose, onViewHistory, rider, onVerificationChanged }: RiderProfileModalProps) {
    const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
    const [verificationDetails, setVerificationDetails] = useState<VerificationDetails | null>(null)
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [ratings, setRatings] = useState<RatingEntry[]>([])
    const [loadingRatings, setLoadingRatings] = useState(false)

    useEffect(() => {
        if (!isOpen || !rider) return
        if (!rider.verificationStatus) {
            setVerificationDetails(null)
            return
        }
        setLoadingDetails(true)
        supabase
            .from('rider_verifications')
            .select('vehicle_type, plate_number, date_of_birth, guarantor_name, guarantor_phone, guarantor_address, guarantor_relationship, license_image_url, document_url, submitted_at')
            .eq('rider_id', rider.id)
            .maybeSingle()
            .then(({ data }) => {
                setVerificationDetails(data)
                setLoadingDetails(false)
            })
    }, [isOpen, rider?.id])

    useEffect(() => {
        if (!isOpen || !rider) return
        setLoadingRatings(true)
        // Two foreign keys point at profiles (rider_id and customer_id), so
        // each embed names its constraint or PostgREST can't tell them apart.
        supabase
            .from('rider_ratings')
            .select(`
                id,
                rating,
                comment,
                created_at,
                order:orders!rider_ratings_order_id_fkey(order_number),
                customer:profiles!rider_ratings_customer_id_fkey(full_name)
            `)
            .eq('rider_id', rider.id)
            .order('created_at', { ascending: false })
            .limit(20)
            .then(({ data }) => {
                setRatings((data as unknown as RatingEntry[]) || [])
                setLoadingRatings(false)
            })
    }, [isOpen, rider?.id])

    if (!isOpen || !rider) return null

    const handleApprove = async () => {
        setActionLoading('approve')
        try {
            const { error } = await supabase
                .from('rider_verifications')
                .update({ status: 'approved', reviewed_at: new Date().toISOString() })
                .eq('rider_id', rider.id)
            if (error) throw error
            onVerificationChanged?.()
            onClose()
        } catch (err: any) {
            alert(`Failed to approve: ${err?.message || 'Unknown error'}`)
        } finally {
            setActionLoading(null)
        }
    }

    const handleReject = async () => {
        setActionLoading('reject')
        try {
            const { error } = await supabase
                .from('rider_verifications')
                .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
                .eq('rider_id', rider.id)
            if (error) throw error
            onVerificationChanged?.()
            onClose()
        } catch (err: any) {
            alert(`Failed to reject: ${err?.message || 'Unknown error'}`)
        } finally {
            setActionLoading(null)
        }
    }

    const isPending = rider.verificationStatus === 'pending'
    const isApproved = rider.verificationStatus === 'approved'
    const isRejected = rider.verificationStatus === 'rejected'

    return (
        <>
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[560px] max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">Rider profile</h2>
                            {isApproved && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Verified</span>}
                            {isPending && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Pending review</span>}
                            {isRejected && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rejected</span>}
                            {!rider.verificationStatus && <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Docs not submitted</span>}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Profile Header */}
                        <div className="flex items-center gap-4">
                            <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                <img src={rider.avatar} alt={rider.name} className="h-full w-full object-cover" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{rider.name}</h3>
                                <p className="text-sm text-gray-500">Joined {rider.joinedDate}</p>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Email</p>
                                <p className="text-sm text-gray-900 font-medium break-all">{rider.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Phone</p>
                                <p className="text-sm text-gray-900 font-medium">{rider.phone}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Address</p>
                                <p className="text-sm text-gray-900 font-medium">{rider.location}</p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-xl font-bold text-gray-900">{rider.deliveries}</p>
                                <p className="text-xs text-gray-500">Deliveries</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-xl font-bold text-gray-900">
                                    {rider.rating === null || rider.totalRatings === 0 ? '—' : rider.rating.toFixed(1)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {rider.totalRatings === 0
                                        ? 'No ratings'
                                        : `Rating (${rider.totalRatings})`}
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-3 text-center">
                                <p className="text-xl font-bold text-gray-900">₦{rider.earnings.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Earnings</p>
                            </div>
                        </div>

                        {/* Delivery speed */}
                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                                <p className="text-sm font-semibold text-gray-700">
                                    Delivery speed
                                    {rider.deliverySpeed.timedDeliveries > 0 && (
                                        <span className="ml-1.5 font-normal text-gray-400">
                                            ({rider.deliverySpeed.timedDeliveries} timed {rider.deliverySpeed.timedDeliveries === 1 ? 'delivery' : 'deliveries'})
                                        </span>
                                    )}
                                </p>
                            </div>

                            {rider.deliverySpeed.avgRiderMinutes === null ? (
                                <div className="p-4 text-sm text-gray-400">No completed deliveries with timings yet.</div>
                            ) : (
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-3 gap-3 text-center">
                                        <div>
                                            <p className={`text-xl font-bold ${rider.deliverySpeed.timedDeliveries < MIN_TIMED_DELIVERIES
                                                ? 'text-gray-900'
                                                : deliveryTimeTone(rider.deliverySpeed.avgRiderMinutes)}`}
                                            >
                                                {formatDuration(rider.deliverySpeed.avgRiderMinutes)}
                                            </p>
                                            <p className="text-xs text-gray-500">Avg delivery</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900">{formatDuration(rider.deliverySpeed.avgToPickupMinutes)}</p>
                                            <p className="text-xs text-gray-500">Avg to pickup</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-gray-900">{formatDuration(rider.deliverySpeed.avgOnTheRoadMinutes)}</p>
                                            <p className="text-xs text-gray-500">Avg on the road</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        Fastest {formatDuration(rider.deliverySpeed.fastestMinutes)} · slowest {formatDuration(rider.deliverySpeed.slowestMinutes)}.
                                        Measured from accepting the order to handing it over. Any wait for the food at the pickup lands in "to pickup"; "on the road" is the rider alone.
                                        {rider.deliverySpeed.timedDeliveries < MIN_TIMED_DELIVERIES && ' Too few deliveries to judge yet.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Verification Details */}
                        {rider.verificationStatus && (
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                                    <p className="text-sm font-semibold text-gray-700">Submitted verification details</p>
                                </div>

                                {loadingDetails ? (
                                    <div className="p-4 text-sm text-gray-400">Loading details...</div>
                                ) : verificationDetails ? (
                                    <div className="p-4 space-y-4">
                                        {/* Vehicle */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Vehicle / Motorcycle</p>
                                                <p className="text-sm font-medium text-gray-900">{verificationDetails.vehicle_type || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Plate number</p>
                                                <p className="text-sm font-medium text-gray-900">{verificationDetails.plate_number || '—'}</p>
                                            </div>
                                        </div>

                                        {/* DOB */}
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Date of birth</p>
                                            <p className="text-sm font-medium text-gray-900">{formatDateOfBirth(verificationDetails.date_of_birth, '—')}</p>
                                        </div>

                                        {/* Guarantor */}
                                        <div className="border-t border-gray-100 pt-4">
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Guarantor</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Name</p>
                                                    <p className="text-sm font-medium text-gray-900">{verificationDetails.guarantor_name || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                                                    <p className="text-sm font-medium text-gray-900">{verificationDetails.guarantor_phone || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Relationship</p>
                                                    <p className="text-sm font-medium text-gray-900">{verificationDetails.guarantor_relationship || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Address</p>
                                                    <p className="text-sm font-medium text-gray-900">{verificationDetails.guarantor_address || '—'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Document */}
                                        {(verificationDetails.document_url || verificationDetails.license_image_url) && (
                                            <div className="border-t border-gray-100 pt-4">
                                                <p className="text-xs text-gray-500 mb-2">Submitted document</p>
                                                <a
                                                    href={verificationDetails.document_url || verificationDetails.license_image_url || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF6E15] hover:underline"
                                                >
                                                    View document <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            </div>
                                        )}

                                        {verificationDetails.submitted_at && (
                                            <p className="text-xs text-gray-400">
                                                Submitted {new Date(verificationDetails.submitted_at).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 text-sm text-gray-400">No verification details found.</div>
                                )}
                            </div>
                        )}

                        {/* Approve / Reject Actions */}
                        {isPending && (
                            <div className="flex gap-3">
                                <Button
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleApprove}
                                    disabled={actionLoading !== null}
                                >
                                    {actionLoading === 'approve' ? 'Approving...' : 'Approve Rider'}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={handleReject}
                                    disabled={actionLoading !== null}
                                >
                                    {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                                </Button>
                            </div>
                        )}

                        {isRejected && (
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleApprove}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === 'approve' ? 'Approving...' : 'Approve Rider'}
                            </Button>
                        )}

                        {/* Customer feedback */}
                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                                <p className="text-sm font-semibold text-gray-700">
                                    Customer feedback
                                    {ratings.length > 0 && (
                                        <span className="ml-1.5 font-normal text-gray-400">
                                            (latest {ratings.length})
                                        </span>
                                    )}
                                </p>
                            </div>

                            {loadingRatings ? (
                                <div className="p-4 text-sm text-gray-400">Loading feedback...</div>
                            ) : ratings.length === 0 ? (
                                <div className="p-4 text-sm text-gray-400">No ratings yet.</div>
                            ) : (
                                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                                    {ratings.map((entry) => (
                                        <div key={entry.id} className="p-4 space-y-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-0.5">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Star
                                                            key={star}
                                                            className={`h-3.5 w-3.5 ${star <= entry.rating
                                                                ? 'fill-amber-400 text-amber-400'
                                                                : 'text-gray-300'}`}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                    {new Date(entry.created_at).toLocaleDateString('en-GB')}
                                                </span>
                                            </div>

                                            {entry.comment && (
                                                <p className="text-sm text-gray-700">{entry.comment}</p>
                                            )}

                                            {/* The linkage a complaint gets investigated through. */}
                                            <p className="text-xs text-gray-400">
                                                {entry.customer?.full_name || 'Customer'}
                                                {entry.order?.order_number ? ` · Order #${entry.order.order_number}` : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button className="w-full" onClick={onViewHistory}>
                            View delivery history and earnings
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
