export interface ApiReservation {
  id: number
  nombre: string
  casa: string
  cantPersonas: number
  estado: string
  total: string
  fechaInicio: string
  fechaFin: string
}

export interface ApiRoom {
  id: number
  nombre: string
}

export interface ApiStatus {
  id: number
  nombre: string
}
