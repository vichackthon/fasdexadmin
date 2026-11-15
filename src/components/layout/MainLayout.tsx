import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface MainLayoutProps {
    children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)

    return (
        <div className="flex min-h-screen bg-white">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            {/* min-w-0: a flex item won't shrink below its content by default,
                so without it one wide table stretches the whole page sideways
                instead of scrolling inside its own overflow-x-auto card. */}
            <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 overflow-auto bg-[#FAFAFA] p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
