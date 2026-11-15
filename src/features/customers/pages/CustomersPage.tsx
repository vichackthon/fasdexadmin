import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Users, ShoppingBag, Wallet, UserPlus, Search } from 'lucide-react'
import CustomerProfileModal from '../components/CustomerProfileModal'
import OrderHistoryModal from '../components/OrderHistoryModal'
import SuspendAccountModal from '../components/SuspendAccountModal'
import ConfirmDeleteModal from '../../../components/ui/ConfirmDeleteModal'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row'] & {
    orders: { count: number }[]
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Profile[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null)
    const [profileModalOpen, setProfileModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)
    const [suspendModalOpen, setSuspendModalOpen] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [searchQuery, setSearchQuery] = useState('')
    const [loading, setLoading] = useState(true)
    const [totalCustomers, setTotalCustomers] = useState(0)
    const [customerOrders, setCustomerOrders] = useState<any[]>([])
    const [loadingOrders, setLoadingOrders] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [customerToDelete, setCustomerToDelete] = useState<Profile | null>(null)
    const [deleting, setDeleting] = useState(false)

    const [stats, setStats] = useState({
        total: 0,
        newThisMonth: 0,
        totalOrders: 0,
        totalRevenue: 0
    })

    const itemsPerPage = 10

    useEffect(() => {
        fetchCustomers()
        fetchStats()

        // Real-time subscriptions - auto refresh when DB changes
        const profilesChannel = supabase
            .channel('customers-profiles-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchCustomers()
                fetchStats()
            })
            .subscribe()

        const ordersChannel = supabase
            .channel('customers-orders-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchStats()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(profilesChannel)
            supabase.removeChannel(ordersChannel)
        }
    }, [])

    useEffect(() => {
        fetchCustomers()
    }, [currentPage, searchQuery])

    const fetchStats = async () => {
        try {
            const { count: total } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'customer')

            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0, 0, 0, 0)

            const { count: newThisMonth } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'customer')
                .gte('created_at', startOfMonth.toISOString())

            const { count: totalOrders } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })

            const { data: revenueData } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'delivered') as { data: { total_amount: number }[] | null }

            const totalRevenue = revenueData?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0

            setStats({
                total: total || 0,
                newThisMonth: newThisMonth || 0,
                totalOrders: totalOrders || 0,
                totalRevenue
            })
        } catch (error) {
            console.error('Error fetching customer stats:', error)
        }
    }

    const fetchCustomers = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('profiles')
                .select('*, orders!orders_customer_id_fkey(count)', { count: 'exact' })
                .eq('role', 'customer')
                .order('created_at', { ascending: false })

            if (searchQuery) {
                query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%`)
            }

            const from = (currentPage - 1) * itemsPerPage
            const to = from + itemsPerPage - 1
            query = query.range(from, to)

            const { data, error, count } = await query
            if (error) throw error

            setCustomers(data as any[] || [])
            setTotalCustomers(count || 0)
        } catch (error) {
            console.error('Error fetching customers:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchCustomerOrders = async (customerId: string) => {
        setLoadingOrders(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    order_number,
                    status,
                    total_amount,
                    created_at,
                    restaurant:restaurants(name)
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setCustomerOrders(data || [])
        } catch (error) {
            console.error('Error fetching customer orders:', error)
            setCustomerOrders([])
        } finally {
            setLoadingOrders(false)
        }
    }

    const handleViewCustomer = (customer: Profile) => {
        setSelectedCustomer(customer)
        setProfileModalOpen(true)
    }

    const handleViewHistory = () => {
        setProfileModalOpen(false)
        if (selectedCustomer) {
            fetchCustomerOrders(selectedCustomer.id)
        }
        setHistoryModalOpen(true)
    }

    const handleViewOrderDetails = (orderId: string) => {
        console.log('View order details:', orderId)
    }

    const handleSuspendClick = () => {
        setProfileModalOpen(false)
        setSuspendModalOpen(true)
    }

    const handleConfirmSuspend = () => {
        setSuspendModalOpen(false)
        setSelectedCustomer(null)
    }

    const handleDeleteClick = (customer: Profile) => {
        setCustomerToDelete(customer)
        setDeleteModalOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!customerToDelete) return
        setDeleting(true)
        try {
            const cid = customerToDelete.id

            // 1. Get order IDs to clean up support tickets referencing them
            const { data: orderRows } = await supabase.from('orders').select('id').eq('customer_id', cid)
            const orderIds = (orderRows || []).map((o: any) => o.id)

            // 2. Delete support tickets referencing those orders
            if (orderIds.length > 0) {
                await supabase.from('support_tickets').delete().in('related_order_id', orderIds)
            }

            // 3. Delete support tickets filed by this customer
            await supabase.from('support_tickets').delete().eq('user_id', cid)

            // 4. Delete orders
            await supabase.from('orders').delete().eq('customer_id', cid)

            // 5. Delete notifications
            await supabase.from('notifications').delete().eq('user_id', cid)

            // 6. Delete profile
            const { error } = await supabase.from('profiles').delete().eq('id', cid)
            if (error) throw error

            setDeleteModalOpen(false)
            setCustomerToDelete(null)
            fetchCustomers()
            fetchStats()
        } catch (err: any) {
            console.error('Error deleting customer:', err)
            alert(`Failed to delete: ${err?.message || 'Unknown error'}`)
        } finally {
            setDeleting(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB')
    }

    const totalPages = Math.ceil(totalCustomers / itemsPerPage)

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Customer management</h1>
                    <p className="text-gray-500 text-sm">Manage and view customer information • Live data</p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total customers</span>
                                <Users className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.total.toLocaleString()}
                            </h2>
                            <p className="text-sm text-green-600">Registered</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total orders</span>
                                <ShoppingBag className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.totalOrders.toLocaleString()}
                            </h2>
                            <p className="text-sm text-gray-400">All time</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total revenue (₦)</span>
                                <Wallet className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {(stats.totalRevenue / 1000000).toFixed(1)}M
                            </h2>
                            <p className="text-sm text-green-600">Platform wide</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">New customers</span>
                                <UserPlus className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900 mb-1">
                                {stats.newThisMonth}
                            </h2>
                            <p className="text-sm text-green-600">This month</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative flex-1 w-full md:max-w-[400px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="search customer by name, phone number"
                            className="h-11 pl-10 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">List of Customers</h3>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-gray-500">Loading customers...</div>
                        ) : customers.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">No customers found.</div>
                        ) : (
                            <>
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-gray-100 bg-white">
                                            <tr>
                                                <th className="px-6 py-4 font-medium text-gray-500">Name</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Phone number</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Email</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Orders</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Joined</th>
                                                <th className="px-6 py-4 font-medium text-gray-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customers.map((customer) => (
                                                <tr key={customer.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-200">
                                                                <img
                                                                    src={customer.avatar_url || `https://ui-avatars.com/api/?name=${customer.full_name}`}
                                                                    alt={customer.full_name || 'Customer'}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            </div>
                                                            <span className="font-medium text-gray-900">{customer.full_name || 'Anonymous'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">{customer.phone_number || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-gray-600">{customer.email || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-gray-600">{customer.orders?.[0]?.count || 0}</td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                                                            Active
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">{formatDate(customer.created_at)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button
                                                                onClick={() => handleViewCustomer(customer)}
                                                                className="text-sm font-medium text-[#FF6E15] hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(customer)}
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

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalCustomers)} of {totalCustomers}
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

            <CustomerProfileModal
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                onViewHistory={handleViewHistory}
                onSuspend={handleSuspendClick}
                customer={selectedCustomer ? {
                    id: selectedCustomer.id,
                    name: selectedCustomer.full_name || 'Anonymous',
                    avatar: selectedCustomer.avatar_url || `https://ui-avatars.com/api/?name=${selectedCustomer.full_name}`,
                    joinedDate: formatDate(selectedCustomer.created_at),
                    isVerified: true,
                    email: selectedCustomer.email || 'N/A',
                    phone: selectedCustomer.phone_number || 'N/A',
                    address: (selectedCustomer as any).address || 'N/A',
                    totalOrders: selectedCustomer.orders?.[0]?.count || 0,
                    totalSpent: 0
                } as any : null}
            />

            <OrderHistoryModal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                onViewDetails={handleViewOrderDetails}
                customerName={selectedCustomer?.full_name || ''}
                orders={customerOrders}
                loading={loadingOrders}
            />

            <SuspendAccountModal
                isOpen={suspendModalOpen}
                onClose={() => setSuspendModalOpen(false)}
                onConfirm={handleConfirmSuspend}
                customerName={selectedCustomer?.full_name || ''}
            />

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setCustomerToDelete(null) }}
                onConfirm={handleConfirmDelete}
                loading={deleting}
                title={`Delete ${customerToDelete?.full_name || 'customer'}?`}
                description="This will permanently delete the customer profile and all their orders. This action cannot be undone."
            />
        </MainLayout>
    )
}
