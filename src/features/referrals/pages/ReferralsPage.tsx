import { useEffect, useState } from 'react'
import { Gift, Users, CheckCircle, Clock } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'

type ReferralStatus = 'pending' | 'rewarded' | 'expired'

type ReferralRow = {
    id: string
    status: ReferralStatus
    referrer_reward: number | null
    referee_bonus: number | null
    created_at: string
    rewarded_at: string | null
    referrer: { full_name: string | null; email: string | null; referral_code: string } | null
    referred: { full_name: string | null; email: string | null } | null
}

type Stats = {
    total: number
    rewarded: number
    pending: number
    totalPaidOut: number
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
    pending: 'Pending',
    rewarded: 'Rewarded',
    expired: 'Expired',
}

const STATUS_STYLES: Record<ReferralStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    rewarded: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-500',
}

const fmt = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ReferralsPage() {
    const [referrals, setReferrals] = useState<ReferralRow[]>([])
    const [stats, setStats] = useState<Stats>({ total: 0, rewarded: 0, pending: 0, totalPaidOut: 0 })
    const [filter, setFilter] = useState<ReferralStatus | 'all'>('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        void loadReferrals()
    }, [])

    const loadReferrals = async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: dbError } = await supabase
                .from('referrals')
                .select(`
                    id,
                    status,
                    referrer_reward,
                    referee_bonus,
                    created_at,
                    rewarded_at,
                    referrer:referrer_id ( full_name, email, referral_code ),
                    referred:referred_id ( full_name, email )
                `)
                .order('created_at', { ascending: false })

            if (dbError) throw dbError

            const rows = (data ?? []) as unknown as ReferralRow[]
            setReferrals(rows)

            const rewarded = rows.filter(r => r.status === 'rewarded')
            const totalPaidOut = rewarded.reduce(
                (sum, r) => sum + (r.referrer_reward ?? 0) + (r.referee_bonus ?? 0),
                0
            )
            setStats({
                total: rows.length,
                rewarded: rewarded.length,
                pending: rows.filter(r => r.status === 'pending').length,
                totalPaidOut,
            })
        } catch (err) {
            console.error('Error loading referrals:', err)
            setError('Could not load referral data. Check database permissions.')
        } finally {
            setLoading(false)
        }
    }

    const visible = filter === 'all' ? referrals : referrals.filter(r => r.status === filter)

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
                    <p className="text-gray-500 text-sm mt-1">Track customer referrals and wallet credit payouts.</p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-orange-100 p-3">
                                <Users className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total referrals</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-green-100 p-3">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Rewarded</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.rewarded}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-yellow-100 p-3">
                                <Clock className="h-5 w-5 text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Pending</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-orange-100 p-3">
                                <Gift className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total paid out</p>
                                <p className="text-2xl font-bold text-gray-900">{fmt(stats.totalPaidOut)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter tabs */}
                <div className="bg-gray-50 rounded-lg p-1.5 inline-flex">
                    {(['all', 'pending', 'rewarded', 'expired'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-5 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                                filter === tab
                                    ? 'bg-[#FF6E15] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab === 'all' ? 'All' : STATUS_LABELS[tab]}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                                Loading referrals...
                            </div>
                        ) : visible.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Gift className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-400">No referrals found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400 tracking-wider">
                                            <th className="px-6 py-4">Referrer</th>
                                            <th className="px-6 py-4">Code</th>
                                            <th className="px-6 py-4">Referred user</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Referrer reward</th>
                                            <th className="px-6 py-4">Referee bonus</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Rewarded on</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {visible.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900 truncate max-w-[140px]">
                                                        {row.referrer?.full_name ?? '—'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[140px]">
                                                        {row.referrer?.email ?? ''}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                        {row.referrer?.referral_code ?? '—'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900 truncate max-w-[140px]">
                                                        {row.referred?.full_name ?? '—'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[140px]">
                                                        {row.referred?.email ?? ''}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>
                                                        {STATUS_LABELS[row.status]}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700">
                                                    {row.referrer_reward != null ? fmt(row.referrer_reward) : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700">
                                                    {row.referee_bonus != null ? fmt(row.referee_bonus) : '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {fmtDate(row.created_at)}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {row.rewarded_at ? fmtDate(row.rewarded_at) : '—'}
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
