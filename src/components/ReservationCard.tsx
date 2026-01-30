import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Reservation } from '../data/reservations'
import { useState } from 'react'

interface Props {
  reservation: Reservation
  onDelete?: (id: string) => void
  onEdit?: (id: string) => void
  onAddAnnotation?: (id: string, content: string) => void
  onDeleteAnnotation?: (annotationId: string) => void
}

export const ReservationCard = ({
  reservation,
  onDelete,
  onEdit,
  onAddAnnotation,
  onDeleteAnnotation,
}: Props) => {
  const [newAnnotation, setNewAnnotation] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  const statusColor =
    {
      pagado: 'bg-green-100 text-green-800',
      'por cobrar': 'bg-yellow-100 text-yellow-800',
    }[reservation.status] || 'bg-gray-100 text-gray-800'

  const getRoomColor = () => {
    const rName = (reservation.room || '').toLowerCase()
    const rId = reservation.roomId

    if (rId === 1 || rName.includes('casa 1')) {
      return 'bg-blue-100 text-blue-800'
    } else if (rId === 2 || rName.includes('casa 2')) {
      return 'bg-orange-100 text-orange-800'
    } else if (rId === 3 || rName.includes('casa 3')) {
      return 'bg-green-100 text-green-800'
    } else {
      return 'bg-gray-100 text-gray-600'
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return format(date, "d 'de' MMM", { locale: es })
  }

  const handleAddAnnotation = () => {
    if (newAnnotation.trim() && onAddAnnotation) {
      onAddAnnotation(reservation.id, newAnnotation)
      setNewAnnotation('')
      setIsAddingNote(false)
    }
  }

  return (
    <View className="p-4 mb-3 bg-white rounded-xl border border-gray-100 shadow-sm">
      <View className="flex-row justify-between items-center">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">
            {reservation.name}
          </Text>
          <View className="flex-row items-center mt-1 mb-2">
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text className="ml-1 text-sm text-gray-500 capitalize">
              {formatDate(reservation.startDate)} -{' '}
              {formatDate(reservation.endDate)}
            </Text>
          </View>
          <View className="flex-row flex-wrap items-center">
            <Text className="mr-2 text-sm text-gray-500">
              👥 {reservation.peopleCount} personas
            </Text>
            <View className={`rounded-md px-2 py-0.5 ${getRoomColor()}`}>
              <Text className="text-xs font-medium">🏠 {reservation.room}</Text>
            </View>
          </View>
          <View className="pt-2 mt-2 border-t border-gray-100">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-gray-500">Total Hospedaje:</Text>
              <Text className="text-sm font-bold text-gray-900">
                ${reservation.totalPrice.toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-xs text-gray-500">Abonado:</Text>
              <Text className="text-sm font-bold text-green-600">
                ${(reservation.amountPaid || 0).toFixed(2)}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-500">Saldo Pendiente:</Text>
              <Text className="text-sm font-bold text-red-600">
                ${(reservation.totalPrice - (reservation.amountPaid || 0)).toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between items-center mt-3">
            <View className="flex-row items-center">
              {reservation.bookingCommission !== undefined &&
                reservation.bookingCommission > 0 && (
                  <View
                    className={`rounded-md px-1.5 py-0.5 ${
                      reservation.bookingCommissionStatus === 'pagado'
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-red-50 border border-red-100'
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${
                        reservation.bookingCommissionStatus === 'pagado'
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}
                    >
                      Comisión BK: ${reservation.bookingCommission.toFixed(2)}
                    </Text>
                  </View>
                )}
            </View>
            <View className={`px-3 py-1 rounded-full ${statusColor}`}>
              <Text className="text-xs font-medium capitalize">
                {reservation.status}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center pl-2">
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(reservation.id)}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="pencil-outline" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(reservation.id)}
              className="p-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Seccion de Anotaciones */}
      <View className="pt-3 mt-4 border-t border-gray-100">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-xs font-bold tracking-wider text-gray-500 uppercase">
            Anotaciones
          </Text>
          <TouchableOpacity
            onPress={() => setIsAddingNote(!isAddingNote)}
            className="flex-row items-center"
          >
            <Ionicons
              name={isAddingNote ? 'close' : 'add'}
              size={16}
              color="#3B82F6"
            />
            <Text className="ml-1 text-xs font-medium text-blue-500">
              {isAddingNote ? 'Cancelar' : 'Agregar'}
            </Text>
          </TouchableOpacity>
        </View>

        {isAddingNote && (
          <View className="flex-row items-center mb-3">
            <TextInput
              className="flex-1 px-3 py-2 mr-2 text-sm bg-gray-50 rounded-lg border border-gray-200"
              placeholder="Escribe una nota..."
              value={newAnnotation}
              onChangeText={setNewAnnotation}
              onSubmitEditing={handleAddAnnotation}
            />
            <TouchableOpacity
              onPress={handleAddAnnotation}
              className="p-2 bg-blue-500 rounded-lg"
              disabled={!newAnnotation.trim()}
            >
              <Ionicons name="arrow-up" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {reservation.anotaciones && reservation.anotaciones.length > 0 ? (
          <View className="gap-2">
            {reservation.anotaciones.map((nota) => (
              <View
                key={nota.id}
                className="flex-row justify-between items-start p-3 bg-yellow-50 rounded-lg border border-yellow-100"
              >
                <Text className="flex-1 mr-2 text-sm text-gray-700">
                  {nota.content}
                </Text>
                {onDeleteAnnotation && (
                  <TouchableOpacity
                    onPress={() => onDeleteAnnotation(nota.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        ) : (
          !isAddingNote && (
            <Text className="text-xs italic text-gray-400">
              No hay anotaciones
            </Text>
          )
        )}
      </View>
    </View>
  )
}
