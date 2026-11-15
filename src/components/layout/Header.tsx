import { useState, useRef, useEffect } from 'react'
import { Search, Bell, Menu, X, CheckSquare, Trash2 } from 'lucide-react'
import { Input } from '../ui/input'
import { useAdminProfile } from '../../hooks/useAdminProfile'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useGlobalSearch } from '../../hooks/useGlobalSearch'
import { UtensilsCrossed, Bike, ShoppingBag, User } from 'lucide-react'

interface HeaderProps {
    onMenuClick?: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
    const { data: profile } = useAdminProfile()
    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAllNotifications,
    } = useNotifications()
    const [showNotifications, setShowNotifications] = useState(false)
    const notificationRef = useRef<HTMLDivElement>(null)

    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const { results, loading } = useGlobalSearch(searchQuery)
    const searchRef = useRef<HTMLDivElement>(null)

    // Close notification/search panels when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false)
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearch(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const getSearchIcon = (type: string) => {
        switch (type) {
            case 'restaurant': return <UtensilsCrossed className="h-4 w-4" />
            case 'rider': return <Bike className="h-4 w-4" />
            case 'customer': return <User className="h-4 w-4" />
            case 'order': return <ShoppingBag className="h-4 w-4" />
            default: return <Search className="h-4 w-4" />
        }
    }

    const getSearchIconColors = (type: string) => {
        switch (type) {
            case 'restaurant': return 'bg-orange-100 text-orange-600'
            case 'rider': return 'bg-blue-100 text-blue-600'
            case 'customer': return 'bg-green-100 text-green-600'
            case 'order': return 'bg-purple-100 text-purple-600'
            default: return 'bg-gray-100 text-gray-600'
        }
    }

    const handleResultClick = (url: string) => {
        navigate(url)
        setShowSearch(false)
        setSearchQuery('')
    }

    const handleViewAllNotifications = () => {
        navigate('/support')
        setShowNotifications(false)
    }

    const getNotificationIcon = (type: string) => {
        // We can add logic to return different colors/icons based on type
        switch (type) {
            case 'new_order': return 'bg-orange-100 text-orange-600'
            case 'payout_request': return 'bg-blue-100 text-blue-600'
            case 'support_ticket': return 'bg-purple-100 text-purple-600'
            default: return 'bg-gray-100 text-gray-600'
        }
    }

    return (
        <header className="flex h-[80px] items-center justify-between border-b border-gray-100 bg-white px-4 md:px-6 lg:px-8 sticky top-0 z-40">
            {/* Left Section: Menu + Search */}
            <div className="flex items-center flex-1">
                {/* Mobile Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 hover:bg-gray-100 rounded-md mr-2"
                >
                    <Menu className="h-6 w-6 text-gray-600" />
                </button>

                {/* Search Bar */}
                <div className="hidden sm:flex w-full max-w-[400px] items-center" ref={searchRef}>
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search for riders, orders, restaurants"
                            className="h-11 w-full bg-gray-50 border-transparent pl-10 focus:bg-white transition-colors"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setShowSearch(true)
                            }}
                            onFocus={() => setShowSearch(true)}
                        />

                        {/* Search Results Dropdown */}
                        {showSearch && searchQuery.length > 1 && (
                            <div className="absolute top-full left-0 mt-2 w-full rounded-xl border border-gray-100 bg-white shadow-2xl z-50 overflow-hidden">
                                {loading ? (
                                    <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                ) : results.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500">No results found</div>
                                ) : (
                                    <div className="max-h-[300px] overflow-y-auto py-2">
                                        {results.map((result) => (
                                            <div
                                                key={`${result.type}-${result.id}`}
                                                onClick={() => handleResultClick(result.url)}
                                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                            >
                                                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${getSearchIconColors(result.type)}`}>
                                                    {getSearchIcon(result.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {result.title}
                                                    </p>
                                                    <p className="text-xs text-gray-500 capitalize">
                                                        {result.type} • {result.subtitle}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-3 md:gap-6">
                {/* Mobile Search Icon */}
                <button className="sm:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <Search className="h-5 w-5" />
                </button>

                {/* Notification Bell */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative rounded-full bg-gray-100 p-2.5 text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-3 w-[320px] md:w-[380px] rounded-xl border border-gray-100 bg-white shadow-2xl z-50 overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-gray-50">
                                <h3 className="font-bold text-gray-900">Notifications</h3>
                                <div className="flex gap-2">
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={() => void markAllAsRead()}
                                            className="text-xs text-[#FF6E15] font-medium hover:underline flex items-center gap-1"
                                        >
                                            <CheckSquare className="h-3 w-3" />
                                            Mark all read
                                        </button>
                                    )}
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={() => void clearAllNotifications()}
                                            className="text-xs text-red-500 font-medium hover:underline flex items-center gap-1"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Clear all
                                        </button>
                                    )}
                                    <button onClick={() => setShowNotifications(false)}>
                                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-500 text-sm">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            onClick={() => {
                                                if (!notif.is_read) {
                                                    void markAsRead(notif.id)
                                                }
                                            }}
                                            className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${!notif.is_read ? 'bg-orange-50/30' : ''}`}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${getNotificationIcon(notif.type)}`}>
                                                    <Bell className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <p className={`text-sm font-semibold truncate ${!notif.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{notif.title}</p>
                                                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                                                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 line-clamp-2 leading-snug">{notif.message}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {notifications.length > 0 && (
                                <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                                    <button
                                        onClick={handleViewAllNotifications}
                                        className="text-xs font-semibold text-gray-500 hover:text-[#FF6E15]"
                                    >
                                        View all notifications
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Profile */}
                <div className="flex items-center gap-3 pl-2 border-l border-gray-100 ml-2">
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-gray-200 flex-shrink-0 bg-gray-100">
                        <img
                            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'Admin'}&background=FF6E15&color=fff`}
                            alt="Profile"
                            className="h-full w-full object-cover"
                        />
                    </div>
                    <div className="hidden md:flex flex-col">
                        <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">
                            {profile?.full_name || 'Loading...'}
                        </span>
                        <span className="text-xs text-gray-500 text-left capitalize">
                            {profile?.role?.replace('_', ' ') || 'Admin'}
                        </span>
                    </div>
                </div>
            </div>
        </header>
    )
}
