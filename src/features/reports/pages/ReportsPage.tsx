import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { TrendingUp, ShoppingBag, Users, Bike, Search } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../../../lib/supabase'
import { format, subMonths, subDays, startOfDay } from 'date-fns'

interface ChartData {
    name: string
    value: number
}

interface RiderData {
    name: string
    value: number
    color: string
}

interface Stats {
    totalRevenue: number
    totalOrders: number
    activeCustomers: number
    avgDeliveryTime: string
}

export default function ReportsPage() {
    const [revenueData, setRevenueData] = useState<ChartData[]>([])
    const [ordersData, setOrdersData] = useState<ChartData[]>([])
    const [ridersData, setRidersData] = useState<RiderData[]>([])
    const [stats, setStats] = useState<Stats>({
        totalRevenue: 0,
        totalOrders: 0,
        activeCustomers: 0,
        avgDeliveryTime: '0 mins'
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        setLoading(true)
        await Promise.all([
            fetchStats(),
            fetchRevenueData(),
            fetchOrdersData(),
            fetchTopRiders()
        ])
        setLoading(false)
    }

    const fetchStats = async () => {
        try {
            // Total Revenue from delivered orders
            const { data: revenueData } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'delivered') as { data: { total_amount: number }[] | null }

            const totalRevenue = revenueData?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0

            // Total Orders
            const { count: totalOrders } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })

            // Active Customers (customers who placed orders in last 30 days)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

            const { data: activeCustomersData } = await supabase
                .from('orders')
                .select('customer_id')
                .gte('created_at', thirtyDaysAgo.toISOString()) as { data: { customer_id: string }[] | null }

            const uniqueCustomers = new Set(activeCustomersData?.map((o: any) => o.customer_id) || [])

            setStats({
                totalRevenue,
                totalOrders: totalOrders || 0,
                activeCustomers: uniqueCustomers.size,
                avgDeliveryTime: '24 mins' // Placeholder - would need delivery timestamps to calculate
            })
        } catch (error) {
            console.error('Error fetching stats:', error)
        }
    }

    const fetchRevenueData = async () => {
        try {
            // Get revenue for last 6 months
            const months = Array.from({ length: 6 }, (_, i) => {
                const date = subMonths(new Date(), 5 - i)
                return {
                    name: format(date, 'MMM'),
                    startDate: new Date(date.getFullYear(), date.getMonth(), 1),
                    endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0),
                    value: 0
                }
            })

            const { data: orders } = await supabase
                .from('orders')
                .select('total_amount, created_at')
                .eq('status', 'delivered')
                .gte('created_at', months[0].startDate.toISOString()) as { data: { total_amount: number; created_at: string }[] | null }

            orders?.forEach(order => {
                const orderDate = new Date(order.created_at)
                const monthIndex = months.findIndex(m =>
                    orderDate >= m.startDate && orderDate <= m.endDate
                )
                if (monthIndex !== -1) {
                    months[monthIndex].value += Number(order.total_amount) || 0
                }
            })

            setRevenueData(months.map(({ name, value }) => ({ name, value })))
        } catch (error) {
            console.error('Error fetching revenue data:', error)
        }
    }

    const fetchOrdersData = async () => {
        try {
            // Get orders for last 7 days
            const days = Array.from({ length: 7 }, (_, i) => {
                const date = subDays(new Date(), 6 - i)
                return {
                    name: format(date, 'EEE'),
                    fullDate: startOfDay(date),
                    value: 0
                }
            })

            const { data: orders } = await supabase
                .from('orders')
                .select('created_at')
                .gte('created_at', days[0].fullDate.toISOString()) as { data: { created_at: string }[] | null }

            orders?.forEach(order => {
                const orderDate = startOfDay(new Date(order.created_at))
                const dayIndex = days.findIndex(d =>
                    format(d.fullDate, 'yyyy-MM-dd') === format(orderDate, 'yyyy-MM-dd')
                )
                if (dayIndex !== -1) {
                    days[dayIndex].value++
                }
            })

            setOrdersData(days.map(({ name, value }) => ({ name, value })))
        } catch (error) {
            console.error('Error fetching orders data:', error)
        }
    }

    const fetchTopRiders = async () => {
        try {
            const { data: ridersData } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'rider')
                .limit(3)

            const colors = ['#00C853', '#880E4F', '#FFD600']

            const ridersWithStats = await Promise.all(
                (ridersData || []).map(async (rider: any, index: number) => {
                    const { count } = await supabase
                        .from('orders')
                        .select('*', { count: 'exact', head: true })
                        .eq('rider_id', rider.id)
                        .eq('status', 'delivered')

                    return {
                        name: rider.full_name || 'Anonymous Rider',
                        value: count || 0,
                        color: colors[index]
                    }
                })
            )

            const sortedRiders = ridersWithStats
                .sort((a, b) => b.value - a.value)
                .slice(0, 3)

            setRidersData(sortedRiders)
        } catch (error) {
            console.error('Error fetching top riders:', error)
        }
    }

    const statsCards = [
        { title: 'Total Revenue', value: `₦${(stats.totalRevenue / 1000000).toFixed(1)}M`, trend: `${stats.totalOrders} orders`, icon: TrendingUp, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
        { title: 'Total orders', value: stats.totalOrders.toLocaleString(), icon: ShoppingBag, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
        { title: 'Active customers', value: stats.activeCustomers.toLocaleString(), trend: 'Last 30 days', icon: Users, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
        { title: 'Avg delivery time', value: stats.avgDeliveryTime, icon: Bike, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
    ]
    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-gray-500 text-sm">Business performance insights and metrics</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading ? (
                        <div className="col-span-4 text-center py-8 text-gray-500">Loading statistics...</div>
                    ) : (
                        statsCards.map((stat, i) => (
                            <Card key={i} className="border-none shadow-sm">
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-gray-500 text-sm font-medium">{stat.title}</span>
                                        <div className={`h-8 w-8 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                                            <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                                        </div>
                                    </div>
                                    <h2 className="text-[28px] font-bold text-gray-900 mb-1">{stat.value}</h2>
                                    {stat.trend && (
                                        <p className="text-sm text-green-600">{stat.trend}</p>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full md:max-w-[400px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="search customer by name, phone number, email address"
                            className="h-11 pl-10 bg-gray-50 border-none"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto ml-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 whitespace-nowrap">Status</span>
                            <select className="h-[40px] px-3 border border-gray-200 rounded-[6px] bg-white text-sm w-full md:w-[120px]">
                                <option>All Status</option>
                            </select>
                        </div>
                        <Button className="bg-[#FF6E15] hover:bg-[#FF6E15]/90">Apply</Button>
                        <Button variant="outline">Clear filters</Button>
                    </div>
                </div>

                {/* Charts Row 1: Revenue & Top Riders */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Revenue Overview */}
                    <Card className="lg:col-span-2 border-none shadow-sm">
                        <CardContent className="p-6">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-900">Revenue Overview</h3>
                                <p className="text-sm text-gray-500">Daily revenue for this week</p>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueData}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#FF6E15" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#FF6E15" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                            tickFormatter={(value) => `${value / 1000000}m`}
                                        />
                                        <Tooltip />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke="#FF6E15"
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorRevenue)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Top Riders */}
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6 h-full flex flex-col">
                            <h3 className="text-lg font-bold text-gray-900 mb-6">Top riders</h3>

                            {/* Legend */}
                            <div className="space-y-3 mb-6">
                                {ridersData.map((rider, index) => (
                                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rider.color }} />
                                        <span>{rider.name} ({rider.value} trips)</span>
                                    </div>
                                ))}
                            </div>

                            {/* Donut Chart */}
                            <div className="h-[200px] w-full flex-1 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={ridersData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={0}
                                            dataKey="value"
                                        >
                                            {ridersData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts Row 2: Orders for the week */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Orders for the week</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ordersData} barSize={40}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                    />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" fill="#FF6E15" radius={[4, 4, 4, 4]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
