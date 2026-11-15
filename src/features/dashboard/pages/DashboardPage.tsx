import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import StatsCard from '../components/StatsCard'
import RevenueChart from '../components/RevenueChart'
import TopRiders from '../components/TopRiders'
import RecentOrders from '../components/RecentOrders'
import { Store, Bike, UtensilsCrossed, Users } from 'lucide-react'
import { fetchAdminRiderRecords } from '../../../lib/adminRiders'
import { isRiderActuallyOnline } from '../../../lib/riderPresence'
import { supabase } from '../../../lib/supabase'
import { format } from 'date-fns'

interface DashboardStats {
    totalOrders: number
    activeRiders: number
    totalRestaurants: number
    totalCustomers: number
    ordersThisWeek: number
    ridersOnline: number
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        totalOrders: 0,
        activeRiders: 0,
        totalRestaurants: 0,
        totalCustomers: 0,
        ordersThisWeek: 0,
        ridersOnline: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDashboardStats()

        // Set up real-time subscriptions
        const ordersChannel = supabase
            .channel('dashboard-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const profilesChannel = supabase
            .channel('dashboard-profiles')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const restaurantsChannel = supabase
            .channel('dashboard-restaurants')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const verificationsChannel = supabase
            .channel('dashboard-verifications')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_verifications' }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const courierLocationsChannel = supabase
            .channel('dashboard-courier-locations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'courier_locations' }, () => {
                fetchDashboardStats()
            })
            .subscribe()

        const presenceInterval = window.setInterval(() => {
            fetchDashboardStats()
        }, 30000)

        return () => {
            supabase.removeChannel(ordersChannel)
            supabase.removeChannel(profilesChannel)
            supabase.removeChannel(restaurantsChannel)
            supabase.removeChannel(verificationsChannel)
            supabase.removeChannel(courierLocationsChannel)
            window.clearInterval(presenceInterval)
        }
    }, [])

    const fetchDashboardStats = async () => {
        try {
            // Fetch total orders
            const { count: totalOrders } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })

            // Fetch orders from this week
            const oneWeekAgo = new Date()
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
            const { count: ordersThisWeek } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', oneWeekAgo.toISOString())

            const riderStatuses = await fetchAdminRiderRecords(supabase)
            const totalRiders = riderStatuses.length
            const ridersOnline = riderStatuses.filter((rider) =>
                isRiderActuallyOnline(rider.is_online, rider.courier_location)
            ).length

            // Fetch total restaurants
            const { count: totalRestaurants } = await supabase
                .from('restaurants')
                .select('*', { count: 'exact', head: true })

            // Fetch total customers
            const { count: totalCustomers } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'customer')

            setStats({
                totalOrders: totalOrders || 0,
                activeRiders: totalRiders || 0,
                totalRestaurants: totalRestaurants || 0,
                totalCustomers: totalCustomers || 0,
                ordersThisWeek: ordersThisWeek || 0,
                ridersOnline
            })
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Welcome back! Here's what's happening today.</p>
                    </div>
                    <span className="text-sm text-gray-400 font-medium hidden sm:block">
                        {format(new Date(), 'EEEE, d MMM yyyy')}
                    </span>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <StatsCard
                        title="Total Orders"
                        value={loading ? '...' : stats.totalOrders.toLocaleString()}
                        trend={`${stats.ordersThisWeek} this week`}
                        icon={Store}
                        iconBg="bg-orange-50"
                    />
                    <StatsCard
                        title="Active Riders"
                        value={loading ? '...' : stats.activeRiders.toString()}
                        trend={`${stats.ridersOnline} currently online`}
                        trendPositive={stats.ridersOnline > 0}
                        icon={Bike}
                        iconBg="bg-orange-50"
                    />
                    <StatsCard
                        title="Restaurants"
                        value={loading ? '...' : stats.totalRestaurants.toString()}
                        trend="Active partners"
                        icon={UtensilsCrossed}
                        iconBg="bg-orange-50"
                        iconColor="text-[#FF6E15]"
                    />
                    <StatsCard
                        title="Total Customers"
                        value={loading ? '...' : stats.totalCustomers.toLocaleString()}
                        trend="Registered users"
                        icon={Users}
                        iconBg="bg-orange-50"
                    />
                </div>

                {/* Middle Section: Chart + Top Riders */}
                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <RevenueChart />
                    </div>
                    <div>
                        <TopRiders />
                    </div>
                </div>

                {/* Bottom Section: Recent Orders */}
                <RecentOrders />
            </div>
        </MainLayout>
    )
}
