// src/components/AvailabilityEditor.tsx
import React from "react";
import {
    Availability,
    DailyWindow,
    DayIndex,
    defaultAvailability,
} from "../utils/availability";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
    value: Availability | null | undefined;
    onChange: (next: Availability) => void;
};

export default function AvailabilityEditor({ value, onChange }: Props) {
    const avail = value ?? defaultAvailability();

    const updateDay = (dayIdx: DayIndex, windows: DailyWindow[]) => {
        const next: Availability = {
            ...avail,
            weekly: { ...avail.weekly, [dayIdx]: windows },
        };
        onChange(next);
    };

    const addWindow = (dayIdx: DayIndex) => {
        const windows = avail.weekly[dayIdx] ?? [];
        updateDay(dayIdx, [...windows, { start: "09:00", end: "17:00" }]);
    };

    const removeWindow = (dayIdx: DayIndex, i: number) => {
        const windows = [...(avail.weekly[dayIdx] ?? [])];
        windows.splice(i, 1);
        updateDay(dayIdx, windows);
    };

    const updateWindow = (dayIdx: DayIndex, i: number, w: DailyWindow) => {
        const windows = [...(avail.weekly[dayIdx] ?? [])];
        windows[i] = w;
        updateDay(dayIdx, windows);
    };

    const addBlackout = (dateStr: string) => {
        if (!dateStr) return;
        if (avail.blackoutDates.includes(dateStr)) return;
        onChange({ ...avail, blackoutDates: [...avail.blackoutDates, dateStr] });
    };

    const removeBlackout = (dateStr: string) => {
        onChange({
            ...avail,
            blackoutDates: avail.blackoutDates.filter((d) => d !== dateStr),
        });
    };

    return (
        <div className="mt-6 text-left">
            <h3 className="text-lg font-semibold mb-2">Availability</h3>

            {/* Weekly windows */}
            <div className="space-y-3">
                {dayNames.map((name, i) => {
                    const dayIdx = i as DayIndex;
                    const windows = avail.weekly[dayIdx] ?? [];
                    return (
                        <div key={dayIdx} className="border rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{name}</span>
                                <button
                                    type="button"
                                    onClick={() => addWindow(dayIdx)}
                                    className="text-xs px-2 py-1 rounded bg-indigo-800 text-white hover:bg-indigo-900"
                                >
                                    + Add Window
                                </button>
                            </div>

                            {windows.length === 0 ? (
                                <p className="text-sm text-gray-500">Closed</p>
                            ) : (
                                <div className="space-y-2">
                                    {windows.map((w, idx) => (
                                        <div key={idx} className="flex items-center gap-1">
                                            <label className="text-xs">Start</label>
                                            <input
                                                type="time"
                                                value={w.start}
                                                onChange={(e) =>
                                                    updateWindow(dayIdx, idx, { ...w, start: e.target.value })
                                                }
                                                className="border p-1 rounded"
                                            />
                                            <label className="text-xs ml-1">End</label>
                                            <input
                                                type="time"
                                                value={w.end}
                                                onChange={(e) =>
                                                    updateWindow(dayIdx, idx, { ...w, end: e.target.value })
                                                }
                                                className="border p-1 rounded"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeWindow(dayIdx, idx)}
                                                className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-800 ml-1"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Blackout dates */}
            <div className="mt-4">
                <h4 className="font-medium mb-2">Blackout Dates (not bookable)</h4>
                <div className="flex gap-2 items-center">
                    <input
                        type="date"
                        onChange={(e) => addBlackout(e.target.value)}
                        className="border p-2 rounded"
                    />
                </div>
                {avail.blackoutDates.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {avail.blackoutDates
                            .slice()
                            .sort()
                            .map((d) => (
                                <li
                                    key={d}
                                    className="flex items-center justify-between border rounded p-2 text-sm"
                                >
                                    <span>{d}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeBlackout(d)}
                                        className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                                    >
                                        Remove
                                    </button>
                                </li>
                            ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
