import {
	addDays,
	addMonths,
	addWeeks,
	endOfMonth,
	endOfWeek,
	format,
	getDaysInMonth,
	getDay,
	parseISO,
	startOfMonth,
	startOfWeek,
	subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'

export function dateKey(date: Date): string {
	return format(date, 'yyyy-MM-dd')
}

export function dateFromKey(value: string): Date {
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function formatDate(value: string, pattern = "d 'de' MMMM"): string {
	if (!value) return ''
	return format(dateFromKey(value), pattern, { locale: es })
}

export function formatLongDate(value: string): string {
	return formatDate(value, "EEEE d 'de' MMMM")
}

export function calendarDays(cursor: Date): Date[] {
	const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
	const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
	const days: Date[] = []
	for (let day = first; day <= last; day = addDays(day, 1)) days.push(day)
	return days
}

export function eachOccupiedDate(start: string, end: string): string[] {
	if (!start || !end || end <= start) return []
	const dates: string[] = []
	for (let day = dateFromKey(start); dateKey(day) < end; day = addDays(day, 1)) {
		dates.push(dateKey(day))
	}
	return dates
}

export function includesOccupiedDate(start: string, end: string, day: string): boolean {
	return Boolean(start && end && day >= start && day < end)
}

export function addMonth(cursor: Date): Date {
	return addMonths(cursor, 1)
}

export function previousMonth(cursor: Date): Date {
	return subMonths(cursor, 1)
}

export function monthLabel(cursor: Date): string {
	return format(cursor, 'MMMM yyyy', { locale: es })
}

export function weekdays(): string[] {
	const monday = startOfWeek(new Date(2026, 0, 5), { weekStartsOn: 1 })
	return Array.from({ length: 7 }, (_, index) =>
		format(addDays(monday, index), 'EEEEE', { locale: es })
	)
}

export function stayNights(start: string, end: string): number {
	if (!start || !end || end <= start) return 0
	return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / 86_400_000)
}

export function isValidStay(start: string, end: string): boolean {
	return Boolean(start && end && end > start)
}

export function todayKey(): string {
	return dateKey(new Date())
}

export function isSameMonth(date: Date, cursor: Date): boolean {
	return date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear()
}

export function monthLength(cursor: Date): number {
	return getDaysInMonth(cursor)
}

export function weekdayIndex(date: Date): number {
	return (getDay(date) + 6) % 7
}

export function parseStoredDate(value: string): Date {
	return parseISO(value)
}

export function nextWeek(cursor: Date): Date {
	return addWeeks(cursor, 1)
}
