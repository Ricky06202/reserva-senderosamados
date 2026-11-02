export interface Annotation {
	id: string
	content: string
	createdAt?: string | null
}

export type PaymentStatus = 'pagado' | 'por cobrar' | 'sin monto'
export type CommissionStatus = 'pagado' | 'pendiente'
export type ReservationOrigin = 'manual' | 'booking' | 'airbnb' | 'bot'

export interface Reservation {
	id: string
	name: string
	startDate: string
	endDate: string
	checkInTime: string
	checkOutTime: string
	peopleCount: number
	room: string
	roomId: number | null
	totalPrice: number | null
	amountPaid: number
	status: PaymentStatus
	statusId: number | null
	bookingCommission: number
	bookingCommissionStatus: CommissionStatus
	origin: ReservationOrigin
	anotaciones: Annotation[]
}

export interface ReservationDraft {
	name: string
	roomId: number | null
	peopleCount: number | null
	startDate: string
	endDate: string
	checkInTime: string
	checkOutTime: string
	totalPrice: number | null
	amountPaid: number
	statusId: number | null
	bookingCommission: number
	bookingCommissionStatus: CommissionStatus
}

export interface ApiReservation {
	id: number
	nombre: string
	casa: string | null
	casaId: number | null
	cantPersonas: number
	estado: string | null
	estadoId: number | null
	total: string | number | null
	montoOmitido?: boolean | number
	abono?: string | number | null
	comisionBooking?: string | number | null
	estadoComision?: string | null
	fechaInicio: string
	fechaFin: string
	horaEntrada?: string | null
	horaSalida?: string | null
	origen?: string | null
	anotaciones?: Array<{
		id: number
		contenido: string
		createdAt?: string | null
	}>
}

export interface ApiRoom {
	id: number
	nombre: string
}

export interface ApiStatus {
	id: number
	nombre: string
}

export interface CalendarSourceStatus {
	configured: boolean
	lastSyncedAt: string | null
	lastError: string | null
}

export interface CalendarRoomSettings {
	roomId: number
	roomName: string
	exportUrl: string
	booking: CalendarSourceStatus
	airbnb: CalendarSourceStatus
}
