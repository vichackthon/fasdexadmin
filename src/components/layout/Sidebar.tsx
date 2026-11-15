import { useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    ClipboardList,
    Bike,
    Map as MapIcon,
    Users,
    UtensilsCrossed,
    CheckCircle,
    BarChart3,
    User,
    CreditCard,
    Users2,
    Bell,
    HelpCircle,
    Settings,
    LogOut,
    Menu,
    X,
    Trash2,
    Gift,
    Hourglass,
    CalendarDays
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    path: string
    isActive?: boolean
    onClick?: () => void
    isDanger?: boolean
}

const SidebarItem = ({ icon: Icon, label, isActive, onClick, isDanger }: SidebarItemProps) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-[10px] h-[48px] px-[12px] py-[8px] text-[14px] font-medium transition-colors rounded-[6px]",
                isActive
                    ? "bg-[#FF6E15] text-white"
                    : "text-gray-600 hover:bg-gray-50",
                isDanger && "text-red-500 hover:text-red-600 hover:bg-red-50"
            )}
        >
            <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-white" : (isDanger ? "text-red-500" : "text-gray-500"))} />
            <span className="truncate">{label}</span>
        </button>
    )
}

interface SidebarProps {
    isOpen?: boolean
    onClose?: () => void
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
    const navigate = useNavigate()
    const location = useLocation()

    const handleNavigate = (path: string) => {
        navigate(path)
        onClose?.()
    }

    const mainNavItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: ClipboardList, label: 'Orders', path: '/orders' },
        { icon: ClipboardList, label: 'Logistics quotes', path: '/logistics-quotes' },
        { icon: Bike, label: 'Rider', path: '/riders' },
        { icon: MapIcon, label: 'Live Map', path: '/live-map' },
        { icon: Users, label: 'Customers', path: '/customers' },
        { icon: UtensilsCrossed, label: 'Restaurants', path: '/restaurants' },
        { icon: CheckCircle, label: 'Approval', path: '/approvals' },
        { icon: BarChart3, label: 'Reports', path: '/reports' },
    ]

    const moreNavItems = [
        { icon: User, label: 'Profile', path: '/profile' },
        { icon: CreditCard, label: 'Payment', path: '/payments' },
        { icon: Gift, label: 'Referrals', path: '/referrals' },
        { icon: CalendarDays, label: 'Events', path: '/events' },
        { icon: Hourglass, label: 'Waitlist', path: '/waitlist' },
        { icon: Users2, label: 'Teams', path: '/teams' },
        { icon: Bell, label: 'Notifications', path: '/notifications' },
        { icon: HelpCircle, label: 'Support', path: '/support' },
        { icon: Settings, label: 'System settings', path: '/settings' },
        { icon: Trash2, label: 'Data management', path: '/data-management' },
    ]

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed lg:sticky top-0 left-0 z-50 flex h-screen w-[260px] flex-col border-r border-gray-100 bg-white transition-transform duration-300",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Logo & Close Button */}
                <div className="flex items-center justify-between px-6 py-8">
                    <h1 className="text-2xl font-bold">Fasdex</h1>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 hover:bg-gray-100 rounded-md"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2">
                    <div className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400 tracking-wider">
                        Main
                    </div>
                    <div className="space-y-1 mb-8">
                        {mainNavItems.map((item) => (
                            <SidebarItem
                                key={item.path}
                                icon={item.icon}
                                label={item.label}
                                path={item.path}
                                isActive={location.pathname === item.path}
                                onClick={() => handleNavigate(item.path)}
                            />
                        ))}
                    </div>

                    <div className="mb-2 px-3 text-xs font-semibold uppercase text-gray-400 tracking-wider">
                        More
                    </div>
                    <div className="space-y-1 mb-8">
                        {moreNavItems.map((item) => (
                            <SidebarItem
                                key={item.path}
                                icon={item.icon}
                                label={item.label}
                                path={item.path}
                                isActive={location.pathname === item.path}
                                onClick={() => handleNavigate(item.path)}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-4 mt-auto border-t border-gray-50">
                    <SidebarItem
                        icon={LogOut}
                        label="Log out"
                        path="/logout"
                        isDanger
                        onClick={() => handleNavigate('/login')}
                    />
                </div>
            </div>
        </>
    )
}

// Export the menu button for use in header
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-md mr-4"
        >
            <Menu className="h-6 w-6" />
        </button>
    )
}
