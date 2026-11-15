import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ticket, Banknote, Users, Download } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'

type TicketRow = {
    id: string
    ticket_code: string
    status: string
    price_paid: number
    attendee_name: string | null
    created_at: string
    event_ticket_tiers: { name: string } | null
    event_ticket_orders: { reference: string; customer_email: string | null; customer_phone: string | null } | null
}

type TierRow = {
    id: string
    name: string
    price: number
    quantity_total: number | null
    quantity_sold: number
}

const fmtMoney = (value: number) => `₦${value.toLocaleString('en-NG')}`

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

export default function EventSalesPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()

    const [title, setTitle] = useState('')
    const [tickets, setTickets] = useState<TicketRow[]>([])
    const [tiers, setTiers] = useState<TierRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        void loadSales()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const loadSales = async () => {
        if (!id) {
            setError('No event selected.')
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const [eventResult, ticketResult, tierResult] = await Promise.all([
                supabase.from('events').select('title').eq('id', id).single(),
                supabase
                    .from('event_tickets')
                    .select(
                        '*, event_ticket_tiers(name), event_ticket_orders(reference, customer_email, customer_phone)'
                    )
                    .eq('event_id', id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('event_ticket_tiers')
                    .select('id, name, price, quantity_total, quantity_sold')
                    .eq('event_id', id)
                    .order('sort_order', { ascending: true }),
            ])

            if (eventResult.error) throw eventResult.error
            if (ticketResult.error) throw ticketResult.error
            if (tierResult.error) throw tierResult.error

            setTitle(eventResult.data.title ?? '')
            setTickets((ticketResult.data ?? []) as TicketRow[])
            setTiers((tierResult.data ?? []) as TierRow[])
        } catch (err) {
            console.error('Error loading event sales:', err)
            setError('Could not load sales for this event.')
        } finally {
            setLoading(false)
        }
    }

    // Issued tickets only — event_tickets rows exist only after payment
    // clears, so this is real revenue, not attempted checkouts.
    const revenue = tickets
        .filter(row => row.status !== 'refunded')
        .reduce((sum, row) => sum + Number(row.price_paid ?? 0), 0)

    const attendees = new Set(
        tickets.map(row => row.event_ticket_orders?.customer_email ?? row.id)
    ).size

    const exportCsv = () => {
        const header = ['Ticket code', 'Type', 'Attendee', 'Email', 'Phone', 'Paid', 'Status', 'Issued']
        const lines = tickets.map(row =>
            [
                row.ticket_code,
                row.event_ticket_tiers?.name ?? '',
                row.attendee_name ?? '',
                row.event_ticket_orders?.customer_email ?? '',
                row.event_ticket_orders?.customer_phone ?? '',
                row.price_paid,
                row.status,
                row.created_at,
            ]
                // Quote every field: venue names and emails can contain commas.
                .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
                .join(',')
        )

        const blob = new Blob([[header.join(','), ...lines].join('\n')], {
            type: 'text/csv;charset=utf-8;',
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `event-tickets-${id}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/events')}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
                            <p className="text-gray-500 text-sm mt-1">{title || 'Event'}</p>
                        </div>
                    </div>
                    {tickets.length > 0 && (
                        <button
                            onClick={exportCsv}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                            <Download className="h-4 w-4" />
                            Export CSV
                        </button>
                    )}
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-orange-100 p-3">
                                <Ticket className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Tickets issued</p>
                                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-green-100 p-3">
                                <Banknote className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Revenue</p>
                                <p className="text-2xl font-bold text-gray-900">{fmtMoney(revenue)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-blue-100 p-3">
                                <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Buyers</p>
                                <p className="text-2xl font-bold text-gray-900">{attendees}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Per-tier stock */}
                {tiers.length > 0 && (
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6">
                            <h2 className="text-sm font-semibold text-gray-900 mb-4">By ticket type</h2>
                            <div className="space-y-3">
                                {tiers.map(tier => {
                                    const total = tier.quantity_total
                                    const pct = total ? Math.min((tier.quantity_sold / total) * 100, 100) : 0
                                    return (
                                        <div key={tier.id}>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-gray-900">{tier.name}</span>
                                                <span className="text-gray-500">
                                                    {tier.quantity_sold}
                                                    {total != null ? ` / ${total}` : ' claimed'} ·{' '}
                                                    {tier.price <= 0 ? 'Free' : fmtMoney(tier.price)}
                                                </span>
                                            </div>
                                            {total != null && (
                                                <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100">
                                                    <div
                                                        className="h-2 rounded-full bg-[#FF6E15]"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            <p className="mt-4 text-xs text-gray-400">
                                Counts include tickets currently held by an unpaid checkout. Abandoned holds are
                                released automatically.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Attendees */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                                Loading sales...
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Ticket className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-400">No tickets issued yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400 tracking-wider">
                                            <th className="px-6 py-4">Ticket code</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4">Attendee</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4">Paid</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Issued</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {tickets.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-gray-700 whitespace-nowrap">
                                                    {row.ticket_code}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700">
                                                    {row.event_ticket_tiers?.name ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-900 truncate max-w-[160px]">
                                                    {row.attendee_name ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    <p className="truncate max-w-[180px]">
                                                        {row.event_ticket_orders?.customer_email ?? '—'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {row.event_ticket_orders?.customer_phone ?? ''}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                                                    {Number(row.price_paid) <= 0
                                                        ? 'Free'
                                                        : fmtMoney(Number(row.price_paid))}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600">
                                                        {row.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {fmtDate(row.created_at)}
                                                </td>
                                            </tr>
                                        ))}
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
