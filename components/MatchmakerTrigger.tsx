'use client'

import { useState } from 'react'
import MatchmakerModal from './MatchmakerModal'
import { Sparkles } from 'lucide-react'

export default function MatchmakerTrigger() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl p-3 text-white font-bold shadow-md hover:shadow-lg hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
                <Sparkles size={20} className="fill-white/20" />
                <span>Find a Match</span>
            </button>

            <MatchmakerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    )
}
