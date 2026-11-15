import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'
import { formatDistanceToNow } from 'date-fns'

type Order = Database['public']['Tables']['orders']['Row'] & {
    customer: { full_name: string } | null
    restaurant: { name: string } | null
}

export default function RecentOrders() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRecentOrders()

        const channel = supabase
            .channel('recent-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchRecentOrders()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchRecentOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    customer:profiles!orders_customer_id_fkey(full_name),
                    restaurant:restaurants(name)
                `)
                .order('created_at', { ascending: false })
                .limit(5)

            if (error) {
                console.error('Error fetching recent orders:', error)
            } else {
                setOrders(data as Order[] || [])
            }
        } catch (error) {
            console.error('Error fetching recent orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'delivered':
                return 'bg-green-100 text-green-700'
            case 'cancelled':
                return 'bg-red-100 text-red-700'
            case 'picked_up':
            case 'ready_for_pickup':
                return 'bg-orange-100 text-orange-700'
            case 'preparing':
            case 'confirmed':
                return 'bg-blue-100 text-blue-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const formatStatus = (status: string) => {
        return status.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
    }

    return (
        <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle className="text-lg font-bold text-gray-900">Recent Orders</CardTitle>
                    <p className="text-sm text-gray-400 font-normal mt-0.5">Latest 5 orders</p>
                </div>
                <button className="text-sm font-semibold text-[#FF6E15] hover:underline">
                    View All
                </button>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="px-6 py-4 space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-2.5 w-20 bg-gray-100 rounded animate-pulse" />
                                <div className="h-2.5 w-28 bg-gray-100 rounded animate-pulse" />
                                <div className="h-2.5 w-24 bg-gray-100 rounded animate-pulse" />
                                <div className="h-2.5 w-16 bg-gray-100 rounded animate-pulse ml-auto" />
                            </div>
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-10 text-center text-gray-400 text-sm">No orders found.</div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Order ID</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Restaurant</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Amount (₦)</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">
                                            #{order.order_number || order.id.slice(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                                            {order.customer?.full_name || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {order.restaurant?.name || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                            ₦{order.total_amount?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}>
                                                {formatStatus(order.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-xs font-semibold text-[#FF6E15] hover:text-[#e55c0a] transition-colors">
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
