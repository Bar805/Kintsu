'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Home, User, Settings as SettingsIcon, ChevronLeft } from 'lucide-react'

export default function SettingsPage() {
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/')
        router.refresh()
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-cream font-sans text-charcoal">
            {/* Header */}
            <div className="px-6 py-5 flex items-center shrink-0 border-b border-sand/50">
                <Link href="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-sand shadow-sm hover:border-charcoal transition-colors">
                    <ChevronLeft size={20} className="text-charcoal" />
                </Link>
                <h1 className="flex-1 text-center font-bold text-xl tracking-tight mr-10">
                    Settings
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar bg-cream space-y-6">

                {/* Account Section */}
                <div className="space-y-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-charcoal/40 ml-2">Account</h2>
                    <div className="bg-white border border-sand rounded-3xl overflow-hidden divide-y divide-sand">

                        {/* Placeholder generic settings - can be fleshed out later */}
                        <div className="px-6 py-4 flex justify-between items-center opacity-50 cursor-not-allowed">
                            <span className="font-medium text-sm">Notifications</span>
                            <span className="text-xs text-charcoal/40 font-bold uppercase tracking-widest">Off</span>
                        </div>
                        <div className="px-6 py-4 flex justify-between items-center opacity-50 cursor-not-allowed">
                            <span className="font-medium text-sm">Privacy Options</span>
                            <span className="text-xs text-charcoal/40 font-bold uppercase tracking-widest">Standard</span>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full px-6 py-4 flex items-center text-left text-rust font-bold hover:bg-rust/5 transition-colors focus:bg-rust/10 outline-none"
                        >
                            <LogOut size={18} className="mr-3" />
                            Sign Out
                        </button>
                    </div>
                </div>

                <div className="flex justify-center pt-10">
                    <p className="text-xs font-bold uppercase tracking-widest text-charcoal/20">Kintsu v1.0.0</p>
                </div>

            </div>

            {/* Bottom Nav */}
            <div className="h-20 border-t border-sand flex items-center justify-around px-6 bg-white shrink-0">
                <Link href="/dashboard" className="flex flex-col items-center gap-1 text-gray-300 hover:text-charcoal transition-colors">
                    <Home className="w-6 h-6" />
                </Link>
                <Link href="/dashboard/profile" className="flex flex-col items-center gap-1 text-gray-300 hover:text-charcoal transition-colors">
                    <User className="w-6 h-6" />
                </Link>
                <button className="flex flex-col items-center gap-1 text-rust outline-none">
                    <SettingsIcon className="w-6 h-6 fill-current" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
                </button>
            </div>
        </div>
    )
}
