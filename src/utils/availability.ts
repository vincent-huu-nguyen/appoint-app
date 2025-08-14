// src/utils/availability.ts
export type DailyWindow = { start: string; end: string }; // "HH:mm" 24h
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;          // 0=Sun..6=Sat
export type WeeklyMap = Record<DayIndex, DailyWindow[]>;

export type Availability = {
    weekly: WeeklyMap;
    blackoutDates: string[]; // ["YYYY-MM-DD"]
};

export const defaultAvailability = (): Availability => ({
    weekly: {
        0: [], // Sun
        1: [{ start: "09:00", end: "17:00" }],
        2: [{ start: "09:00", end: "17:00" }],
        3: [{ start: "09:00", end: "17:00" }],
        4: [{ start: "09:00", end: "17:00" }],
        5: [{ start: "09:00", end: "17:00" }],
        6: [], // Sat
    },
    blackoutDates: [],
});

export const formatDateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export const parseHHMM = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
    return h * 60 + m;
};

export const roundUpTo = (date: Date, minutes: number) => {
    const ms = minutes * 60 * 1000;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
};
