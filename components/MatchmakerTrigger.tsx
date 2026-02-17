'use client'

import { useState } from 'react'
import MatchmakerModal from './MatchmakerModal'
import { Plus } from 'lucide-react'

export default function MatchmakerTrigger() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-white border border-sand rounded-3xl p-6 text-left shadow-sm hover:border-rust hover:shadow-md transition-all group"
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-mustard rounded-full flex items-center justify-center border border-mustard">
                        <Plus className="w-6 h-6 text-charcoal" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-charcoal mb-1">Request Connection</h2>
                <p className="text-sm text-gray-500 font-medium">
                    Tell Kintsu who you want to meet.
                </p>
            </button>

            <MatchmakerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    )
}
