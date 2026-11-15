import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'
import { format, subDays, startOfDay } from 'date-fns'

interface ChartData {
    name: string
    value: number
}

interface OrderRevenue {
    total_amount: number
    created_at: string
}

export default function RevenueChart() {
    const [data, setData] = useState<ChartData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRevenueData()
    }, [])

    const fetchRevenueData = async () => {
        setLoading(true)
        try {
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = subDays(new Date(), 6 - i)
                return {
                    name: format(date, 'eee'),
                    fullDate: date,
                    value: 0
                }
            })

            const oneWeekAgo = startOfDay(subDays(new Date(), 6))

            const { data: revenueData } = await supabase
                .from('orders')
                .select('total_amount, created_at')
                .eq('status', 'delivered')
                .gte('created_at', oneWeekAgo.toISOString()) as { data: OrderRevenue[] | null }

            if (revenueData) {
                revenueData.forEach((order: OrderRevenue) => {
                    const orderDate = startOfDay(new Date(order.created_at))
                    const dayIndex = last7Days.findIndex(d =>
                        format(d.fullDate, 'yyyy-MM-dd') === format(orderDate, 'yyyy-MM-dd')
                    )
                    if (dayIndex !== -1) {
                        last7Days[dayIndex].value += Number(order.total_amount) || 0
                    }
                })
            }

            setData(last7Days.map(({ name, value }) => ({ name, value })))
        } catch (error) {
            console.error('Error fetching revenue data:', error)
        } finally {
            setLoading(false)
        }
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.value, 0)

    return (
        <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold text-gray-900">Revenue Overview</CardTitle>
                        <p className="text-sm text-gray-400 font-normal mt-0.5">Daily revenue for this week</p>
                    </div>
                    {!loading && (
                        <div className="text-right">
                            <p className="text-xs text-gray-400 font-medium">This week</p>
                            <p className="text-lg font-bold text-gray-900">₦{totalRevenue.toLocaleString()}</p>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pl-0 pb-4 pt-2">
                <div className="h-[280px] w-full">
                    {loading ? (
                        <div className="h-full w-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                                <div className="h-2 w-48 bg-gray-100 rounded animate-pulse" />
                                <div className="h-2 w-32 bg-gray-100 rounded animate-pulse" />
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={data}
                                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FF6E15" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#FF6E15" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
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
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`}
                                    dx={-10}
                                    tickCount={5}
                                />
                                <Tooltip
                                    formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Revenue']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                                    cursor={{ stroke: '#FF6E15', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#FF6E15"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    dot={false}
                                    activeDot={{ r: 5, fill: '#FF6E15', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
