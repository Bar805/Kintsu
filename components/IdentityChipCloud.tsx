'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, X, Check } from 'lucide-react'
import { toast } from 'sonner'

interface IdentityChipCloudProps {
    value: string[]
    onChange: (chips: string[]) => void
    maxChips?: number
}

const DEFAULT_CHIPS = [
    // Lifestyle & Energy
    'Early Riser', 'Night Owl', 'Gym Rat', 'Yoga Flow', 'Runner',
    // Social & Personality
    'Deep Talker', 'Class Clown', 'Old Soul', 'Ambivert', 'Empath',
    // Career & Ambition
    'Founder', 'Creative', 'Side Hustler', 'Corporate Escapee', '9-to-5er',
    // Food & Drink
    'Foodie', 'Home Chef', 'Coffee Snob', 'Wine & Dine',
    // Culture & Media
    'Cinephile', 'Bookworm', 'Podcast Junkie', 'Gamer', 'Music Head',
    // Outdoors & Travel
    'Outdoorsy', 'Traveler', 'Homebody', 'Road Tripper',
    // Misc Identity
    'Dog Parent', 'Cat Person', 'Plant Parent', 'Meme Lord',
]

export default function IdentityChipCloud({ value, onChange, maxChips = 5 }: IdentityChipCloudProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [customInput, setCustomInput] = useState('')

    const filteredChips = useMemo(() => {
        if (!searchQuery.trim()) return DEFAULT_CHIPS
        const q = searchQuery.toLowerCase()
        return DEFAULT_CHIPS.filter(chip => chip.toLowerCase().includes(q))
    }, [searchQuery])

    const isSelected = (chip: string) => value.includes(chip)

    const toggleChip = (chip: string) => {
        if (isSelected(chip)) {
            onChange(value.filter(c => c !== chip))
        } else {
            if (value.length >= maxChips) {
                toast.error(`You can only pick ${maxChips}. Remove one first!`, {
                    icon: '✋',
                    duration: 2000,
                })
                return
            }
            onChange([...value, chip])
        }
    }

    const addCustomChip = () => {
        const trimmed = customInput.trim()
        if (!trimmed) return

        if (value.includes(trimmed) || DEFAULT_CHIPS.includes(trimmed)) {
            toast.info('That chip already exists!')
            return
        }

        if (value.length >= maxChips) {
            toast.error(`You can only pick ${maxChips}. Remove one first!`, {
                icon: '✋',
                duration: 2000,
            })
            return
        }

        onChange([...value, trimmed])
        setCustomInput('')
        setSearchQuery('')
    }

    const handleCustomKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addCustomChip()
        }
    }

    const showAddCustom = searchQuery.trim() && filteredChips.length === 0

    return (
        <div className="space-y-5">
            {/* Selected Chips Summary */}
            <div className="flex items-center gap-2 min-h-[40px] flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {value.length}/{maxChips} selected
                </span>
                <AnimatePresence>
                    {value.map(chip => (
                        <motion.button
                            key={chip}
                            type="button"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            onClick={() => toggleChip(chip)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-md shadow-amber-200/50 hover:shadow-lg hover:shadow-amber-200/50 transition-shadow"
                        >
                            {chip}
                            <X size={12} />
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search or type a custom tag..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value)
                        setCustomInput(e.target.value)
                    }}
                    onKeyDown={handleCustomKeyDown}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-2xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                />
            </div>

            {/* Chip Grid */}
            <div className="flex flex-wrap gap-2.5">
                <AnimatePresence>
                    {filteredChips.map((chip, index) => {
                        const selected = isSelected(chip)
                        return (
                            <motion.button
                                key={chip}
                                type="button"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ delay: index * 0.02, duration: 0.2 }}
                                onClick={() => toggleChip(chip)}
                                className={`
                  inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold
                  transition-all duration-200 cursor-pointer select-none
                  ${selected
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200/40 scale-105'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 hover:scale-105'
                                    }
                `}
                            >
                                {selected && <Check size={14} strokeWidth={3} />}
                                {chip}
                            </motion.button>
                        )
                    })}
                </AnimatePresence>

                {/* Add Custom Chip Button */}
                {showAddCustom && (
                    <motion.button
                        type="button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={addCustomChip}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                        <Plus size={14} strokeWidth={3} />
                        Add &quot;{customInput.trim()}&quot;
                    </motion.button>
                )}
            </div>
        </div>
    )
}
