import { ApiReservation, ApiRoom, ApiStatus } from './types'
import { Annotation, Reservation } from '../data/reservations'

const API_URL = 'https://api-reservas-senderosamados.rsanjur.com'

export const apiClient = {
  getReservations: async (): Promise<Reservation[]> => {
    try {
      const response = await fetch(`${API_URL}/reservas`)
      if (!response.ok) throw new Error('Network response was not ok')

      const data: ApiReservation[] = await response.json()

      return data.map((item) => ({
        id: String(item.id),
        name: item.nombre,
        room: item.casa,
        peopleCount: item.cantPersonas,
        status: item.estado === 'pagado' ? 'pagado' : 'por cobrar',
        totalPrice: parseFloat(item.total),
        amountPaid: item.abono ? parseFloat(item.abono) : 0,
        startDate: item.fechaInicio.split('T')[0],
        endDate: item.fechaFin.split('T')[0],
        roomId: item.casaId,
        statusId: item.estadoId,
        bookingCommission: item.comisionBooking
          ? parseFloat(item.comisionBooking)
          : 0,
        bookingCommissionStatus:
          (item.estadoComision as 'pagado' | 'pendiente') || 'pendiente',
        anotaciones: item.anotaciones?.map((a) => ({
          id: String(a.id),
          content: a.contenido,
        })),
      }))
    } catch (error) {
      console.error('Error fetching reservations:', error)
      return []
    }
  },

  getRooms: async (): Promise<ApiRoom[]> => {
    try {
      const response = await fetch(`${API_URL}/casas`)
      if (!response.ok) throw new Error('Network response was not ok')
      return await response.json()
    } catch (error) {
      console.error('Error fetching rooms:', error)
      return []
    }
  },

  getStatuses: async (): Promise<ApiStatus[]> => {
    try {
      const response = await fetch(`${API_URL}/estados`)
      if (!response.ok) throw new Error('Network response was not ok')
      return await response.json()
    } catch (error) {
      console.error('Error fetching statuses:', error)
      return []
    }
  },

  createReservation: async (
    reservation: Omit<Reservation, 'id'> & {
      statusId?: number
      roomId?: number
    }
  ): Promise<boolean> => {
    try {
      const body = {
        nombre: reservation.name,
        casaId: reservation.roomId, // Usamos el ID de la habitación
        cantPersonas: Number(reservation.peopleCount),
        estadoId: reservation.statusId, // Usamos el ID directamente
        total: String(reservation.totalPrice),
        abono: String(reservation.amountPaid || 0),
        fechaInicio: new Date(reservation.startDate).toISOString(),
        fechaFin: new Date(reservation.endDate).toISOString(),
        comisionBooking: String(reservation.bookingCommission || 0),
        estadoComision: reservation.bookingCommissionStatus || 'pendiente',
      }

      const response = await fetch(`${API_URL}/reservas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Error creating reservation')
      return true
    } catch (error) {
      console.error('Error creating reservation:', error)
      return false
    }
  },

  updateReservation: async (
    id: string,
    updates: Partial<Reservation> & { roomId?: number; statusId?: number }
  ): Promise<boolean> => {
    try {
      const body = {
        nombre: updates.name,
        casaId: updates.roomId,
        cantPersonas: updates.peopleCount
          ? Number(updates.peopleCount)
          : undefined,
        estadoId: updates.statusId,
        total: updates.totalPrice ? String(updates.totalPrice) : undefined,
        abono:
          updates.amountPaid !== undefined
            ? String(updates.amountPaid)
            : undefined,
        fechaInicio: updates.startDate
          ? new Date(updates.startDate).toISOString()
          : undefined,
        fechaFin: updates.endDate
          ? new Date(updates.endDate).toISOString()
          : undefined,
        comisionBooking:
          updates.bookingCommission !== undefined
            ? String(updates.bookingCommission)
            : undefined,
        estadoComision: updates.bookingCommissionStatus,
      }

      const response = await fetch(`${API_URL}/reservas/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Error updating reservation')
      return true
    } catch (error) {
      console.error('Error updating reservation:', error)
      return false
    }
  },

  deleteReservation: async (id: string): Promise<boolean> => {
    try {
      const url = `${API_URL}/reservas/${id}`
      console.log('Tentando borrar reserva en:', url)
      const response = await fetch(url, {
        method: 'DELETE',
      })
      console.log('Respuesta de borrado:', response.status)
      if (!response.ok)
        throw new Error(`Error deleting reservation: ${response.status}`)
      return true
    } catch (error) {
      console.error('Error deleting reservation:', error)
      return false
    }
  },

  addAnnotation: async (
    reservaId: string,
    contenido: string
  ): Promise<Annotation | null> => {
    try {
      const response = await fetch(`${API_URL}/anotaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reservaId: Number(reservaId), contenido }),
      })

      if (!response.ok) {
        throw new Error('Error creating annotation')
      }

      const data = await response.json()
      // data format based on user request: { message: '...', id: ... }
      return {
        id: String(data.id),
        content: contenido,
      }
    } catch (error) {
      console.error('Error creating annotation:', error)
      return null
    }
  },

  deleteAnnotation: async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/anotaciones/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Error deleting annotation')
      return true
    } catch (error) {
      console.error('Error deleting annotation:', error)
      return false
    }
  },
}
