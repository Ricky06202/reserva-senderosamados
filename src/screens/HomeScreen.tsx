import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from 'react-native'
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ReservationCard } from '../components/ReservationCard'
import { apiClient } from '../api/client'
import { ApiRoom, ApiStatus } from '../api/types'
import { Reservation } from '../data/reservations'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import { useFocusEffect } from '@react-navigation/native'

// Configurar idioma del calendario
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  monthNamesShort: [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ],
  dayNames: [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
}
LocaleConfig.defaultLocale = 'es'

type DayStatus = 'start' | 'middle' | 'end' | 'single'

interface DayMarking {
  reservation: Reservation
  status: DayStatus
  rowIndex: number
  color: string
}

const DayComponent = ({ date, state, marking, onPress }: any) => {
  const dayReservations: DayMarking[] = marking?.customMarks || []

  return (
    <TouchableOpacity
      onPress={() => onPress(date)}
      className="h-32 w-full items-center justify-start pt-1 overflow-visible z-10"
    >
      <Text
        className={`text-xs mb-0.5 ${state === 'disabled' ? 'text-gray-300' : 'text-gray-900'} z-30`}
      >
        {date.day}
      </Text>

      {dayReservations.map((mark, index) => {
        const { reservation, status, rowIndex, color } = mark

        let barStyle = 'h-8 justify-center absolute'
        let textStyle = 'text-[7px] text-white font-bold ml-1 leading-tight'
        const topPosition = 20 + rowIndex * 34

        if (status === 'start') barStyle += ' ml-1 rounded-l-md w-[130%] z-20'
        else if (status === 'middle') barStyle += ' w-[140%] -ml-[20%] z-10'
        else if (status === 'end')
          barStyle += ' mr-1 rounded-r-md w-[130%] -ml-[30%] z-20'
        else if (status === 'single') barStyle += ' mx-1 rounded-md z-20'

        return (
          <View
            key={`res-${reservation.id}-${date.dateString}`}
            className={`${barStyle} ${color}`}
            style={{ top: topPosition }}
          >
            {(status === 'start' || status === 'single') && (
              <View>
                <Text className={textStyle} numberOfLines={1}>
                  {reservation.name.split(' ')[0]} ({reservation.peopleCount})
                </Text>
                <Text className={textStyle} numberOfLines={1}>
                  {reservation.room}
                </Text>
                <Text className={textStyle} numberOfLines={1}>
                  ${reservation.totalPrice}
                </Text>
              </View>
            )}
          </View>
        )
      })}
    </TouchableOpacity>
  )
}

