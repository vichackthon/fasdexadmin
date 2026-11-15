import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, UtensilsCrossed, Star, Wallet, AlertOctagon, ClipboardList } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'

type Restaurant = Database['public']['Tables']['restaurants']['Row'] & {
    tax_id?: string | null
    verification_status?: string | null
    // Vendor's own open/closed switch — an approved vendor can be closed.
    is_online?: boolean | null
    owner: {
        full_name: string | null
        email: string | null
        phone_number: string | null
        address: string | null
    } | null
}

const getMerchantGrossAmount = (order: {
    subtotal?: number | null
    takeaway_pack_fee?: number | null
}) => {
    return (Number(order.subtotal) || 0) + (Number(order.takeaway_pack_fee) || 0)
}

export default function RestaurantDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalOrders: 0,
        totalEarnings: 0,
        totalMenuItems: 0
    })

    useEffect(() => {
        if (id) {
            fetchRestaurantDetails(id)
            fetchRestaurantStats(id)
        }
    }, [id])

    const fetchRestaurantDetails = async (restaurantId: string) => {
        try {
            const { data, error } = await supabase
                .from('restaurants')
                .select(`
                    *,
                    owner:profiles!restaurants_owner_id_fkey(full_name, email, phone_number, address)
                `)
                .eq('id', restaurantId)
                .single()

            if (error) throw error
            setRestaurant(data as any)
        } catch (error) {
            console.error('Error fetching restaurant details:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchRestaurantStats = async (restaurantId: string) => {
        try {
            // Total Orders
            const { count: ordersCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)

            // Total Menu Items
            const { count: menuCount } = await supabase
                .from('menu_items')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)

            // Commission rate for this restaurant
            const { data: rData } = await supabase
                .from('restaurants')
                .select('commission_rate')
                .eq('id', restaurantId)
                .single()
            const commissionRate = (Number((rData as any)?.commission_rate) || 15) / 100

            // Net Earnings (Delivered orders only, after platform commission)
            const { data: earningsData } = await supabase
                .from('orders')
                .select('subtotal, takeaway_pack_fee')
                .eq('restaurant_id', restaurantId)
                .eq('status', 'delivered')

            const totalEarnings = earningsData?.reduce(
                (sum, order) => sum + getMerchantGrossAmount(order as any) * (1 - commissionRate),
                0
            ) || 0

            setStats({
                totalOrders: ordersCount || 0,
                totalMenuItems: menuCount || 0,
                totalEarnings
            })

        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <p className="text-gray-500">Loading restaurant details...</p>
                </div>
            </MainLayout>
        )
    }

    if (!restaurant) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
                    <p className="text-gray-500">Restaurant not found.</p>
                    <Button onClick={() => navigate('/restaurants')}>Go Back</Button>
                </div>
            </MainLayout>
        )
    }

    const statCards = [
        {
            title: 'Total Orders',
            value: stats.totalOrders.toString(),
            icon: ClipboardList,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600'
        },
        {
            title: 'Ratings',
            value: restaurant.rating?.toFixed(1) || 'N/A',
            icon: Star,
            iconBg: 'bg-yellow-50',
            iconColor: 'text-yellow-600'
        },
        {
            title: 'Net Earnings',
            value: `₦${(stats.totalEarnings / 1000).toFixed(1)}K`,
            icon: Wallet,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600'
        },
        {
            title: 'Status',
            value: !restaurant.is_active
                ? 'Suspended'
                : restaurant.is_online === false
                    ? 'Active · Offline'
                    : 'Active',
            icon: restaurant.is_active ? UtensilsCrossed : AlertOctagon,
            iconBg: restaurant.is_active ? 'bg-orange-50' : 'bg-red-50',
            iconColor: restaurant.is_active ? 'text-[#FF6E15]' : 'text-red-500'
        },
    ]

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Restaurant Management</h1>
                        <p className="text-gray-500 text-sm">Manage partner restaurants and approvals</p>
                    </div>
                    <Button
                        className="w-full sm:w-auto"
                        variant="outline"
                        onClick={() => navigate(`/restaurants/${id}/menu`)}
                    >
                        View Menu
                    </Button>
                </div>

                {/* Back Button & Title */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/restaurants')}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-600" />
                    </button>
                    <h2 className="text-xl font-bold text-gray-900">{restaurant.name} Detail</h2>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {statCards.map((stat, i) => (
                        <Card key={i} className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-gray-500 text-sm font-medium">{stat.title}</span>
                                    <div className={`h-8 w-8 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                                        <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                                    </div>
                                </div>
                                <h2 className="text-[28px] font-bold text-gray-900">{stat.value}</h2>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Personal Info & Payment Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Personal Information */}
                        <Card className="border-none shadow-sm h-full">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Personal information</h3>

                                <div className="flex items-center gap-4 mb-8">
                                    <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                                        <img
                                            src={restaurant.image_url || `https://ui-avatars.com/api/?name=${restaurant.name}`}
                                            alt={restaurant.name}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900">{restaurant.name}</h4>
                                        <p className="text-sm text-gray-500">
                                            Registered on {new Date(restaurant.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner name</p>
                                        <p className="text-base text-gray-900">{restaurant.owner?.full_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Email address</p>
                                        <p className="text-base text-gray-900">{restaurant.owner?.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Phone number</p>
                                        <p className="text-base text-gray-900">{restaurant.owner?.phone_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner address</p>
                                        <p className="text-base text-gray-900">{restaurant.owner?.address || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Business address</p>
                                        <p className="text-base text-gray-900">{restaurant.address || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Description</p>
                                        <p className="text-base text-gray-900 line-clamp-2">{restaurant.description || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Tax ID</p>
                                        <p className="text-base text-gray-900">{restaurant.tax_id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Verification status</p>
                                        <p className="text-base text-gray-900 capitalize">{restaurant.verification_status || 'pending'}</p>
                                    </div>
                                </div>

                                <div className="mt-10">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6">Payment information</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Bank name</p>
                                            <p className="text-base text-gray-900">{restaurant.bank_name || 'Not provided'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Account number</p>
                                            <p className="text-base text-gray-900">{restaurant.account_number || 'Not provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Performance */}
                    <div className="lg:col-span-1">
                        <Card className="border-none shadow-sm h-full">
                            <CardContent className="p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Performance</h3>

                                <div className="divide-y divide-gray-100">
                                    <div className="py-4 flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-900">Metrics</span>
                                        <span className="text-sm font-medium text-gray-900">Value</span>
                                    </div>
                                    <div className="py-4 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Total Orders</span>
                                        <span className="text-sm text-gray-500">{stats.totalOrders} Orders</span>
                                    </div>
                                    <div className="py-4 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Net Earnings</span>
                                        <span className="text-sm text-gray-500">₦{stats.totalEarnings.toLocaleString()}</span>
                                    </div>
                                    <div className="py-4 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Avg Rating</span>
                                        <div className="flex items-center gap-1">
                                            <div className="flex text-yellow-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`h-4 w-4 ${i < Math.round(restaurant.rating || 0) ? 'fill-current' : 'text-gray-200 fill-gray-200'}`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-gray-500">{restaurant.rating?.toFixed(1) || 0}/5</span>
                                        </div>
                                    </div>
                                    <div className="py-4 flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Menu Items</span>
                                        <span className="text-sm text-gray-500">{stats.totalMenuItems} items</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
