<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte'
	import {
		calendarDays,
		dateKey,
		formatLongDate,
		isSameMonth,
		monthLabel,
		todayKey,
		weekdays
	} from './dates'
	import type { Reservation } from './types'

	interface Props {
		cursor: Date
		selectedDate: string
		reservations: Reservation[]
		roomFilter: string
		onSelectDate: (date: string) => void
		onPreviousMonth: () => void
		onNextMonth: () => void
	}

	let {
		cursor,
		selectedDate,
		reservations,
		roomFilter,
		onSelectDate,
		onPreviousMonth,
		onNextMonth
	}: Props = $props()

	const days = $derived(calendarDays(cursor))
	const heading = $derived(monthLabel(cursor))
	const weekdayLabels = weekdays()
	const today = todayKey()

	function roomColor(roomId: number | null): string {
		if (roomId === 1) return '#477b54'
		if (roomId === 2) return '#bd7440'
		if (roomId === 3) return '#628293'
		return '#807f59'
	}

	function dayReservations(day: Date): Reservation[] {
		const key = dateKey(day)
		return reservations.filter((reservation) => {
			if (roomFilter !== 'all' && String(reservation.roomId) !== roomFilter) return false
			return key >= reservation.startDate && key < reservation.endDate
		})
	}
</script>

<section class="calendar card" aria-labelledby="calendar-heading">
	<header class="calendar-header">
		<div>
			<p class="eyebrow">Disponibilidad</p>
			<h2 id="calendar-heading">{heading}</h2>
		</div>
		<div class="month-controls" aria-label="Cambiar de mes">
			<button class="icon-button" type="button" aria-label="Mes anterior" onclick={onPreviousMonth}>
				<ChevronLeft size={19} aria-hidden="true" />
			</button>
			<button class="icon-button" type="button" aria-label="Mes siguiente" onclick={onNextMonth}>
				<ChevronRight size={19} aria-hidden="true" />
			</button>
		</div>
	</header>

	<div class="calendar-weekdays" aria-hidden="true">
		{#each weekdayLabels as weekday, index (index)}
			<span>{weekday}</span>
		{/each}
	</div>

	<div class="calendar-grid" role="group" aria-label="Días del mes">
		{#each days as day (dateKey(day))}
			{@const key = dateKey(day)}
			{@const occupied = dayReservations(day)}
			<button
				class="day-cell"
				class:outside={!isSameMonth(day, cursor)}
				class:selected={selectedDate === key}
				class:today={today === key}
				class:has-reservations={occupied.length > 0}
				type="button"
				aria-pressed={selectedDate === key}
				aria-label={`${formatLongDate(key)}${occupied.length ? `, ${occupied.length} reserva${occupied.length === 1 ? '' : 's'}` : ', sin reservas'}`}
				onclick={() => onSelectDate(key)}
			>
				<span class="day-number">{day.getDate()}</span>
				{#if occupied.length > 0}
					<span class="day-indicators" aria-hidden="true">
						{#each [...new Set(occupied.map((reservation) => reservation.roomId))].slice(0, 3) as roomId (roomId)}
							<span class="room-dot" style={`--room-color:${roomColor(roomId)}`}></span>
						{/each}
					</span>
					<span class="sr-only">{occupied.length} reserva{occupied.length === 1 ? '' : 's'}</span>
				{/if}
			</button>
		{/each}
	</div>

	<footer class="calendar-legend" aria-label="Leyenda">
		<span><i class="legend-mark legend-green"></i>Casa 1</span>
		<span><i class="legend-mark legend-amber"></i>Casa 2</span>
		<span><i class="legend-mark legend-blue"></i>Casa 3</span>
	</footer>
</section>

<style>
	.calendar {
		padding: 22px;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}

	.calendar-header .eyebrow {
		margin-bottom: 3px;
	}

	h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 25px;
		font-weight: 600;
		text-transform: capitalize;
		letter-spacing: -0.02em;
	}

	.month-controls {
		display: flex;
		gap: 8px;
	}

	.calendar-weekdays,
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.calendar-weekdays {
		margin-bottom: 7px;
		color: #78877b;
		font-size: 12px;
		font-weight: 700;
		text-align: center;
		text-transform: uppercase;
	}

	.calendar-weekdays span {
		padding: 4px 0;
	}

	.calendar-grid {
		gap: 5px;
	}

	.day-cell {
		position: relative;
		display: flex;
		min-width: 0;
		min-height: 70px;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		border: 1px solid transparent;
		border-radius: 12px;
		padding: 9px 2px 6px;
		background: transparent;
		cursor: pointer;
		transition: border-color 150ms ease, background-color 150ms ease;
	}

	.day-cell:hover {
		border-color: #dce8d8;
		background: #f7faf5;
	}

	.day-cell.outside {
		color: #a6b0a7;
	}

	.day-cell.today .day-number {
		border: 1px solid #a6c4a8;
		color: var(--forest);
	}

	.day-cell.selected {
		border-color: var(--forest);
		background: var(--forest);
		color: #fff;
	}

	.day-cell.selected.today .day-number {
		color: #fff;
	}

	.day-number {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border: 1px solid transparent;
		border-radius: 50%;
		font-size: 14px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.day-indicators {
		display: flex;
		min-height: 7px;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.room-dot,
	.legend-mark {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--room-color, var(--forest));
	}

	.calendar-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid #edf1eb;
		color: var(--muted);
		font-size: 12px;
	}

	.calendar-legend span {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.legend-mark {
		width: 8px;
		height: 8px;
	}

	.legend-green {
		background: #477b54;
	}

	.legend-amber {
		background: #bd7440;
	}

	.legend-blue {
		background: #628293;
	}

	@media (max-width: 640px) {
		.calendar {
			padding: 16px 12px 14px;
		}

		h2 {
			font-size: 22px;
		}

		.calendar-header {
			margin-bottom: 13px;
		}

		.calendar-grid {
			gap: 2px;
		}

		.day-cell {
			min-height: 56px;
			gap: 2px;
			border-radius: 10px;
			padding: 4px 1px;
		}

		.day-number {
			width: 29px;
			height: 29px;
			font-size: 13px;
		}

		.calendar-weekdays {
			font-size: 10px;
		}

		.calendar-legend {
			gap: 10px;
			margin-top: 13px;
			padding-top: 11px;
			font-size: 11px;
		}
	}
</style>
