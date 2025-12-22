import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { HomeScreen } from './src/screens/HomeScreen'
import { AddReservationScreen } from './src/screens/AddReservationScreen'
import { StatusBar } from 'expo-status-bar'
import './global.css'
import { Ionicons } from '@expo/vector-icons'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'

SplashScreen.preventAutoHideAsync()

const Tab = createBottomTabNavigator()

export default function App() {
  const [loaded, error] = Font.useFonts({
    ...Ionicons.font,
  })

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync()
    }
  }, [loaded, error])

  if (!loaded && !error) {
    return null
  }
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'calendar'

            if (route.name === 'Calendario') {
              iconName = focused ? 'calendar' : 'calendar-outline'
            } else if (route.name === 'Nueva Reserva') {
              iconName = focused ? 'add-circle' : 'add-circle-outline'
            }

            return <Ionicons name={iconName} size={size} color={color} />
          },
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen name="Calendario" component={HomeScreen} />
        <Tab.Screen name="Nueva Reserva" component={AddReservationScreen} />
      </Tab.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  )
}
