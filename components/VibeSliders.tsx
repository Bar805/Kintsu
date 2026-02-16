'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { VibeSliders as VibeSliderValues } from '@/types/database'

interface VibeSliderProps {
    value: VibeSliderValues
    onChange: (sliders: VibeSliderValues) => void
}

const SLIDER_CONFIG = [
    {
        key: 'social_battery' as const,
        label: 'Social Battery',
        left: '🛋️ Hibernation',
        right: 'Party 🎉',
        gradient: 'from-indigo-400 to-pink-500',
    },
    {
        key: 'planning' as const,
        label: 'Planning',
        left: '🌊 Go with flow',
        right: 'Itinerary 📋',
        gradient: 'from-cyan-400 to-emerald-500',
    },
    {
        key: 'conversation' as const,
        label: 'Conversation',
        left: '👂 Listener',
        right: 'Storyteller 🎤',
        gradient: 'from-amber-400 to-orange-500',
    },
    {
        key: 'thinking' as const,
        label: 'Thinking',
        left: '💫 Gut',
        right: 'Logic 🧠',
        gradient: 'from-violet-400 to-blue-500',
    },
    {
        key: 'risk' as const,
        label: 'Risk',
        left: '🏠 Comfort',
        right: 'Send It 🚀',
        gradient: 'from-rose-400 to-red-500',
    },
]

export default function VibeSliders({ value, onChange }: VibeSliderProps) {
    const handleChange = (key: keyof VibeSliderValues, val: number) => {
        onChange({ ...value, [key]: val })
    }

    return (
        <div className="space-y-8">
            {SLIDER_CONFIG.map((slider, index) => {
                const currentVal = value[slider.key]
                return (
                    <motion.div
                        key={slider.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.08, duration: 0.4 }}
                        className="space-y-3"
                    >
                        {/* Label */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-700">{slider.label}</span>
                            <span className="text-xs font-bold text-gray-400 tabular-nums bg-gray-100 px-2 py-0.5 rounded-full">
                                {currentVal}
                            </span>
                        </div>

                        {/* Slider Track */}
                        <div className="relative">
                            <div className="slider-track-bg h-3 rounded-full bg-gray-100 overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full bg-gradient-to-r ${slider.gradient}`}
                                    initial={{ width: '50%' }}
                                    animate={{ width: `${currentVal}%` }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                />
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={currentVal}
                                onChange={(e) => handleChange(slider.key, parseInt(e.target.value))}
                                className="vibe-slider absolute inset-0 w-full h-3 opacity-0 cursor-pointer"
                                style={{ margin: 0 }}
                            />
                            {/* Thumb indicator */}
                            <motion.div
                                className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-lg border-2 pointer-events-none`}
                                style={{
                                    left: `calc(${currentVal}% - 12px)`,
                                    borderColor: 'currentColor',
                                }}
                                animate={{
                                    left: `calc(${currentVal}% - 12px)`,
                                }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            >
                                <div className={`absolute inset-1 rounded-full bg-gradient-to-r ${slider.gradient}`} />
                            </motion.div>
                        </div>

                        {/* End Labels */}
                        <div className="flex justify-between">
                            <span className="text-xs text-gray-400 font-medium">{slider.left}</span>
                            <span className="text-xs text-gray-400 font-medium">{slider.right}</span>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
