import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Search, TrendingUp, Wallet, Store, Bike, RefreshCw } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { format } from 'date-fns'

interface RestaurantPayout {
    id: string
    name: string
    totalOrders: number
    totalRevenue: number
    pendingPayout: number
    lastPayoutDate: string | null
    nextPayoutDate: string
}

interface RiderRequest {
    id: string
    riderId: string
    name: string
    bankName: string
    amount: number
    accountNumber: string
    requestDate: string
    status: string
}

interface Transaction {
    id: string
    entityName: string
    bankName: string
    amount: number
    accountNumber: string
    date: string
    status: string
    sortDate: string
}

const getMerchantGrossAmount = (order: {
    subtotal?: number | null
    takeaway_pack_fee?: number | null
}) => {
    return (Number(order.subtotal) || 0) + (Number(order.takeaway_pack_fee) || 0)
}

export default function PaymentPage() {
    const [activeTab, setActiveTab] = useState<'riders' | 'restaurants'>('restaurants')
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    const [restaurantPayouts, setRestaurantPayouts] = useState<RestaurantPayout[]>([])
    const [riderRequests, setRiderRequests] = useState<RiderRequest[]>([])
    const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([])

    const [stats, setStats] = useState({
        pendingRiderWithdrawal: 0,
        pendingRestaurantPayouts: 0,
        totalPaidOut: 0,
        processedToday: 0
    })

    useEffect(() => {
        fetchData()

        // Real-time subscriptions for payments
        const payoutsChannel = supabase
            .channel('payments-payouts-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payouts' }, () => {
                fetchData()
                setLastUpdated(new Date())
            })
            .subscribe()

        const ordersChannel = supabase
            .channel('payments-orders-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchStats()
                if (activeTab === 'restaurants') {
                    fetchMainList()
                }
                setLastUpdated(new Date())
            })
            .subscribe()

        return () => {
            supabase.removeChannel(payoutsChannel)
            supabase.removeChannel(ordersChannel)
        }
    }, [])

    useEffect(() => {
        fetchMainList()
    }, [activeTab])

    const fetchData = async () => {
        setLoading(true)
        try {
            await Promise.all([
                fetchStats(),
                fetchMainList(),
                fetchTransactionHistory()
            ])
            setLastUpdated(new Date())
        } catch (error) {
            console.error('Error fetching payment data:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        // 1. Pending Rider Withdrawals (rider_payouts)
        const { data: riderPayouts } = await supabase
            .from('rider_payouts')
            .select('amount, status')
            .in('status', ['pending', 'processing'])

        const riderPendingTotal = (riderPayouts as any[])?.reduce(
            (sum: number, p: any) => sum + (Number(p.amount) || 0),
            0
        ) || 0

        // 2. Pending Restaurant Payouts (orders) — use per-restaurant commission rate
        const { data: orderPends } = await supabase
            .from('orders')
            .select('subtotal, takeaway_pack_fee, restaurant_id')
            .eq('status', 'delivered')
            .eq('payout_status', 'pending')

        const pendingRestaurantIds = Array.from(
            new Set(((orderPends as any[]) || []).map((o: any) => o.restaurant_id).filter(Boolean))
        )
        const { data: pendingRates } = pendingRestaurantIds.length > 0
            ? await supabase
                .from('restaurants')
                .select('id, commission_rate')
                .in('id', pendingRestaurantIds)
            : { data: [] }

        const rateMap = new Map(
            ((pendingRates as any[]) || []).map((r: any) => [r.id, Number(r.commission_rate) || 15])
        )

        const restaurantPendingTotal = ((orderPends as any[]) || []).reduce((sum: number, o: any) => {
            const rate = (rateMap.get(o.restaurant_id) ?? 15) / 100
            return sum + getMerchantGrossAmount(o) * (1 - rate)
        }, 0)

        // 3. Total Paid Out (restaurants + riders)
        const { data: paidRestaurant } = await supabase
            .from('payouts')
            .select('amount')
            .eq('status', 'paid')

        const { data: paidRiders } = await supabase
            .from('rider_payouts')
            .select('amount')
            .eq('status', 'paid')

        const totalPaidRestaurants = (paidRestaurant as any[])?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
        const totalPaidRiders = (paidRiders as any[])?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0
        const totalPaid = totalPaidRestaurants + totalPaidRiders

        // 4. Processed Today (use created_at for both tables)
        const today = new Date().toISOString().split('T')[0]
        const { data: todayRestaurantPaid } = await supabase
            .from('payouts')
            .select('amount')
            .eq('status', 'paid')
            .gte('created_at', today)

        const { data: todayRiderPaid } = await supabase
            .from('rider_payouts')
            .select('amount')
            .eq('status', 'paid')
            .gte('created_at', today)

        const processedTodayTotal =
            ((todayRestaurantPaid as any[])?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0) +
            ((todayRiderPaid as any[])?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0)

        setStats({
            pendingRiderWithdrawal: riderPendingTotal,
            pendingRestaurantPayouts: restaurantPendingTotal,
            totalPaidOut: totalPaid,
            processedToday: processedTodayTotal
        })
    }

    const fetchMainList = async () => {
        if (activeTab === 'restaurants') {
            const { data: restaurants } = await supabase
                .from('restaurants')
                .select(`
                    id, 
                    name, 
                    commission_rate,
                    orders(subtotal, takeaway_pack_fee, status, payout_status)
                `)

            const processed: RestaurantPayout[] = ((restaurants as any[]) || []).map((r: any) => {
                const pendingOrders = (r.orders as any[])?.filter(o => o.status === 'delivered' && o.payout_status === 'pending') || []
                const totalRevenue = pendingOrders.reduce((sum, o) => sum + getMerchantGrossAmount(o), 0)
                const rate = (Number(r.commission_rate) || 15) / 100

                return {
                    id: r.id,
                    name: r.name,
                    totalOrders: pendingOrders.length,
                    totalRevenue: totalRevenue,
                    pendingPayout: totalRevenue * (1 - rate),
                    lastPayoutDate: null,
                    nextPayoutDate: 'Every Monday'
                }
            }).filter(item => item.totalOrders > 0)

            setRestaurantPayouts(processed)
        } else {
            const { data: requests } = await supabase
                .from('rider_payouts')
                .select('id, rider_id, amount, status, created_at')
                .in('status', ['pending', 'processing'])
                .order('created_at', { ascending: false })

            const riderIds = Array.from(new Set(((requests as any[]) || []).map((r: any) => r.rider_id).filter(Boolean)))
            const { data: riders } = riderIds.length > 0
                ? await supabase
                    .from('profiles')
                    .select('id, full_name, bank_name, account_number')
                    .in('id', riderIds)
                : { data: [] }

            const riderMap = new Map(
                ((riders as any[]) || []).map((r: any) => [r.id, r])
            )

            const processed: RiderRequest[] = ((requests as any[]) || []).map((r: any) => {
                const rider = riderMap.get(r.rider_id) as any
                return {
                    id: r.id.slice(0, 8).toUpperCase(),
                    riderId: r.rider_id,
                    name: rider?.full_name || 'Unknown',
                    bankName: rider?.bank_name || 'N/A',
                    amount: Number(r.amount),
                    accountNumber: rider?.account_number || 'N/A',
                    requestDate: format(new Date(r.created_at), 'dd/MM/yyyy'),
                    status: r.status
                }
            })

            setRiderRequests(processed)
        }
    }

    const fetchTransactionHistory = async () => {
        const { data: restaurantPaid } = await supabase
            .from('payouts')
            .select('id, restaurant_id, amount, status, created_at')
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
            .limit(20)

        const { data: riderPaid } = await supabase
            .from('rider_payouts')
            .select('id, rider_id, amount, status, created_at')
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
            .limit(20)

        const restaurantIds = Array.from(new Set(((restaurantPaid as any[]) || []).map((r: any) => r.restaurant_id).filter(Boolean)))
        const riderIds = Array.from(new Set(((riderPaid as any[]) || []).map((r: any) => r.rider_id).filter(Boolean)))

        const { data: restaurants } = restaurantIds.length > 0
            ? await supabase
                .from('restaurants')
                .select('id, name, bank_name, account_number')
                .in('id', restaurantIds)
            : { data: [] }

        const { data: riders } = riderIds.length > 0
            ? await supabase
                .from('profiles')
                .select('id, full_name, bank_name, account_number')
                .in('id', riderIds)
            : { data: [] }

        const restaurantMap = new Map(((restaurants as any[]) || []).map((r: any) => [r.id, r]))
        const riderMap = new Map(((riders as any[]) || []).map((r: any) => [r.id, r]))

        const restaurantTx = ((restaurantPaid as any[]) || []).map((t: any) => {
            const restaurant = restaurantMap.get(t.restaurant_id) as any
            const createdAt = t.created_at ? new Date(t.created_at) : null
            return {
                id: t.id.slice(0, 8).toUpperCase(),
                entityName: restaurant?.name || 'Restaurant',
                bankName: restaurant?.bank_name || 'N/A',
                amount: Number(t.amount),
                accountNumber: restaurant?.account_number || 'N/A',
                date: createdAt ? format(createdAt, 'dd/MM/yyyy') : 'N/A',
                status: t.status || 'paid',
                sortDate: t.created_at ?? ''
            } as Transaction
        })

        const riderTx = ((riderPaid as any[]) || []).map((t: any) => {
            const rider = riderMap.get(t.rider_id) as any
            const createdAt = t.created_at ? new Date(t.created_at) : null
            return {
                id: t.id.slice(0, 8).toUpperCase(),
                entityName: rider?.full_name || 'Rider',
                bankName: rider?.bank_name || 'N/A',
                amount: Number(t.amount),
                accountNumber: rider?.account_number || 'N/A',
                date: createdAt ? format(createdAt, 'dd/MM/yyyy') : 'N/A',
                status: t.status || 'paid',
                sortDate: t.created_at ?? ''
            } as Transaction
        })

        const combined = [...restaurantTx, ...riderTx]
            .sort((a, b) => {
                const aDate = a.sortDate ? new Date(a.sortDate).getTime() : 0
                const bDate = b.sortDate ? new Date(b.sortDate).getTime() : 0
                return bDate - aDate
            })
            .slice(0, 20)

        setTransactionHistory(combined)
    }

    const handleProcessPayout = async (id: string, isRestaurant: boolean, riderId?: string) => {
        try {
            if (isRestaurant) {
                const payoutData = restaurantPayouts.find(r => r.id === id)
                if (!payoutData) return

                const { error: pError } = await supabase
                    .from('payouts')
                    .insert({
                        recipient_id: null,
                        restaurant_id: id,
                        amount: payoutData.pendingPayout,
                        status: 'paid',
                        processed_at: new Date().toISOString()
                    } as any)

                if (pError) throw pError

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ordersTable = supabase.from('orders') as any
                const { error: oError } = await ordersTable
                    .update({ payout_status: 'paid' })
                    .eq('restaurant_id', id)
                    .eq('status', 'delivered')
                    .eq('payout_status', 'pending')

                if (oError) throw oError

                alert('Restaurant payout processed successfully!')
            } else {
                if (!riderId) return
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const riderPayoutsTable = supabase.from('rider_payouts') as any
                const { error } = await riderPayoutsTable
                    .update({ status: 'paid' })
                    .eq('id', id)

                if (error) throw error

                // Mark rider orders as paid-out
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ordersTable = supabase.from('orders') as any
                await ordersTable
                    .update({ rider_payout_status: 'paid' })
                    .eq('rider_id', riderId)
                    .eq('status', 'delivered')
                    .in('rider_payout_status', ['pending', 'requested'])

                alert('Rider withdrawal approved and processed!')
            }

            await fetchData()
        } catch (error) {
            console.error('Error processing payout:', error)
            alert('Failed to process payout. Please try again.')
        }
    }

    const filteredRestaurants = restaurantPayouts.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredRiders = riderRequests.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Payment history</h1>
                        <p className="text-gray-500 text-sm">Manage rider withdrawals and restaurant payouts</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <RefreshCw className="h-3 w-3" />
                        <span>Live • Updated {format(lastUpdated, 'HH:mm:ss')}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Pending rider withdrawal</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <TrendingUp className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[24px] font-bold text-gray-900 mb-1">₦{stats.pendingRiderWithdrawal.toLocaleString()}</h2>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Pending Restaurant Payouts</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <Store className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[24px] font-bold text-gray-900 mb-1">₦{stats.pendingRestaurantPayouts.toLocaleString()}</h2>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total Paid Out</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <Wallet className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[24px] font-bold text-gray-900 mb-1">₦{stats.totalPaidOut.toLocaleString()}</h2>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Processed Today</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <Bike className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[24px] font-bold text-gray-900 mb-1">₦{stats.processedToday.toLocaleString()}</h2>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 p-1.5 rounded-lg">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('riders')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'riders'
                                ? 'bg-[#FF6E15] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Riders withdrawal
                        </button>
                        <button
                            onClick={() => setActiveTab('restaurants')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'restaurants'
                                ? 'bg-[#FF6E15] text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Restaurant payment
                        </button>
                    </div>
                    <div className="relative w-full md:w-[320px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder={activeTab === 'restaurants' ? "search for restaurant" : "search for request"}
                            className="h-10 pl-10 bg-white border-transparent focus:bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100 italic text-gray-400 text-sm">
                            {loading ? 'Refreshing data...' : `Live data — ${activeTab === 'restaurants' ? filteredRestaurants.length : filteredRiders.length} record(s) found`}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-gray-100 bg-white">
                                    <tr>
                                        {activeTab === 'restaurants' ? (
                                            <>
                                                <th className="px-6 py-4 font-medium text-gray-900">Restaurants</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Total orders</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Total earning (₦)</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Payout (₦)</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Next payout</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-6 py-4 font-medium text-gray-900">Request ID</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Name</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Bank name</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Amount (₦)</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Account number</th>
                                                <th className="px-6 py-4 font-medium text-gray-900">Request date</th>
                                            </>
                                        )}
                                        <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeTab === 'restaurants' ? (
                                        filteredRestaurants.length === 0 ? (
                                            <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No pending payouts</td></tr>
                                        ) : (
                                            filteredRestaurants.map(item => (
                                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="px-6 py-4 text-gray-900 font-medium">{item.name}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.totalOrders}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.totalRevenue.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-900 font-semibold">{Math.round(item.pendingPayout).toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.nextPayoutDate}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white"
                                                            onClick={() => handleProcessPayout(item.id, true)}
                                                        >
                                                            Process
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )
                                    ) : (
                                        filteredRiders.length === 0 ? (
                                            <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">No withdrawal requests</td></tr>
                                        ) : (
                                            filteredRiders.map(item => (
                                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="px-6 py-4 text-gray-900 font-medium">{item.id}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.name}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.bankName}</td>
                                                    <td className="px-6 py-4 text-gray-900 font-semibold">{item.amount.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.accountNumber}</td>
                                                    <td className="px-6 py-4 text-gray-500">{item.requestDate}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <Button
                                                            size="sm"
                                                            className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white"
                                                            onClick={() => handleProcessPayout(item.id, false, item.riderId)}
                                                        >
                                                            Approve
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        )
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Transaction history</h3>
                            <span className="text-xs text-gray-400">{transactionHistory.length} recent transactions</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-gray-100 bg-white">
                                    <tr>
                                        <th className="px-6 py-4 font-medium text-gray-900">Transaction ID</th>
                                        <th className="px-6 py-4 font-medium text-gray-900">Entity</th>
                                        <th className="px-6 py-4 font-medium text-gray-900">Bank details</th>
                                        <th className="px-6 py-4 font-medium text-gray-900">Amount (₦)</th>
                                        <th className="px-6 py-4 font-medium text-gray-900">Account number</th>
                                        <th className="px-6 py-4 font-medium text-gray-900">Date</th>
                                        <th className="px-6 py-4 font-medium text-gray-900 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactionHistory.length === 0 ? (
                                        <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">No transaction history</td></tr>
                                    ) : (
                                        transactionHistory.map((tx) => (
                                            <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-6 py-4 text-gray-900 font-medium">{tx.id}</td>
                                                <td className="px-6 py-4 text-gray-500">{tx.entityName}</td>
                                                <td className="px-6 py-4 text-gray-500">{tx.bankName}</td>
                                                <td className="px-6 py-4 text-gray-500">{tx.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-gray-500">{tx.accountNumber}</td>
                                                <td className="px-6 py-4 text-gray-500">{tx.date}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                                                        {tx.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
