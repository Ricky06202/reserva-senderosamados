export interface Annotation {
  id: string
  content: string
}

export interface Reservation {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  peopleCount: number
  room: string
  totalPrice: number
  status: 'pagado' | 'por cobrar'
  roomId?: number
  statusId?: number
  anotaciones?: Annotation[]
}

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: '1',
    name: 'Fam. Rodriguez',
    startDate: '2025-12-24',
    endDate: '2025-12-26',
    peopleCount: 4,
    room: 'Cabaña del Río',
    totalPrice: 150.0,
    status: 'pagado',
  },
  {
    id: '4',
    name: 'Sanjur',
    startDate: '2025-12-25',
    endDate: '2025-12-27',
    peopleCount: 4,
    room: 'Casa 2',
    totalPrice: 150.0,
    status: 'por cobrar',
  },
  {
    id: '5',
    name: 'Eysbel',
    startDate: '2025-12-25',
    endDate: '2025-12-26',
    peopleCount: 4,
    room: 'Cabaña del Río',
    totalPrice: 150.0,
    status: 'pagado',
  },
  {
    id: '2',
    name: 'Senderismo PTY',
    startDate: '2025-12-28',
    endDate: '2025-12-29',
    peopleCount: 12,
    room: 'Camping Area A',
    totalPrice: 450.5,
    status: 'por cobrar',
  },
  {
    id: '3',
    name: 'Juan Perez',
    startDate: '2025-12-31',
    endDate: '2026-01-02',
    peopleCount: 2,
    room: 'Suite Panorámica',
    totalPrice: 320.0,
    status: 'pagado',
  },
]
