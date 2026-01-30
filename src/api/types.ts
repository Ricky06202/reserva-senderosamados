export interface ApiAnnotation {
  id: number
  reservaId: number
  contenido: string
  createdAt?: string
}

export interface ApiReservation {
  id: number
  nombre: string
  casa: string
  cantPersonas: number
  estado: string
  total: string
  abono?: string
  fechaInicio: string
  fechaFin: string
  casaId: number
  estadoId: number
  comisionBooking?: string
  estadoComision?: string
  anotaciones?: ApiAnnotation[]
}

export interface ApiRoom {
  id: number
  nombre: string
}

export interface ApiStatus {
  id: number
  nombre: string
}
