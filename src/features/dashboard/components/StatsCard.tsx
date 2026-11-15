import type { ElementType } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '../../../components/ui/card'
import { cn } from '../../../lib/utils'

interface StatsCardProps {
    title: string
    value: string
    trend: string
    trendPositive?: boolean
    subText?: string
    icon: ElementType
    iconColor?: string
    iconBg?: string
}

export default function StatsCard({
    title,
    value,
    trend,
    trendPositive = true,
    subText,
    icon: Icon,
    iconColor = "text-[#FF6E15]",
    iconBg = "bg-[#FFF0E6]"
}: StatsCardProps) {
    return (
        <Card className="border-none shadow-sm">
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-gray-500 text-sm font-medium">{title}</span>
                    <div className={cn("p-2.5 rounded-xl", iconBg)}>
                        <Icon className={cn("h-5 w-5", iconColor)} />
                    </div>
                </div>

                <div className="space-y-2">
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h2>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                        {trendPositive
                            ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        }
                        <span className={cn(trendPositive ? "text-green-600" : "text-red-500")}>
                            {trend}
                        </span>
                        {subText && (
                            <span className="text-gray-400 font-normal">{subText}</span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
