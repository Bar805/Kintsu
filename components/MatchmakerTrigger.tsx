'use client'

import { useState } from 'react'
import MatchmakerModal from './MatchmakerModal'

export default function MatchmakerTrigger() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-ai hover:bg-gray-200 transition-colors shadow-sm"
                aria-label="Open Matchmaker"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
            </button>

            <MatchmakerModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    )
}
