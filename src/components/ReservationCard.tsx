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
    <View className="mb-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800">
            {reservation.name}
          </Text>
          <View className="flex-row items-center mt-1 mb-2">
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text className="text-sm text-gray-500 ml-1 capitalize">
              {formatDate(reservation.startDate)} -{' '}
              {formatDate(reservation.endDate)}
            </Text>
          </View>
          <View className="flex-row items-center flex-wrap">
            <Text className="text-sm text-gray-500 mr-2">
              👥 {reservation.peopleCount} personas
            </Text>
            <Text className="text-sm text-gray-400">
              • 🏠 {reservation.room}
            </Text>
          </View>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-sm font-bold text-gray-900">
              Total: ${reservation.totalPrice.toFixed(2)}
            </Text>
            <View className={`rounded-full px-3 py-1 ${statusColor}`}>
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
      <View className="mt-4 border-t border-gray-100 pt-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
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
            <Text className="text-blue-500 text-xs font-medium ml-1">
              {isAddingNote ? 'Cancelar' : 'Agregar'}
            </Text>
          </TouchableOpacity>
        </View>

        {isAddingNote && (
          <View className="flex-row items-center mb-3">
            <TextInput
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mr-2"
              placeholder="Escribe una nota..."
              value={newAnnotation}
              onChangeText={setNewAnnotation}
              onSubmitEditing={handleAddAnnotation}
            />
            <TouchableOpacity
              onPress={handleAddAnnotation}
              className="bg-blue-500 p-2 rounded-lg"
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
                className="bg-yellow-50 rounded-lg p-3 border border-yellow-100 flex-row justify-between items-start"
              >
                <Text className="text-sm text-gray-700 flex-1 mr-2">
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
            <Text className="text-xs text-gray-400 italic">
              No hay anotaciones
            </Text>
          )
        )}
      </View>
    </View>
  )
}
