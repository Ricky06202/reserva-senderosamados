import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from 'react-native-calendars'
import { apiClient } from '../api/client'
import { ApiRoom } from '../api/types'
import { useNavigation } from '@react-navigation/native'

export const AddReservationScreen = () => {
  const navigation = useNavigation()
  const [formData, setFormData] = useState({
    name: '',
    room: '',
    roomId: null as number | null,
    peopleCount: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Mañana
    totalPrice: '',
    amountPaid: '',
    isPaid: false,
    bookingCommission: '',
    isCommissionPaid: false,
  })

  const [rooms, setRooms] = useState<ApiRoom[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const { width } = useWindowDimensions()
  const isLargeScreen = width > 768

  useEffect(() => {
    const fetchRooms = async () => {
      const data = await apiClient.getRooms()
      setRooms(data)
    }
    fetchRooms()
  }, [])

  const getRoomSelectionColor = (id: number, name: string) => {
    const n = (name || '').toLowerCase()
    if (id === 1 || n.includes('casa 1')) return 'bg-blue-500 border-blue-500'
    if (id === 2 || n.includes('casa 2'))
      return 'bg-orange-500 border-orange-500'
    if (id === 3 || n.includes('casa 3')) return 'bg-green-600 border-green-600'
    return 'bg-teal-600 border-teal-600'
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (
      !formData.name ||
      !formData.roomId ||
      !formData.peopleCount ||
      !formData.totalPrice
    ) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos')
      return
    }

    setSaving(true)
    const success = await apiClient.createReservation({
      name: formData.name,
      room: formData.room,
      roomId: formData.roomId as number,
      peopleCount: Number(formData.peopleCount),
      startDate: formData.startDate,
      endDate: formData.endDate,
      totalPrice: Number(formData.totalPrice),
      amountPaid: Number(formData.amountPaid || 0),
      status: formData.isPaid ? 'pagado' : 'por cobrar', // Mantener compatibilidad de tipos
      statusId: formData.isPaid ? 2 : 1, // ID: 2 (pagado), 1 (por cobrar)
      bookingCommission: Number(formData.bookingCommission || 0),
      bookingCommissionStatus: formData.isCommissionPaid ? 'pagado' : 'pendiente',
    })
    setSaving(false)

    if (success) {
      setFormData({
        name: '',
        room: '',
        roomId: null,
        peopleCount: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        totalPrice: '',
        amountPaid: '',
        isPaid: false,
        bookingCommission: '',
        isCommissionPaid: false,
      })
      setTempStartDate('')
      setTempEndDate('')
      Alert.alert('Éxito', 'Reserva creada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ])
    } else {
      Alert.alert('Error', 'No se pudo guardar la reserva. Intenta de nuevo.')
    }
  }

  const onDayPress = (day: any) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(day.dateString)
      setTempEndDate('')
    } else if (tempStartDate && !tempEndDate) {
      if (day.dateString < tempStartDate) {
        setTempStartDate(day.dateString)
      } else {
        setTempEndDate(day.dateString)
      }
    }
  }

  const getMarkedDates = () => {
    if (!tempStartDate) return {}

    // Si solo hay fecha de inicio
    if (!tempEndDate) {
      return {
        [tempStartDate]: {
          startingDay: true,
          color: '#3B82F6',
          textColor: 'white',
          endingDay: true,
        },
      }
    }

    const marks: any = {}

    // ESTRATEGIA: Usar "mediodía" (12:00) para evitar problemas de huso horario al restar horas.
    // parseISO a veces puede interpretar medianoche y si hay offset, restar un día.
    // Dividir el string manualmente es lo más seguro.

    const [startYear, startMonth, startDay] = tempStartDate
      .split('-')
      .map(Number)
    const [endYear, endMonth, endDay] = tempEndDate.split('-').map(Number)

    // Crear fechas a las 12:00 del día local
    const current = new Date(startYear, startMonth - 1, startDay, 12, 0, 0)
    const end = new Date(endYear, endMonth - 1, endDay, 12, 0, 0)

    while (current <= end) {
      // Formatear manualmente o con date-fns, pero asegurando mostrar la fecha local
      // Como estamos a medio día, conversion a ISO string podría dar el día correcto o no dependiendo de UTC.
      // Mejor usamos los getters locales.

      const year = current.getFullYear()
      const month = String(current.getMonth() + 1).padStart(2, '0')
      const day = String(current.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const isStart = dateStr === tempStartDate
      const isEnd = dateStr === tempEndDate

      marks[dateStr] = {
        selected: true,
        color: '#BFDBFE',
        textColor: '#1E3A8A',
        ...(isStart && {
          startingDay: true,
          color: '#3B82F6',
          textColor: 'white',
        }),
        ...(isEnd && { endingDay: true, color: '#3B82F6', textColor: 'white' }),
      }

      current.setDate(current.getDate() + 1)
    }

    return marks
  }

  const openCalendar = () => {
    setTempStartDate(formData.startDate)
    setTempEndDate(formData.endDate)
    setShowCalendar(true)
  }

  const confirmDates = () => {
    if (tempStartDate && tempEndDate) {
      updateField('startDate', tempStartDate)
      updateField('endDate', tempEndDate)
      setShowCalendar(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <View className={`flex-1 ${isLargeScreen ? 'max-w-[1200px] w-full mx-auto shadow-2xl bg-gray-50' : 'bg-gray-50'}`}>
        <View className="px-5 py-4 border-b border-gray-200 bg-white">
          <Text className="text-xl font-bold text-gray-900">Nueva Reserva</Text>
        </View>

        <ScrollView className="flex-1">
          <View className={`p-6 ${isLargeScreen ? 'flex-row flex-wrap justify-center' : ''}`}>
            <View className={isLargeScreen ? 'w-full max-w-4xl flex-row flex-wrap' : ''}>
              {/* Columna Izquierda (Web) / Arriba (Mobile) */}
              <View className={isLargeScreen ? 'w-1/2 pr-4' : 'w-full'}>
                {/* Nombre del Cliente */}
                <View className="mb-4">
                  <Text className="text-gray-700 font-semibold mb-2">
                    Nombre del Cliente
                  </Text>
                  <TextInput
                    className="bg-white border border-gray-300 rounded-lg p-3 text-gray-800"
                    placeholder="Ej. Familia Pérez"
                    value={formData.name}
                    onChangeText={(text) => updateField('name', text)}
                  />
                </View>

                {/* Habitación */}
                <View className="mb-4">
                  <Text className="text-gray-700 font-semibold mb-2">
                    Habitación / Cabaña
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {rooms.length > 0 ? (
                      rooms.map((roomItem) => (
                        <TouchableOpacity
                          key={roomItem.id}
                          onPress={() => {
                            updateField('room', roomItem.nombre)
                            updateField('roomId', roomItem.id)
                          }}
                          className={`px-4 py-2 rounded-full border ${
                            formData.roomId === roomItem.id
                              ? getRoomSelectionColor(
                                  roomItem.id,
                                  roomItem.nombre
                                )
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          <Text
                            className={`font-medium ${
                              formData.roomId === roomItem.id
                                ? 'text-white'
                                : 'text-gray-700'
                            }`}
                          >
                            {roomItem.nombre}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="text-gray-500 italic">
                        Cargando habitaciones...
                      </Text>
                    )}
                  </View>
                </View>

                {/* Fechas */}
                <View className="mb-6">
                  <Text className="text-gray-700 font-semibold mb-2">
                    Periodo de Reserva
                  </Text>
                  <TouchableOpacity
                    className="bg-white border border-gray-300 rounded-lg p-4 flex-row justify-between items-center"
                    onPress={openCalendar}
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#6B7280"
                      />
                      <Text className="text-gray-800 ml-2 font-medium">
                        {format(parseISO(formData.startDate), 'dd MMM', {
                          locale: es,
                        })}{' '}
                        -{' '}
                        {format(parseISO(formData.endDate), 'dd MMM yyyy', {
                          locale: es,
                        })}
                      </Text>
                    </View>
                    <Text className="text-blue-500 font-bold text-xs">
                      CAMBIAR
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Columna Derecha (Web) / Abajo (Mobile) */}
              <View className={isLargeScreen ? 'w-1/2 pl-4' : 'w-full'}>
                {/* Personas y Precio (Fila) */}
                <View className="flex-row justify-between mb-4">
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Personas
                    </Text>
                    <TextInput
                      className="bg-white border border-gray-300 rounded-lg p-3 text-gray-800"
                      placeholder="0"
                      keyboardType="numeric"
                      value={formData.peopleCount}
                      onChangeText={(text) =>
                        updateField('peopleCount', text.replace(/[^0-9]/g, ''))
                      }
                    />
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Precio Total ($)
                    </Text>
                    <TextInput
                      className="bg-white border border-gray-300 rounded-lg p-3 text-gray-800"
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={formData.totalPrice}
                      onChangeText={(text) => updateField('totalPrice', text)}
                    />
                  </View>
                </View>

                {/* Pago y Saldo (Fila) */}
                <View className="flex-row justify-between mb-4">
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Monto Pagado (Abono)
                    </Text>
                    <TextInput
                      className="bg-white border border-gray-300 rounded-lg p-3 text-gray-800"
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={formData.amountPaid}
                      onChangeText={(text) => updateField('amountPaid', text)}
                    />
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Saldo Pendiente
                    </Text>
                    <View className="bg-gray-100 border border-gray-200 rounded-lg p-3 h-[50px] justify-center">
                      <Text className="text-gray-800 font-bold">
                        ${' '}
                        {(
                          Number(formData.totalPrice || 0) -
                          Number(formData.amountPaid || 0)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Comisión Booking */}
                <View className="flex-row justify-between mb-4">
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Comisión Booking ($)
                    </Text>
                    <TextInput
                      className="bg-white border border-gray-300 rounded-lg p-3 text-gray-800"
                      placeholder="0.00"
                      keyboardType="numeric"
                      value={formData.bookingCommission}
                      onChangeText={(text) =>
                        updateField('bookingCommission', text)
                      }
                    />
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-gray-700 font-semibold mb-2">
                      Estado Comisión
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        updateField(
                          'isCommissionPaid',
                          !formData.isCommissionPaid
                        )
                      }
                      className={`h-[50px] rounded-lg border p-3 items-center justify-center ${
                        formData.isCommissionPaid
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          formData.isCommissionPaid
                            ? 'text-white'
                            : 'text-gray-700'
                        }`}
                      >
                        {formData.isCommissionPaid ? 'PAGADO' : 'PENDIENTE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Estado de Pago */}
                <View className="mb-8 flex-row items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
                  <View>
                    <Text className="text-gray-700 font-semibold">
                      Estado de Pago
                    </Text>
                    <Text
                      className={`text-xs font-bold mt-1 ${formData.isPaid ? 'text-green-600' : 'text-yellow-600'}`}
                    >
                      {formData.isPaid ? 'PAGADO' : 'POR COBRAR'}
                    </Text>
                  </View>
                  <Switch
                    value={formData.isPaid}
                    onValueChange={(val) => updateField('isPaid', val)}
                    trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
                    thumbColor={formData.isPaid ? '#22C55E' : '#F3F4F6'}
                  />
                </View>
              </View>

              {/* Botón Guardar - Centrado en Web */}
              <View className={`w-full ${isLargeScreen ? 'items-center mt-4' : ''}`}>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  className={`bg-blue-600 rounded-xl py-4 items-center shadow-md ${isLargeScreen ? 'w-full max-w-md' : 'w-full'} ${saving ? 'opacity-50' : 'active:bg-blue-700'}`}
                >
                  <Text className="text-white font-bold text-lg">
                    {saving ? 'Guardando...' : 'Guardar Reserva'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Calendar Modal */}
      {showCalendar && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center z-50 p-4">
          <View className="bg-white rounded-2xl w-full p-4 shadow-xl">
            <Text className="text-lg font-bold text-center mb-4 text-gray-800">
              Seleccionar Fechas
            </Text>

            <Calendar
              markingType={'period'}
              markedDates={getMarkedDates()}
              onDayPress={onDayPress}
              renderArrow={(direction: string) => (
                <Ionicons
                  name={
                    direction === 'left' ? 'chevron-back' : 'chevron-forward'
                  }
                  size={24}
                  color="#3B82F6"
                />
              )}
              theme={{
                todayTextColor: '#3B82F6',
                arrowColor: '#3B82F6',
                textMonthFontWeight: 'bold',
              }}
            />

            <View className="flex-row justify-end mt-4 gap-4">
              <TouchableOpacity
                onPress={() => setShowCalendar(false)}
                className="p-2"
              >
                <Text className="text-gray-500 font-medium">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDates}
                className="bg-blue-600 px-6 py-2 rounded-lg"
              >
                <Text className="text-white font-bold">Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}
