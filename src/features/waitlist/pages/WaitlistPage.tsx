import { useEffect, useState } from 'react'
import { Users, MapPin, Hourglass } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'

type WaitlistRow = {
    id: string
    city: string | null
    address: string | null
    latitude: number
    longitude: number
    distance_km: number | null
    full_name: string | null
    phone: string | null
    email: string | null
    created_at: string
}

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

const fmtKm = (km: number | null) => (km != null ? `${km.toFixed(1)} km` : '—')

export default function WaitlistPage() {
    const [rows, setRows] = useState<WaitlistRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        void loadWaitlist()
    }, [])

    const loadWaitlist = async () => {
        setLoading(true)
        setError(null)

        try {
            const { data, error: dbError } = await supabase
                .from('city_waitlist')
                .select('*')
                .order('created_at', { ascending: false })

            if (dbError) throw dbError

            setRows((data ?? []) as WaitlistRow[])
        } catch (err) {
            console.error('Error loading waitlist:', err)
            setError('Could not load waitlist data. Check database permissions.')
        } finally {
            setLoading(false)
        }
    }

    const cityCounts = rows.reduce<Record<string, number>>((acc, row) => {
        const city = row.city?.trim() || 'Unknown'
        acc[city] = (acc[city] ?? 0) + 1
        return acc
    }, {})

    const topCityEntry = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0]
    const topCity = topCityEntry?.[0] ?? '—'
    const topCityCount = topCityEntry?.[1] ?? 0

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Customers outside Calabar who want Fasdex in their city.
                    </p>
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
                                <Hourglass className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Total signups</p>
                                <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-blue-100 p-3">
                                <MapPin className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Top city</p>
                                <p className="text-2xl font-bold text-gray-900 truncate max-w-[160px]">{topCity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5 flex items-center gap-4">
                            <div className="rounded-full bg-green-100 p-3">
                                <Users className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Signups in top city</p>
                                <p className="text-2xl font-bold text-gray-900">{topCityCount}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                                Loading waitlist...
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2">
                                <Hourglass className="h-8 w-8 text-gray-300" />
                                <p className="text-sm text-gray-400">No waitlist signups yet.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400 tracking-wider">
                                            <th className="px-6 py-4">Name</th>
                                            <th className="px-6 py-4">Phone</th>
                                            <th className="px-6 py-4">City</th>
                                            <th className="px-6 py-4">Address</th>
                                            <th className="px-6 py-4">Distance from hub</th>
                                            <th className="px-6 py-4">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {rows.map(row => (
                                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium text-gray-900 truncate max-w-[140px]">
                                                        {row.full_name ?? '—'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[140px]">
                                                        {row.email ?? ''}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                                                    {row.phone ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-700">{row.city ?? '—'}</td>
                                                <td className="px-6 py-4 text-gray-500 truncate max-w-[220px]">
                                                    {row.address ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                                                    {fmtKm(row.distance_km)}
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
