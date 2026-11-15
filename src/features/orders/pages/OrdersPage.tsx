import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Download, Calendar } from 'lucide-react'
import OrderDetailModal from '../components/OrderDetailModal'
import { orderStatusLabel } from '../../../lib/parcelAssignment'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'
import {
    deliveryTimeTone,
    formatDuration,
    formatTime,
    getOrderTimings,
} from '../../../lib/orderTimings'

type Order = Database['public']['Tables']['orders']['Row'] & {
    customer: { full_name: string; phone_number: string } | null
    restaurant: { name: string; address: string } | null
    rider: { full_name: string; phone_number: string } | null
    order_items: {
        name: string | null
        quantity: number | null
        price_at_order: number | null
    }[] | null
}

type OrderStatus = Database['public']['Enums']['order_status']
type DeliveryKind = Order['delivery_kind']
type StatusFilter = OrderStatus | 'all' | 'awaiting_admin'

export default function OrdersPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const linkedOrderId = searchParams.get('orderId')
    const openedLinkedOrder = useRef<string | null>(null)
    const [orders, setOrders] = useState<Order[]>([])
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalOrders, setTotalOrders] = useState(0)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [monthFilter, setMonthFilter] = useState<number | 'all'>('all')
    const [kindFilter, setKindFilter] = useState<DeliveryKind | 'all'>('all')

    // Stats
    const [stats, setStats] = useState({
        totalOrders: 0,
        activeOrders: 0,
        totalRevenue: 0,
        deliveriesToday: 0
    })

    const itemsPerPage = 10

    useEffect(() => {
        fetchOrders()
        fetchStats()

        const channel = supabase
            .channel('orders-page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders()
                fetchStats()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentPage, statusFilter, monthFilter, kindFilter, linkedOrderId])

    const fetchStats = async () => {
        try {
            // Total orders
            const { count: total } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })

            // Active orders (not delivered or cancelled)
            const { count: active } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .not('status', 'in', '(delivered,cancelled)')

            // Total revenue (sum of all delivered orders)
            const { data: revenueData } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'delivered')

            const totalRevenue = revenueData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

            // Deliveries today
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const { count: deliveriesToday } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'delivered')
                .gte('updated_at', today.toISOString())

            setStats({
                totalOrders: total || 0,
                activeOrders: active || 0,
                totalRevenue,
                deliveriesToday: deliveriesToday || 0
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchOrders = async () => {
        setLoading(true)
        try {
            let query: any = supabase
                .from('orders')
                .select(`
                    *,
                    customer:profiles!orders_customer_id_fkey(full_name, phone_number),
                    restaurant:restaurants(name, address),
                    rider:profiles!orders_rider_id_fkey(full_name, phone_number),
                    order_items(name, quantity, price_at_order)
                `, { count: 'exact' })
                .order('created_at', { ascending: false })

            if (linkedOrderId) query = query.eq('id', linkedOrderId)
            else openedLinkedOrder.current = null

            // Apply status filter
            if (statusFilter === 'awaiting_admin') {
                query = query.eq('delivery_kind', 'parcel')
                    .eq('payment_status', 'paid')
                    .eq('status', 'ready_for_pickup')
                    .is('rider_id', null)
            } else if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            // Parcels (the courier/logistics service) are rows in this same
            // table with delivery_kind = 'parcel' and no restaurant.
            if (kindFilter !== 'all' && statusFilter !== 'awaiting_admin') {
                query = query.eq('delivery_kind', kindFilter)
            }

            // Apply month filter
            if (monthFilter !== 'all') {
                const year = new Date().getFullYear()
                const startDate = new Date(year, monthFilter, 1)
                const endDate = new Date(year, monthFilter + 1, 0)
                query = query.gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())
            }

            // Pagination
            const from = (currentPage - 1) * itemsPerPage
            const to = from + itemsPerPage - 1
            query = query.range(from, to)

            const { data, error, count } = await query

            if (error) {
                console.error('Error fetching orders:', error)
            } else {
                const rows = (data as unknown as Order[]) || []
                setOrders(rows)
                setTotalOrders(count || 0)
                if (linkedOrderId && openedLinkedOrder.current !== linkedOrderId && rows[0]) {
                    openedLinkedOrder.current = linkedOrderId
                    setSelectedOrder(rows[0])
                    setModalOpen(true)
                }

                // Keep the open modal honest. Without this, releasing a rider
                // refreshes the table underneath while the detail panel still
                // offers actions against the old status.
                setSelectedOrder((current) =>
                    current ? rows.find((row) => row.id === current.id) ?? current : current,
                )
            }
        } catch (error) {
            console.error('Error fetching orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order)
        setModalOpen(true)
    }

    const handleApplyFilters = () => {
        setCurrentPage(1)
        fetchOrders()
    }

    const handleClearFilters = () => {
        setStatusFilter('all')
        setMonthFilter('all')
        setKindFilter('all')
        setCurrentPage(1)
    }

    const getStatusColor = (status: OrderStatus) => {
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            weekday: 'short'
        })
    }

    const getOrderItemsSummary = (order: Order) => {
        // A parcel has no order_items at all, so the contents line falls back
        // to what the sender described plus the size band.
        if (order.delivery_kind === 'parcel') {
            const size = order.parcel_size ? ` (${order.parcel_size})` : ''
            return `${order.parcel_description || 'Parcel'}${size}`
        }

        const items = order.order_items || []
        if (items.length === 0) return 'No items'

        const summary = items
            .slice(0, 2)
            .map((item) => `${item.quantity || 1}x ${item.name || 'Item'}`)
            .join(', ')

        return items.length > 2 ? `${summary}, +${items.length - 2} more` : summary
    }

    // Only a delivered order has a finished time. Anything else would be a
    // running clock, which the stalled-delivery watchdog already covers.
    const renderDeliveryTime = (order: Order) => {
        if (order.status !== 'delivered') {
            return <span className="text-gray-400">—</span>
        }
        const { riderTime, toPickup, onTheRoad } = getOrderTimings(order)
        const breakdown = toPickup !== null && onTheRoad !== null
            ? `${formatDuration(toPickup)} to pickup, ${formatDuration(onTheRoad)} on the road`
            : undefined
        return (
            <span className={`font-medium ${deliveryTimeTone(riderTime)}`} title={breakdown}>
                {formatDuration(riderTime)}
            </span>
        )
    }

    const totalPages = Math.ceil(totalOrders / itemsPerPage)

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
                        <p className="text-gray-500 text-sm">View and manage all customer orders</p>
                    </div>
                    <Button className="w-full sm:w-auto gap-2" size="default">
                        <Download className="h-4 w-4" />
                        Export orders ({totalOrders})
                    </Button>
                </div>

                {linkedOrderId && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-orange-50 p-3 text-sm"><span>Showing the delivery booking from your quotation.</span><button className="font-medium text-orange-700" onClick={() => { setSearchParams({}); handleClearFilters() }}>View all orders</button></div>}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total Orders</span>
                                <Calendar className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.totalOrders.toLocaleString()}
                            </h2>
                            <p className="text-sm text-green-600">All time</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Active Orders</span>
                                <Calendar className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.activeOrders}
                            </h2>
                            <p className="text-sm text-gray-400">In progress</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total Revenue (₦)</span>
                                <Calendar className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {(stats.totalRevenue / 1000).toFixed(1)}K
                            </h2>
                            <p className="text-sm text-green-600">From delivered orders</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Deliveries Today</span>
                                <Calendar className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.deliveriesToday}
                            </h2>
                            <p className="text-sm text-green-600">Completed today</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-end gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Type</span>
                        <select
                            value={kindFilter}
                            onChange={(e) => {
                                setCurrentPage(1)
                                setKindFilter(e.target.value as DeliveryKind | 'all')
                                if (statusFilter === 'awaiting_admin') setStatusFilter('all')
                            }}
                            className="h-[40px] px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full sm:w-[120px]"
                        >
                            <option value="all">All types</option>
                            <option value="food">Food</option>
                            <option value="parcel">Parcel</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Status</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setCurrentPage(1)
                                setStatusFilter(e.target.value as StatusFilter)
                                if (e.target.value === 'awaiting_admin') setKindFilter('parcel')
                            }}
                            className="h-[40px] px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full sm:w-[140px]"
                        >
                            <option value="all">All Status</option>
                            <option value="awaiting_admin">Parcels awaiting assignment</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="preparing">Preparing</option>
                            <option value="ready_for_pickup">Ready</option>
                            <option value="picked_up">Picked Up</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-sm text-gray-500 whitespace-nowrap">Month</span>
                        <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="h-[40px] px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full sm:w-[100px]"
                        >
                            <option value="all">All</option>
                            <option value="0">Jan</option>
                            <option value="1">Feb</option>
                            <option value="2">Mar</option>
                            <option value="3">Apr</option>
                            <option value="4">May</option>
                            <option value="5">Jun</option>
                            <option value="6">Jul</option>
                            <option value="7">Aug</option>
                            <option value="8">Sep</option>
                            <option value="9">Oct</option>
                            <option value="10">Nov</option>
                            <option value="11">Dec</option>
                        </select>
                    </div>
                    <Button onClick={handleApplyFilters} size="default" className="w-full sm:w-auto">Apply</Button>
                    <Button onClick={handleClearFilters} variant="outline" size="default" className="w-full sm:w-auto">Clear filters</Button>
                </div>

                {/* Orders Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-gray-500">Loading orders...</div>
                        ) : orders.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">No orders found.</div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-gray-100 bg-white">
                                            <tr>
                                                <th className="px-4 py-4 font-medium text-gray-500">Order ID</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Customer</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Restaurant</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Items</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Amount (₦)</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Status</th>
                                                <th className="px-4 py-4 font-medium text-gray-500">Placed</th>
                                                <th
                                                    className="px-4 py-4 font-medium text-gray-500 whitespace-nowrap"
                                                    title="From the rider accepting the order to handing it over. Excludes payment and kitchen time."
                                                >
                                                    Delivery time
                                                </th>
                                                <th className="px-4 py-4 font-medium text-gray-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.map((order) => (
                                                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="px-4 py-4 font-medium text-gray-900">
                                                        {order.order_number || order.id.slice(0, 8)}
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {order.customer?.full_name || 'Unknown'}
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {order.delivery_kind === 'parcel' ? (
                                                            <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                                                                Parcel
                                                            </span>
                                                        ) : (
                                                            order.restaurant?.name || 'Unknown'
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600 max-w-[280px]">
                                                        <span className="line-clamp-2">{getOrderItemsSummary(order)}</span>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600">
                                                        {order.total_amount?.toLocaleString() || '0'}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                                                            {orderStatusLabel(order)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                                                        <p>{formatDate(order.created_at)}</p>
                                                        <p className="text-xs text-gray-400">{formatTime(order.created_at)}</p>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        {renderDeliveryTime(order)}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            onClick={() => handleViewOrder(order)}
                                                            className="text-sm font-medium text-[#FF6E15] hover:underline"
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {orders.map((order) => (
                                        <div key={order.id} className="p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-gray-900">
                                                    {order.order_number || order.id.slice(0, 8)}
                                                </span>
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                                                    {orderStatusLabel(order)}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                <p>
                                                    {order.customer?.full_name || 'Unknown'} • {order.delivery_kind === 'parcel'
                                                        ? 'Parcel'
                                                        : order.restaurant?.name || 'Unknown'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{getOrderItemsSummary(order)}</p>
                                                <p className="font-medium text-gray-900">₦{order.total_amount?.toLocaleString() || '0'}</p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-400">
                                                    {formatDate(order.created_at)}, {formatTime(order.created_at)}
                                                    {order.status === 'delivered' && (
                                                        <> • Delivered in {renderDeliveryTime(order)}</>
                                                    )}
                                                </span>
                                                <button
                                                    onClick={() => handleViewOrder(order)}
                                                    className="text-sm font-medium text-[#FF6E15]"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalOrders)} of {totalOrders}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-3"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            Previous
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(3, totalPages) }, (_, i) => i + 1).map((page) => (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`h-8 w-8 flex items-center justify-center rounded-[6px] text-sm transition-colors ${currentPage === page
                                                        ? 'bg-[#FF6E15] text-white'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                            {totalPages > 3 && <span className="text-gray-400 px-1">...</span>}
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-8 px-3"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onChanged={() => {
                    fetchOrders()
                    fetchStats()
                }}
                intervention={selectedOrder ? {
                    id: selectedOrder.id,
                    label: selectedOrder.order_number || selectedOrder.id.slice(0, 8),
                    status: selectedOrder.status,
                    riderId: selectedOrder.rider_id,
                    riderName: selectedOrder.rider?.full_name ?? null,
                    riderPhone: selectedOrder.rider?.phone_number ?? null,
                    acceptedAt: selectedOrder.accepted_at,
                    pickedUpAt: selectedOrder.picked_up_at,
                    paymentStatus: selectedOrder.payment_status,
                    deliveryKind: selectedOrder.delivery_kind,
                } : undefined}
                order={selectedOrder ? {
                    id: selectedOrder.order_number || selectedOrder.id.slice(0, 8),
                    kind: selectedOrder.delivery_kind,
                    status: orderStatusLabel(selectedOrder),
                    date: formatDate(selectedOrder.created_at),
                    notes: selectedOrder.special_instructions,
                    parcel: selectedOrder.delivery_kind === 'parcel' ? {
                        description: selectedOrder.parcel_description,
                        size: selectedOrder.parcel_size,
                        pickupContactName: selectedOrder.pickup_contact_name,
                        pickupContactPhone: selectedOrder.pickup_contact_phone,
                        recipientName: selectedOrder.recipient_name,
                        recipientPhone: selectedOrder.recipient_phone,
                    } : null,
                    milestones: {
                        created_at: selectedOrder.created_at,
                        accepted_at: selectedOrder.accepted_at,
                        picked_up_at: selectedOrder.picked_up_at,
                        delivered_at: selectedOrder.delivered_at,
                    },
                    items: (selectedOrder.order_items || []).map((item) => ({
                        name: item.name || 'Item',
                        quantity: item.quantity || 1,
                        price: `₦${(item.price_at_order || 0).toLocaleString()}`
                    })),
                    restaurant: selectedOrder.delivery_kind === 'parcel'
                        ? 'Parcel delivery'
                        : selectedOrder.restaurant?.name || 'Unknown',
                    total: `₦${selectedOrder.total_amount?.toLocaleString() || '0'}`,
                    customer: {
                        name: selectedOrder.customer?.full_name || 'Unknown',
                        phone: selectedOrder.customer?.phone_number || 'N/A',
                        // A parcel's delivery_address is the recipient's, not
                        // the sender's, so it only appears under Delivery.
                        address: selectedOrder.delivery_kind === 'parcel'
                            ? null
                            : selectedOrder.delivery_address || 'N/A'
                    },
                    delivery: {
                        // pickup_address is populated for both kinds — the
                        // database snapshots the restaurant's address onto food
                        // orders — so prefer it and keep the join as fallback
                        // for rows created before 20260925120000.
                        pickup: selectedOrder.pickup_address
                            || selectedOrder.restaurant?.address
                            || 'N/A',
                        destination: selectedOrder.delivery_address || 'N/A'
                    },
                    rider: {
                        name: selectedOrder.rider?.full_name || 'Not assigned',
                        phone: selectedOrder.rider?.phone_number || 'N/A'
                    }
                } : null}
            />
        </MainLayout>
    )
}
