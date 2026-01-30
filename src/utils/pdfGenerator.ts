import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Reservation } from '../data/reservations'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Platform } from 'react-native'

export const generateBookingCommissionReport = async (
  reservations: Reservation[],
  startDate: string,
  endDate: string
) => {
  const filteredReservations = reservations.filter((res) => {
    return res.startDate >= startDate && res.startDate <= endDate
  })

  let totalComisionesPorPagar = 0
  let totalHospedaje = 0

  const rows = filteredReservations.length > 0 
    ? filteredReservations
        .map((res) => {
          const commission = res.bookingCommission || 0
          const isPaid = res.bookingCommissionStatus === 'pagado'
          
          if (!isPaid) {
            totalComisionesPorPagar += commission
          }
          totalHospedaje += res.totalPrice

          return `
          <tr>
            <td>${res.room}</td>
            <td>${format(parseISO(res.startDate), 'dd/MM/yyyy')} - ${format(parseISO(res.endDate), 'dd/MM/yyyy')}</td>
            <td>${res.name}</td>
            <td style="text-align: center;">${res.peopleCount}</td>
            <td style="text-align: right;">$${res.totalPrice.toFixed(2)}</td>
            <td style="text-align: right;">$${commission.toFixed(2)}</td>
            <td style="text-align: center; color: ${isPaid ? 'green' : 'red'};">
              ${isPaid ? 'Pagado' : 'Pendiente'}
            </td>
          </tr>
        `
        })
        .join('')
    : '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #6B7280;">No hay reservas registradas en este periodo.</td></tr>'

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #1E3A8A; }
          h2 { text-align: center; color: #4B5563; font-size: 16px; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
          th { background-color: #F3F4F6; color: #374151; font-weight: bold; padding: 10px; border: 1px solid #D1D5DB; text-align: left; }
          td { padding: 8px; border: 1px solid #D1D5DB; }
          .totals-container { margin-top: 20px; border-top: 2px solid #1E3A8A; padding-top: 15px; }
          .total-row { display: flex; justify-content: flex-end; margin-bottom: 5px; font-size: 14px; }
          .total-label { font-weight: bold; margin-right: 20px; color: #374151; }
          .total-value { font-weight: bold; color: #1E3A8A; width: 100px; text-align: right; }
          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9CA3AF; }
        </style>
      </head>
      <body>
        <h1>Informe de Comisiones Booking</h1>
        <h2>Senderos Amados</h2>
        <p style="text-align: center; font-size: 12px;">Periodo: ${format(parseISO(startDate), 'dd/MM/yyyy')} al ${format(parseISO(endDate), 'dd/MM/yyyy')}</p>
        
        <table>
          <thead>
            <tr>
              <th>Habitación</th>
              <th>Estadía</th>
              <th>Nombre</th>
              <th>Pax</th>
              <th>Total</th>
              <th>Comisión</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="total-row">
            <span class="total-label">Total Comisiones por Pagar:</span>
            <span class="total-value">$${totalComisionesPorPagar.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span class="total-label">Total Hospedaje:</span>
            <span class="total-value">$${totalHospedaje.toFixed(2)}</span>
          </div>
        </div>

        <div class="footer">
          Generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
        </div>
      </body>
    </html>
  `

  try {
    if (Platform.OS === 'web') {
      // En Web, a veces expo-print imprime la pantalla actual en lugar del HTML.
      // Usar una ventana nueva es más confiable para imprimir solo el reporte.
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        // Esperar un momento para que los estilos se apliquen
        setTimeout(() => {
          printWindow.print()
          // Opcionalmente cerrar la ventana después de imprimir
          // printWindow.close();
        }, 500)
      } else {
        // Fallback a expo-print si el popup está bloqueado
        await Print.printAsync({ html })
      }
    } else {
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' })
    }
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw error
  }
}
