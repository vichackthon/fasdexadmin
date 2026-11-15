import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Ticket, Plus, Star, BarChart3 } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'

type EventRow = {
    id: string
    title: string
    category: string | null
    poster_url: string | null
    venue_name: string | null
    city: string | null
    timezone: string
    starts_at: string
    status: string
    is_featured: boolean
    capacity: number | null
    event_ticket_tiers: { price: number; quantity_total: number | null; quantity_sold: number }[] | null
}

const STATUS_STYLES: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-700',
    archived: 'bg-gray-100 text-gray-400',
}

// Events are stored as UTC and carry their own IANA zone. Rendering one in
// the admin's browser zone would show a Lagos 4pm kickoff as 3pm to anyone
// abroad -- exactly the bug the customer app avoids.
const fmtEventDate = (iso: string, timezone: string) => {
    try {
        return new Date(iso).toLocaleString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: timezone,
        })
    } catch {
        // Unknown zone name -- fall back rather than crash the row.
        return new Date(iso).toLocaleString('en-NG')
    }
}

const fmtMoney = (value: number) => `₦${value.toLocaleString('en-NG')}`

export default function EventsPage() {
    const navigate = useNavigate()
    const [rows, setRows] = useState<EventRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<string>('all')

    useEffect(() => {
        void loadEvents()
    }, [])

    const loadEvents = async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: dbError } = await supabase
                .from('events')
                .select('*, event_ticket_tiers(price, quantity_total, quantity_sold)')
                .order('starts_at', { ascending: false })

            if (dbError) throw dbError

            setRows((data ?? []) as EventRow[])
        } catch (err) {
            console.error('Error loading events:', err)
            setError('Could not load events. Check that the event ticketing migration has been applied.')
        } finally {
            setLoading(false)
        }
    }

    const visibleRows = statusFilter === 'all' ? rows : rows.filter(row => row.status === statusFilter)

    const publishedCount = rows.filter(row => row.status === 'published').length
    const upcomingCount = rows.filter(
        row => row.status === 'published' && new Date(row.starts_at) > new Date()
    ).length
    const ticketsSold = rows.reduce(
        (total, row) =>
            total + (row.event_ticket_tiers ?? []).reduce((sum, tier) => sum + (tier.quantity_sold ?? 0), 0),
        0
    )

    const tierSummary = (tiers: EventRow['event_ticket_tiers']) => {
        if (!tiers || tiers.length === 0) return { label: 'No tiers', sold: 0 }
        const prices = tiers.map(tier => tier.price)
        const min = Math.min(...prices)
        const sold = tiers.reduce((sum, tier) => sum + (tier.quantity_sold ?? 0), 0)
        return { label: min <= 0 ? 'Free' : `From ${fmtMoney(min)}`, sold }
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Ticketed events shown in the customer app. Published events appear immediately.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/events/new')}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#FF6E15] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#e56212] transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        New event
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-orange-100 p-3">
                                <CalendarDays className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Published</p>
                                <p className="text-2xl font-bold text-gray-900">{publishedCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-blue-100 p-3">
                                <Star className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Upcoming</p>
                                <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-green-100 p-3">
                                <Ticket className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Tickets claimed</p>
                                <p className="text-2xl font-bold text-gray-900">{ticketsSold}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Status filter */}
                <div className="flex flex-wrap gap-2">
                    {['all', 'published', 'draft', 'cancelled', 'archived'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={
                                statusFilter === status
                                    ? 'rounded-full bg-[#FF6E15] px-4 py-1.5 text-xs font-semibold text-white capitalize'
                                    : 'rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-600 capitalize hover:bg-gray-200'
                            }
                        >
                            {status}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                                Loading events...
                            </div>
                        ) : visibleRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <CalendarDays className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-400">
                                    {rows.length === 0 ? 'No events yet.' : 'No events with this status.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400 tracking-wider">
                                            <th className="px-6 py-4">Event</th>
                                            <th className="px-6 py-4">When</th>
                                            <th className="px-6 py-4">Where</th>
                                            <th className="px-6 py-4">Tickets</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {visibleRows.map(row => {
                                            const tiers = tierSummary(row.event_ticket_tiers)
                                            return (
                                                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {row.poster_url ? (
                                                                <img
                                                                    src={row.poster_url}
                                                                    alt=""
                                                                    className="h-10 w-16 rounded object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="h-10 w-16 rounded bg-gray-100 flex-shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-gray-900 truncate max-w-[200px]">
                                                                    {row.title}
                                                                </p>
                                                                <p className="text-xs text-gray-400">
                                                                    {row.is_featured ? 'Featured' : row.category ?? '—'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                                                        {fmtEventDate(row.starts_at, row.timezone)}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 truncate max-w-[180px]">
                                                        {row.venue_name ?? row.city ?? '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                                                        <p>{tiers.label}</p>
                                                        <p className="text-xs text-gray-400">{tiers.sold} claimed</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                                                                STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-600'
                                                            }`}
                                                        >
                                                            {row.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => navigate(`/events/${row.id}`)}
                                                                className="text-sm font-medium text-[#FF6E15] hover:underline"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => navigate(`/events/${row.id}/sales`)}
                                                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700"
                                                            >
                                                                <BarChart3 className="h-4 w-4" />
                                                                Sales
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
