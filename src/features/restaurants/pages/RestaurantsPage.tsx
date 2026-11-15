import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { UtensilsCrossed, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ConfirmDeleteModal from '../../../components/ui/ConfirmDeleteModal'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'

type Restaurant = Database['public']['Tables']['restaurants']['Row'] & {
    // Vendor-controlled open/closed switch, separate from is_active (admin
    // approval). Offline vendors stay listed to customers, just as closed.
    is_online?: boolean | null
    orders: { count: number }[]
    owner: {
        full_name: string | null
        email: string | null
        phone_number: string | null
        address: string | null
    } | null
}

export default function RestaurantsPage() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [restaurants, setRestaurants] = useState<Restaurant[]>([])
    const [loading, setLoading] = useState(true)
    const [totalRestaurants, setTotalRestaurants] = useState(0)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0
    })
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [restaurantToDelete, setRestaurantToDelete] = useState<Restaurant | null>(null)
    const [deleting, setDeleting] = useState(false)

    const itemsPerPage = 50

    useEffect(() => {
        fetchRestaurants()
        fetchStats()
    }, [currentPage, searchQuery, statusFilter])

    const fetchStats = async () => {
        try {
            const { count: total } = await supabase.from('restaurants').select('*', { count: 'exact', head: true })
            const { count: active } = await supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true)
            const { count: inactive } = await supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', false)

            setStats({
                total: total || 0,
                active: active || 0,
                inactive: inactive || 0
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchRestaurants = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('restaurants')
                .select('*, orders(count), owner:profiles!restaurants_owner_id_fkey(full_name, email, phone_number, address)', { count: 'exact' })
                .order('created_at', { ascending: false })

            if (searchQuery) {
                query = query.ilike('name', `%${searchQuery}%`)
            }

            if (statusFilter !== 'all') {
                query = query.eq('is_active', statusFilter === 'active')
            }

            const from = (currentPage - 1) * itemsPerPage
            const to = from + itemsPerPage - 1
            query = query.range(from, to)

            const { data, error, count } = await query

            if (error) throw error

            setRestaurants(data as any[] || [])
            setTotalRestaurants(count || 0)

        } catch (error) {
            console.error('Error fetching restaurants:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteClick = (restaurant: Restaurant) => {
        setRestaurantToDelete(restaurant)
        setDeleteModalOpen(true)
    }

    const handleConfirmDelete = async () => {
        if (!restaurantToDelete) return
        setDeleting(true)
        try {
            const rid = restaurantToDelete.id
            const ownerId = restaurantToDelete.owner_id

            // 1. Get order IDs so we can clean up support tickets that reference them
            const { data: orderRows } = await supabase.from('orders').select('id').eq('restaurant_id', rid)
            const orderIds = (orderRows || []).map((o: any) => o.id)

            // 2. Delete support tickets referencing those orders
            if (orderIds.length > 0) {
                await supabase.from('support_tickets').delete().in('related_order_id', orderIds)
            }

            // 3. Delete payouts for this restaurant
            await supabase.from('payouts').delete().eq('restaurant_id', rid)

            // 4. Delete orders (cascades to order_items, which also clears their menu_item_id references)
            await supabase.from('orders').delete().eq('restaurant_id', rid)

            // 5. Delete menu items (safe now that no order_items reference them)
            await supabase.from('menu_items').delete().eq('restaurant_id', rid)

            // 6. Delete the restaurant
            const { error } = await supabase.from('restaurants').delete().eq('id', rid)
            if (error) throw error

            // 7. Clean up owner profile dependencies, then profile itself
            if (ownerId) {
                await supabase.from('payouts').delete().eq('recipient_id', ownerId)
                await supabase.from('notifications').delete().eq('user_id', ownerId)
                await supabase.from('profiles').delete().eq('id', ownerId)
            }

            setDeleteModalOpen(false)
            setRestaurantToDelete(null)
            fetchRestaurants()
            fetchStats()
        } catch (err: any) {
            console.error('Error deleting restaurant:', err)
            alert(`Failed to delete: ${err?.message || 'Unknown error'}`)
        } finally {
            setDeleting(false)
        }
    }

    const statusColors = (isActive: boolean) => {
        return isActive
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-600'
    }

    const totalPages = Math.ceil(totalRestaurants / itemsPerPage)

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Restaurant Management</h1>
                    <p className="text-gray-500 text-sm">Manage partner restaurants and approvals</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Total restaurants</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <UtensilsCrossed className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900">{stats.total}</h2>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Active</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <UtensilsCrossed className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900">{stats.active}</h2>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-gray-500 text-sm font-medium">Inactive</span>
                                <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                    <UtensilsCrossed className="h-4 w-4 text-[#FF6E15]" />
                                </div>
                            </div>
                            <h2 className="text-[28px] font-bold text-gray-900">{stats.inactive}</h2>
                        </CardContent>
                    </Card>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="relative flex-1 w-full md:max-w-[400px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="search restaurant by name"
                            className="h-11 pl-10 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 whitespace-nowrap">Status</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="h-[40px] px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full sm:w-[120px]"
                            >
                                <option value="all">All</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <Button
                            variant="outline"
                            size="default"
                            className="w-full sm:w-auto"
                            onClick={() => {
                                setStatusFilter('all')
                                setSearchQuery('')
                                setCurrentPage(1)
                            }}
                        >
                            Clear filters
                        </Button>
                    </div>
                </div>

                {/* Restaurants Table */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="p-5 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">List of Restaurants</h3>
                        </div>

                        {loading ? (
                            <div className="p-10 text-center text-gray-500">Loading restaurants...</div>
                        ) : restaurants.length === 0 ? (
                            <div className="p-10 text-center text-gray-500">No restaurants found.</div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="border-b border-gray-100 bg-white">
                                            <tr>
                                                <th className="px-6 py-4 font-medium text-gray-500">Name</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Owner</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Address</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Orders</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                                                <th className="px-6 py-4 font-medium text-gray-500">Added</th>
                                                <th className="px-6 py-4 font-medium text-gray-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {restaurants.map((restaurant) => (
                                                <tr key={restaurant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                    <td className="px-6 py-4 font-medium text-gray-900">{restaurant.name}</td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        <div className="text-sm">{(restaurant as any).owner?.full_name || '—'}</div>
                                                        <div className="text-xs text-gray-400">{(restaurant as any).owner?.email || ''}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600 truncate max-w-[160px]">{restaurant.address || 'N/A'}</td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        {restaurant.orders?.[0]?.count || 0}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors(restaurant.is_active || false)}`}>
                                                                {restaurant.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                            {restaurant.is_active && restaurant.is_online === false && (
                                                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                                                    Offline
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                                        {new Date(restaurant.created_at).toLocaleDateString('en-GB')}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <button
                                                                onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                                                                className="text-sm font-medium text-[#FF6E15] hover:underline"
                                                            >
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(restaurant)}
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

                                {/* Mobile Cards */}
                                <div className="md:hidden divide-y divide-gray-100">
                                    {restaurants.map((restaurant) => (
                                        <div key={restaurant.id} className="p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="font-medium text-gray-900">{restaurant.name}</p>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors(restaurant.is_active || false)}`}>
                                                        {restaurant.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                    {restaurant.is_active && restaurant.is_online === false && (
                                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                                                            Offline
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-500">{(restaurant as any).owner?.full_name || 'No owner'} · {restaurant.address || 'No address'}</p>
                                            <div className="flex justify-end gap-4">
                                                <button
                                                    onClick={() => navigate(`/restaurants/${restaurant.id}`)}
                                                    className="text-sm font-medium text-[#FF6E15]"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(restaurant)}
                                                    className="text-sm font-medium text-red-500"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalRestaurants)} of {totalRestaurants}
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

            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setRestaurantToDelete(null) }}
                onConfirm={handleConfirmDelete}
                loading={deleting}
                title={`Delete ${restaurantToDelete?.name || 'restaurant'}?`}
                description="This will permanently delete the restaurant, all their orders, and the owner's profile. This action cannot be undone."
            />
        </MainLayout>
    )
}