export const HomeScreen = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(
    null
  )

  // Edit State
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null)
  const [rooms, setRooms] = useState<ApiRoom[]>([])
  const [statuses, setStatuses] = useState<ApiStatus[]>([])
  const [editForm, setEditForm] = useState<{
    name: string
    roomId: number
    peopleCount: string
    statusId: number
    totalPrice: string
    startDate: string
    endDate: string
  }>({
    name: '',
    roomId: 0,
    peopleCount: '',
    statusId: 0,
    totalPrice: '',
    startDate: '',
    endDate: '',
  })

  const fetchReservations = useCallback(async () => {
    try {
      const data = await apiClient.getReservations()
      setReservations(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchMetadata = useCallback(async () => {
    try {
      const [roomsData, statusesData] = await Promise.all([
        apiClient.getRooms(),
        apiClient.getStatuses(),
      ])
      setRooms(roomsData)
      setStatuses(statusesData)
    } catch (error) {
      console.error('Error fetching metadata:', error)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      fetchReservations()
      fetchMetadata()
    }, [fetchReservations, fetchMetadata])
  )

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchReservations()
  }, [fetchReservations])

  // Algoritmo de 'Tetris' para asignar filas
  const markedDates = useMemo(() => {
    if (loading) return {}
    const marks: any = {}
    const sortedReservations = [...reservations].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )

    const dailyOccupancy: Record<string, number[]> = {}

    sortedReservations.forEach((res) => {
      const start = parseISO(res.startDate)
      const end = parseISO(res.endDate)
      const days = eachDayOfInterval({ start, end })
      const duration = days.length

      let assignedRow = 0
      let collision = true

      while (collision) {
        collision = false
        for (const day of days) {
          const dStr = format(day, 'yyyy-MM-dd')
          if (
            dailyOccupancy[dStr] &&
            dailyOccupancy[dStr].includes(assignedRow)
          ) {
            collision = true
            break
          }
        }
        if (collision) {
          assignedRow++
        }
      }

      const isPaid = res.status === 'pagado'
      const color = isPaid ? 'bg-green-500' : 'bg-yellow-500'

      days.forEach((day, index) => {
        const dateStr = format(day, 'yyyy-MM-dd')

        if (!dailyOccupancy[dateStr]) dailyOccupancy[dateStr] = []
        dailyOccupancy[dateStr].push(assignedRow)

        let status: DayStatus = 'middle'
        if (duration === 1) status = 'single'
        else if (index === 0) status = 'start'
        else if (index === duration - 1) status = 'end'

        const mark: DayMarking = {
          reservation: res,
          status,
          rowIndex: assignedRow,
          color,
        }

        if (!marks[dateStr]) marks[dateStr] = { customMarks: [] }
        marks[dateStr].customMarks.push(mark)
        marks[dateStr].marked = true
      })
    })

    return marks
  }, [reservations, loading])

  const selectedDateReservations = useMemo(() => {
    return reservations.filter((res) => {
      const start = res.startDate
      const end = res.endDate
      return selectedDate >= start && selectedDate <= end
    })
  }, [selectedDate, reservations])

  const upcomingReservations = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return reservations
      .filter((res) => res.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 3)
  }, [reservations])

  const handleDelete = useCallback((id: string) => {
    console.log('--- Abriendo modal para eliminar:', id)
    setReservationToDelete(id)
    setDeleteModalVisible(true)
  }, [])

  const confirmDelete = async () => {
    if (!reservationToDelete) return

    setLoading(true)
    const success = await apiClient.deleteReservation(reservationToDelete)
    setLoading(false)

    if (success) {
      setDeleteModalVisible(false)
      setReservationToDelete(null)
      fetchReservations()
    } else {
      Alert.alert('Error', 'No se pudo eliminar la reserva')
    }
  }

  const handleEdit = (id: string) => {
    const reservation = reservations.find((r) => r.id === id)
    if (!reservation) return

    setEditingReservation(reservation)
    setEditForm({
      name: reservation.name,
      roomId: reservation.roomId || 0,
      peopleCount: String(reservation.peopleCount),
      statusId: reservation.statusId || 0,
      totalPrice: String(reservation.totalPrice),
      startDate: reservation.startDate,
      endDate: reservation.endDate,
    })
    setEditModalVisible(true)
  }

  const handleUpdate = async () => {
    if (!editingReservation) return

    setLoading(true)
    const success = await apiClient.updateReservation(editingReservation.id, {
      name: editForm.name,
      roomId: editForm.roomId,
      peopleCount: Number(editForm.peopleCount),
      statusId: editForm.statusId,
      totalPrice: Number(editForm.totalPrice),
      startDate: editForm.startDate,
      endDate: editForm.endDate,
    })
    setLoading(false)

    if (success) {
      setEditModalVisible(false)
      setEditingReservation(null)
      fetchReservations()
      Alert.alert('Éxito', 'Reserva actualizada correctamente')
    } else {
      Alert.alert('Error', 'No se pudo actualizar la reserva')
    }
  }

  const handleAddAnnotation = async (reservaId: string, content: string) => {
    // Optimistic update
    const previousReservations = [...reservations]
    setReservations((current) =>
      current.map((res) => {
        if (res.id === reservaId) {
          return {
            ...res,
            anotaciones: [
              ...(res.anotaciones || []),
              { id: 'temp-' + Date.now(), content },
            ],
          }
        }
        return res
      })
    )

    const newAnnotation = await apiClient.addAnnotation(reservaId, content)

    if (newAnnotation) {
      // Update with real ID
      setReservations((current) =>
        current.map((res) => {
          if (res.id === reservaId) {
            return {
              ...res,
              anotaciones: res.anotaciones?.map((a) =>
                a.content === content && a.id.startsWith('temp-')
                  ? newAnnotation
                  : a
              ),
            }
          }
          return res
        })
      )
    } else {
      // Revert if failed
      setReservations(previousReservations)
      Alert.alert('Error', 'No se pudo agregar la anotación')
    }
  }

  const handleDeleteAnnotation = async (annotationId: string) => {
    // Optimistic update
    const previousReservations = [...reservations]
    setReservations((current) =>
      current.map((res) => ({
        ...res,
        anotaciones: res.anotaciones?.filter((a) => a.id !== annotationId),
      }))
    )

    const success = await apiClient.deleteAnnotation(annotationId)

    if (!success) {
      // Revert if failed
      setReservations(previousReservations)
      Alert.alert('Error', 'No se pudo eliminar la anotación')
    }
  }

  if (loading && !refreshing) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-gray-500">Cargando reservas...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-5 py-4">
          <Text className="text-2xl font-bold text-gray-900">
            Senderos Amados
          </Text>
          <Text className="text-gray-500">Gestión de Reservas</Text>
        </View>

        {/* Calendar */}
        <View className="mb-6 bg-white pb-2 shadow-sm">
          <Calendar
            firstDay={1}
            dayComponent={({ date, state, marking }: any) => (
              <DayComponent
                date={date}
                state={state}
                marking={marking}
                onPress={(d: DateData) => setSelectedDate(d.dateString)}
              />
            )}
            theme={{
              todayTextColor: '#3B82F6',
              arrowColor: '#3B82F6',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: 'bold',
            }}
            markedDates={markedDates}
          />
        </View>

        {/* Selected Date Info */}
        <View className="px-5 mb-6">
          <Text className="mb-3 text-lg font-bold text-gray-800">
            {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
          </Text>

          {selectedDateReservations.length > 0 ? (
            selectedDateReservations.map((res) => (
              <ReservationCard
                key={res.id}
                reservation={res}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onAddAnnotation={handleAddAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            ))
          ) : (
            <View className="rounded-xl border-dashed border-2 border-gray-200 p-6 items-center">
              <Text className="text-gray-400">
                Sin reservas activas este día
              </Text>
            </View>
          )}
        </View>

        {/* Upcoming Reservations */}
        <View className="px-5 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">
              Próximas Reservas
            </Text>
          </View>

          {upcomingReservations.map((res) => (
            <View key={`upcoming-${res.id}`} className="mb-2">
              <Text className="mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Del {format(parseISO(res.startDate), 'dd MMM', { locale: es })}{' '}
                al {format(parseISO(res.endDate), 'dd MMM', { locale: es })}
              </Text>
              <ReservationCard
                reservation={res}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onAddAnnotation={handleAddAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-white rounded-2xl w-full p-6 shadow-xl">
            <View className="items-center mb-4">
              <View className="bg-red-100 p-3 rounded-full mb-3">
                <Ionicons name="trash" size={30} color="#EF4444" />
              </View>
              <Text className="text-xl font-bold text-gray-900">
                ¿Eliminar reserva?
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                Esta acción no se puede deshacer. La reserva será eliminada de
                forma permanente.
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setDeleteModalVisible(false)}
                className="flex-1 bg-gray-100 py-3.5 rounded-xl items-center"
              >
                <Text className="text-gray-700 font-bold">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                className="flex-1 bg-red-500 py-3.5 rounded-xl items-center"
              >
                <Text className="text-white font-bold">Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Reservation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 h-[85%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900">
                Editar Reserva
              </Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Nombre */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Nombre del Cliente
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                  value={editForm.name}
                  onChangeText={(text) =>
                    setEditForm({ ...editForm, name: text })
                  }
                  placeholder="Nombre"
                />
              </View>

              {/* Habitación */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Habitación
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View className="flex-row gap-2">
                    {rooms.map((room) => (
                      <TouchableOpacity
                        key={room.id}
                        onPress={() =>
                          setEditForm({ ...editForm, roomId: room.id })
                        }
                        className={`px-4 py-3 rounded-xl border ${
                          editForm.roomId === room.id
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <Text
                          className={`font-semibold ${
                            editForm.roomId === room.id
                              ? 'text-white'
                              : 'text-gray-700'
                          }`}
                        >
                          {room.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Cantidad de Personas */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Personas
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                  value={editForm.peopleCount}
                  keyboardType="numeric"
                  onChangeText={(text) =>
                    setEditForm({ ...editForm, peopleCount: text })
                  }
                  placeholder="0"
                />
              </View>

              {/* Fechas */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Inicio (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                    value={editForm.startDate}
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, startDate: text })
                    }
                    placeholder="2025-01-01"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Fin (YYYY-MM-DD)
                  </Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800"
                    value={editForm.endDate}
                    onChangeText={(text) =>
                      setEditForm({ ...editForm, endDate: text })
                    }
                    placeholder="2025-01-02"
                  />
                </View>
              </View>

              {/* Estado */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Estado
                </Text>
                <View className="flex-row gap-3">
                  {statuses.map((status) => (
                    <TouchableOpacity
                      key={status.id}
                      onPress={() =>
                        setEditForm({ ...editForm, statusId: status.id })
                      }
                      className={`flex-1 py-3 rounded-xl border items-center ${
                        editForm.statusId === status.id
                          ? 'bg-blue-500 border-blue-500'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          editForm.statusId === status.id
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        {status.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Total */}
              <View className="mb-8">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Total ($)
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-800 text-lg font-semibold"
                  value={editForm.totalPrice}
                  keyboardType="numeric"
                  onChangeText={(text) =>
                    setEditForm({ ...editForm, totalPrice: text })
                  }
                  placeholder="0.00"
                />
              </View>

              <TouchableOpacity
                onPress={handleUpdate}
                className="bg-blue-500 py-4 rounded-xl items-center shadow-md shadow-blue-200 mb-8"
              >
                <Text className="text-white font-bold text-lg">
                  Guardar Cambios
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
