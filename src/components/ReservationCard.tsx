import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Reservation } from '../data/reservations'

interface Props {
  reservation: Reservation
  onDelete?: (id: string) => void
}

export const ReservationCard = ({ reservation, onDelete }: Props) => {
  const statusColor =
    {
      pagado: 'bg-green-100 text-green-800',
      'por cobrar': 'bg-yellow-100 text-yellow-800',
    }[reservation.status] || 'bg-gray-100 text-gray-800'

  return (
    <View className="mb-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-lg font-bold text-gray-800">
          {reservation.name}
        </Text>
        <View className="flex-row items-center flex-wrap">
          <Text className="text-sm text-gray-500 mr-2">
            👥 {reservation.peopleCount} personas
          </Text>
          <Text className="text-sm text-gray-400">• 🏠 {reservation.room}</Text>
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

      {onDelete && (
        <TouchableOpacity
          onPress={() => {
            console.log(
              '--- Botón eliminar presionado para ID:',
              reservation.id
            )
            onDelete(reservation.id)
          }}
          className="p-3 -m-1"
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  )
}
