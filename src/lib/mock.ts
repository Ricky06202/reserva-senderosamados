import { addDays } from 'date-fns'
import { dateKey } from './dates'
import type { ApiRoom, ApiStatus, Reservation } from './types'

function offset(days: number): string {
	const date = new Date()
	date.setDate(date.getDate() + days)
	return dateKey(date)
}

export const previewRooms: ApiRoom[] = [
	{ id: 1, nombre: 'Casa del Bosque' },
	{ id: 2, nombre: 'Cabaña del Jardín' },
	{ id: 3, nombre: 'Suite del Río' }
]

export const previewStatuses: ApiStatus[] = [
	{ id: 1, nombre: 'por cobrar' },
	{ id: 2, nombre: 'pagado' }
]

export function previewReservations(): Reservation[] {
	const date = (days: number) => dateKey(addDays(new Date(), days))
	return [
		{
			id: 'preview-1',
			name: 'Familia Ríos',
			startDate: date(1),
			endDate: date(4),
			checkInTime: '14:00',
			checkOutTime: '12:00',
			peopleCount: 4,
			room: previewRooms[0].nombre,
			roomId: 1,
			totalPrice: 360,
			amountPaid: 180,
			status: 'por cobrar',
			statusId: 1,
			bookingCommission: 0,
			bookingCommissionStatus: 'pendiente',
			origin: 'manual',
			anotaciones: [{ id: 'note-1', content: 'Llegan después de las 4 p. m.' }]
		},
		{
			id: 'preview-2',
			name: 'Reserva de Booking',
			startDate: date(3),
			endDate: date(6),
			checkInTime: '14:00',
			checkOutTime: '12:00',
			peopleCount: 0,
			room: previewRooms[1].nombre,
			roomId: 2,
			totalPrice: null,
			amountPaid: 0,
			status: 'sin monto',
			statusId: null,
			bookingCommission: 0,
			bookingCommissionStatus: 'pendiente',
			origin: 'booking',
			anotaciones: []
		},
		{
			id: 'preview-3',
			name: 'Estadía de ejemplo',
			startDate: date(8),
			endDate: date(10),
			checkInTime: '14:00',
			checkOutTime: '12:00',
			peopleCount: 2,
			room: previewRooms[2].nombre,
			roomId: 3,
			totalPrice: 240,
			amountPaid: 240,
			status: 'pagado',
			statusId: 2,
			bookingCommission: 30,
			bookingCommissionStatus: 'pendiente',
			origin: 'airbnb',
			anotaciones: []
		}
	]
}

export const previewSelectedDate = offset(1)
