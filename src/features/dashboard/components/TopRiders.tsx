import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { fetchAdminRiderRecords } from '../../../lib/adminRiders'
import { supabase } from '../../../lib/supabase'

interface Rider {
    id: string
    name: string
    deliveries: number
    /** null until the rider has been rated at least once. */
    rating: number | null
    avatar_url: string | null
}

export default function TopRiders() {
    const [riders, setRiders] = useState<Rider[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchTopRiders()
    }, [])

    const fetchTopRiders = async () => {
        try {
            const ridersData = await fetchAdminRiderRecords(supabase)
            const ridersWithStats = ridersData.map((rider) => ({
                id: rider.id,
                name: rider.full_name || 'Anonymous Rider',
                deliveries: rider.delivered_count,
                rating: rider.rider_total_ratings > 0 ? rider.rider_rating : null,
                avatar_url: rider.avatar_url
            }))

            // Sort by deliveries and take top 5
            const topRiders = ridersWithStats
                .sort((a, b) => b.deliveries - a.deliveries)
                .slice(0, 5)

            setRiders(topRiders)
        } catch (error) {
            console.error('Error fetching top riders:', error)
        } finally {
            setLoading(false)
        }
    }

    const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

    return (
        <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-gray-900">Top Riders</CardTitle>
                <p className="text-sm text-gray-400 font-normal">Ranked by deliveries</p>
            </CardHeader>
            <CardContent className="pt-2">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-2.5 w-28 bg-gray-100 rounded animate-pulse" />
                                    <div className="h-2 w-16 bg-gray-100 rounded animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : riders.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-sm">No riders found</div>
                ) : (
                    <div className="space-y-4">
                        {riders.map((rider, index) => (
                            <div key={rider.id} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={`text-xs font-bold w-4 flex-shrink-0 ${rankColors[index] ?? 'text-gray-400'}`}>
                                        #{index + 1}
                                    </span>
                                    <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                                        <img
                                            src={rider.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(rider.name)}&background=FF6E15&color=fff`}
                                            alt={rider.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{rider.name}</p>
                                        <p className="text-xs text-gray-400">{rider.deliveries} deliveries</p>
                                    </div>
                                </div>
                                {rider.rating === null ? (
                                    <span className="text-xs text-gray-400 flex-shrink-0">No ratings</span>
                                ) : (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <Star className="h-3 w-3 fill-[#FF6E15] text-[#FF6E15]" />
                                        <span className="text-xs font-semibold text-gray-700">{rider.rating.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
