import type {
	ApiReservation,
	ApiRoom,
	ApiStatus,
	Annotation,
	CalendarRoomSettings,
	CommissionStatus,
	Reservation,
	ReservationDraft
} from './types'

const API_URL = (
	import.meta.env.VITE_API_URL ||
	(import.meta.env.DEV
		? 'http://127.0.0.1:8787'
		: 'https://api.reservas.senderosamados.rsanjur.com')
).replace(/\/$/, '')

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message)
		this.name = 'ApiError'
	}
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		...init,
		credentials: 'include',
		cache: 'no-store',
		headers: {
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers
		}
	})

	if (!response.ok) {
		const responseBody = await response.json().catch(() => null) as { error?: unknown } | null
		const serverMessage = typeof responseBody?.error === 'string' && responseBody.error.length < 240
			? responseBody.error
			: null
		const message = response.status === 401 || response.status === 403
			? 'Inicia sesión con RS ID para continuar.'
			: serverMessage ?? `No se pudo completar la solicitud (${response.status}).`
		throw new ApiError(message, response.status)
	}
	return (await response.json()) as T
}

function optionalNumber(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined || value === '') return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function numberOrZero(value: string | number | null | undefined): number {
	return optionalNumber(value) ?? 0
}

function mapReservation(item: ApiReservation): Reservation {
	const totalPrice = Number(item.montoOmitido ?? 0) === 1 ? null : optionalNumber(item.total)
	const annotations: Annotation[] = (item.anotaciones ?? []).map((annotation) => ({
		id: String(annotation.id),
		content: annotation.contenido,
		createdAt: annotation.createdAt ?? null
	}))
	const bookingCommissionStatus: CommissionStatus =
		item.estadoComision === 'pagado' ? 'pagado' : 'pendiente'

	return {
		id: String(item.id),
		name: item.nombre,
		room: item.casa ?? 'Hospedaje',
		roomId: item.casaId,
		peopleCount: Number(item.cantPersonas) || 0,
		startDate: item.fechaInicio.slice(0, 10),
		endDate: item.fechaFin.slice(0, 10),
		totalPrice,
		amountPaid: numberOrZero(item.abono),
		status: totalPrice === null ? 'sin monto' : item.estado === 'pagado' ? 'pagado' : 'por cobrar',
		statusId: item.estadoId,
		bookingCommission: numberOrZero(item.comisionBooking),
		bookingCommissionStatus,
		origin:
			item.origen === 'booking' || item.origen === 'airbnb' || item.origen === 'bot'
				? item.origen
				: 'manual',
		anotaciones: annotations
	}
}

function statusIdFor(draft: ReservationDraft): number | null {
	if (draft.totalPrice === null) return null
	return draft.statusId
}

function reservationBody(draft: ReservationDraft) {
	return {
		nombre: draft.name.trim(),
		casaId: draft.roomId,
		cantPersonas: draft.peopleCount,
		estadoId: statusIdFor(draft),
		total: draft.totalPrice === null ? null : String(draft.totalPrice),
		abono: draft.totalPrice === null ? '0' : String(draft.amountPaid),
		comisionBooking: draft.totalPrice === null ? '0' : String(draft.bookingCommission),
		estadoComision: draft.bookingCommissionStatus,
		fechaInicio: `${draft.startDate}T12:00:00.000Z`,
		fechaFin: `${draft.endDate}T12:00:00.000Z`
	}
}

export const api = {
	async getReservations(): Promise<Reservation[]> {
		const rows = await request<ApiReservation[]>('/reservas')
		return rows.map(mapReservation)
	},

	getRooms(): Promise<ApiRoom[]> {
		return request<ApiRoom[]>('/casas')
	},

	getStatuses(): Promise<ApiStatus[]> {
		return request<ApiStatus[]>('/estados')
	},

	async createReservation(draft: ReservationDraft): Promise<string> {
		const result = await request<{ id: number }>('/reservas', {
			method: 'POST',
			body: JSON.stringify(reservationBody(draft))
		})
		return String(result.id)
	},

	async updateReservation(id: string, draft: ReservationDraft): Promise<void> {
		await request(`/reservas/${encodeURIComponent(id)}`, {
			method: 'PUT',
			body: JSON.stringify(reservationBody(draft))
		})
	},

	async deleteReservation(id: string): Promise<void> {
		await request(`/reservas/${encodeURIComponent(id)}`, { method: 'DELETE' })
	},

	async addAnnotation(reservationId: string, content: string): Promise<Annotation> {
		const result = await request<{ id: number }>('/anotaciones', {
			method: 'POST',
			body: JSON.stringify({ reservaId: Number(reservationId), contenido: content.trim() })
		})
		return { id: String(result.id), content: content.trim() }
	},

	async deleteAnnotation(id: string): Promise<void> {
		await request(`/anotaciones/${encodeURIComponent(id)}`, { method: 'DELETE' })
	},

	getCalendarSettings(): Promise<CalendarRoomSettings[]> {
		return request<CalendarRoomSettings[]>('/calendarios/config')
	},

	saveCalendarSource(casaId: number, fuente: 'booking' | 'airbnb', url: string): Promise<void> {
		return request('/calendarios/config', {
			method: 'PUT',
			body: JSON.stringify({ casaId, fuente, url: url.trim() })
		})
	},

	syncCalendarSource(casaId: number, fuente: 'booking' | 'airbnb'): Promise<void> {
		return request('/calendarios/sync', {
			method: 'POST',
			body: JSON.stringify({ casaId, fuente })
		})
	},

	getPushPublicKey(): Promise<{ publicKey: string }> {
		return request<{ publicKey: string }>('/push/public-key')
	},

	savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
		return request('/push/subscriptions', {
			method: 'POST',
			body: JSON.stringify(subscription)
		})
	},

	deletePushSubscription(endpoint: string): Promise<void> {
		return request('/push/subscriptions', {
			method: 'DELETE',
			body: JSON.stringify({ endpoint })
		})
	}
}
