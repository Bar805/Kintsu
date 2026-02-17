'use client'

import { motion } from 'framer-motion'
import type { VibeSliders as VibeSliderType } from '@/types/database'

interface VibeSliderProps {
    value: VibeSliderType
    onChange: (sliders: VibeSliderType) => void
}

const SLIDER_CONFIG = [
    { key: 'social_battery' as const, label: 'Social Battery', left: 'Recharge Alone', right: 'Life of the Party' },
    { key: 'planning' as const, label: 'Planning Style', left: 'Spontaneous', right: 'Itinerary Ready' },
    { key: 'conversation' as const, label: 'Conversation', left: 'Listener', right: 'Storyteller' },
    { key: 'thinking' as const, label: 'Thinking', left: 'Gut Feeling', right: 'Pure Logic' },
    { key: 'risk' as const, label: 'Risk Tolerance', left: 'Comfort Zone', right: 'Send It' },
]

export default function VibeSliders({ value, onChange }: VibeSliderProps) {
    const handleChange = (key: keyof VibeSliderType, newValue: number) => {
        onChange({ ...value, [key]: newValue })
    }

    return (
        <div className="space-y-8">
            {SLIDER_CONFIG.map((slider, index) => {
                const current = value[slider.key]

                return (
                    <motion.div
                        key={slider.key}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08, duration: 0.3 }}
                        className="space-y-3"
                    >
                        {/* Label */}
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest text-charcoal">
                                {slider.label}
                            </span>
                            <span className="text-sm font-bold text-rust tabular-nums">
                                {current}
                            </span>
                        </div>

                        {/* Slider Track */}
                        <div className="relative h-12 flex items-center">
                            <div className="absolute inset-x-0 h-3 bg-sand rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-rust rounded-full transition-all duration-150"
                                    style={{ width: `${current}%` }}
                                />
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                value={current}
                                onChange={(e) => handleChange(slider.key, Number(e.target.value))}
                                className="vibe-slider absolute inset-x-0 w-full h-12 z-10"
                            />
                        </div>

                        {/* Range Labels */}
                        <div className="flex justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {slider.left}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {slider.right}
                            </span>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}
