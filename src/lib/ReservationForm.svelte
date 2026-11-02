<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { X } from 'lucide-svelte'
	import { addDays } from 'date-fns'
	import { dateKey, todayKey } from './dates'
	import type { ApiRoom, ApiStatus, Reservation, ReservationDraft } from './types'

	type NumericField = string | number | null

	interface FormState {
		name: string
		roomId: string
		peopleCount: NumericField
		startDate: string
		endDate: string
		totalPrice: NumericField
		amountPaid: NumericField
		isPaid: boolean
		bookingCommission: NumericField
		isCommissionPaid: boolean
	}

	interface Props {
		rooms: ApiRoom[]
		statuses: ApiStatus[]
		reservation: Reservation | null
		initialDate: string
		onSave: (draft: ReservationDraft) => Promise<void>
		onClose: () => void
	}

	let { rooms, statuses, reservation, initialDate, onSave, onClose }: Props = $props()
	let dialog: HTMLDialogElement
	let form = $state<FormState>(untrack(() => createForm(reservation, initialDate)))
	let saving = $state(false)
	let errorMessage = $state('')

	const needsPeopleDetails = $derived(reservation !== null && reservation.origin !== 'manual' && reservation.peopleCount === 0)
	const isImported = $derived(reservation?.origin === 'booking' || reservation?.origin === 'airbnb')
	const nextDate = $derived(form.startDate ? dateKey(addDays(new Date(`${form.startDate}T12:00:00`), 1)) : '')

	function createForm(value: Reservation | null, date: string): FormState {
		const tomorrow = dateKey(addDays(new Date(`${(value?.startDate ?? date)}T12:00:00`), 1))
		return {
			name: value?.name ?? '',
			roomId: value?.roomId ? String(value.roomId) : '',
			peopleCount: value && value.peopleCount > 0 ? String(value.peopleCount) : '',
			startDate: value?.startDate ?? date,
			endDate: value?.endDate ?? tomorrow,
			totalPrice: value?.totalPrice === null || value?.totalPrice === undefined ? '' : String(value.totalPrice),
			amountPaid: value && value.amountPaid > 0 ? String(value.amountPaid) : '',
			isPaid: value?.status === 'pagado',
			bookingCommission: value && value.bookingCommission > 0 ? String(value.bookingCommission) : '',
			isCommissionPaid: value?.bookingCommissionStatus === 'pagado'
		}
	}

	function inputText(value: NumericField): string {
		return value === null ? '' : String(value)
	}

	onMount(() => {
		if (!dialog.open) dialog.showModal()
	})

	function close() {
		if (dialog?.open) dialog.close()
		else onClose()
	}

	function handleBackdrop(event: MouseEvent) {
		if (event.target === dialog) close()
	}

	function stateIdForPaidStatus(): number {
		const target = form.isPaid ? 'pagado' : 'por cobrar'
		return statuses.find((status) => status.nombre.toLowerCase() === target)?.id ?? (form.isPaid ? 2 : 1)
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault()
		if (saving) return
		errorMessage = ''

		const name = form.name.trim()
		const roomId = Number(form.roomId)
		const peopleCountValue = inputText(form.peopleCount)
		const totalPriceValue = inputText(form.totalPrice)
		const amountPaidValue = inputText(form.amountPaid)
		const bookingCommissionValue = inputText(form.bookingCommission)
		const peopleCount = peopleCountValue.trim() ? Number(peopleCountValue) : 0
		const totalPrice = totalPriceValue.trim() ? Number(totalPriceValue) : null
		const amountPaid = amountPaidValue.trim() ? Number(amountPaidValue) : 0
		const bookingCommission = bookingCommissionValue.trim() ? Number(bookingCommissionValue) : 0

		if (!name || !Number.isInteger(roomId) || roomId < 1) {
			errorMessage = 'Escribe el nombre y selecciona el alojamiento.'
			return
		}
		if ((!needsPeopleDetails && (!Number.isInteger(peopleCount) || peopleCount < 1)) || peopleCount < 0) {
			errorMessage = 'Indica cuántas personas se hospedan.'
			return
		}
		if (!form.startDate || !form.endDate || form.endDate <= form.startDate) {
			errorMessage = 'La salida debe ser después de la fecha de entrada.'
			return
		}
		if (totalPrice !== null && (!Number.isFinite(totalPrice) || totalPrice < 0)) {
			errorMessage = 'El monto debe ser un número igual o mayor que cero.'
			return
		}
		if (totalPrice !== null && (!Number.isFinite(amountPaid) || amountPaid < 0 || amountPaid > totalPrice)) {
			errorMessage = 'Revisa el abono: no puede ser negativo ni mayor que el monto total.'
			return
		}
		if (!Number.isFinite(bookingCommission) || bookingCommission < 0) {
			errorMessage = 'Revisa el monto de la comisión.'
			return
		}

		const draft: ReservationDraft = {
			name,
			roomId,
			peopleCount,
			startDate: form.startDate,
			endDate: form.endDate,
			totalPrice,
			amountPaid: totalPrice === null ? 0 : amountPaid,
			statusId: totalPrice === null ? null : stateIdForPaidStatus(),
			bookingCommission: totalPrice === null ? 0 : bookingCommission,
			bookingCommissionStatus: form.isCommissionPaid ? 'pagado' : 'pendiente'
		}

		saving = true
		try {
			await onSave(draft)
			close()
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'No se pudo guardar la reserva.'
		} finally {
			saving = false
		}
	}
</script>

<dialog class="reservation-dialog" bind:this={dialog} onclose={onClose} onclick={handleBackdrop}>
	<section class="form-panel" role="document">
		<header class="form-heading">
			<div>
				<p class="eyebrow">Senderos Amados</p>
				<h2>{reservation ? (needsPeopleDetails ? 'Completar reserva' : 'Editar reserva') : 'Nueva reserva'}</h2>
			</div>
			<button class="icon-button" type="button" aria-label="Cerrar formulario" onclick={close}>
				<X size={19} aria-hidden="true" />
			</button>
		</header>

		{#if isImported}
			<div class="source-info" role="note">
				El calendario de {reservation?.origin === 'booking' ? 'Booking' : 'Airbnb'} solo trae las fechas. Añade aquí los datos que faltan.
			</div>
		{/if}

		<form class="reservation-form" onsubmit={submit}>
			<div class="form-grid">
				<div class="field span-all">
					<label for="reservation-name">Nombre del huésped</label>
					<input id="reservation-name" bind:value={form.name} maxlength="120" autocomplete="off" placeholder="Ej. Familia Pérez" required />
				</div>

				<div class="field span-all">
					<label for="reservation-room">Alojamiento</label>
					<select id="reservation-room" bind:value={form.roomId} required>
						<option value="" disabled>Selecciona una casa o cabaña</option>
						{#each rooms as room (room.id)}
							<option value={String(room.id)}>{room.nombre}</option>
						{/each}
					</select>
				</div>

				<div class="field">
					<label for="reservation-arrival">Entrada</label>
					<input id="reservation-arrival" type="date" bind:value={form.startDate} min={reservation ? undefined : todayKey()} required />
				</div>
				<div class="field">
					<label for="reservation-departure">Salida</label>
					<input id="reservation-departure" type="date" bind:value={form.endDate} min={nextDate} required />
				</div>

				<div class="field span-all">
					<label for="reservation-people">Personas</label>
					<input id="reservation-people" type="number" min="1" step="1" bind:value={form.peopleCount} placeholder={needsPeopleDetails ? 'Puedes completarlo después' : 'Ej. 4'} required={!needsPeopleDetails} />
					{#if needsPeopleDetails}<small>El calendario externo no informa cuántas personas vienen.</small>{/if}
				</div>

				<div class="field span-all">
					<label for="reservation-total">Monto total <span class="optional">(opcional)</span></label>
					<input id="reservation-total" type="number" min="0" step="0.01" bind:value={form.totalPrice} placeholder="Puedes dejarlo en blanco" inputmode="decimal" />
					<small>La reserva se puede guardar aunque todavía no hayan acordado el precio.</small>
				</div>

				{#if inputText(form.totalPrice).trim()}
					<div class="field">
						<label for="reservation-paid">Abono recibido</label>
						<input id="reservation-paid" type="number" min="0" step="0.01" bind:value={form.amountPaid} placeholder="0.00" inputmode="decimal" />
					</div>
					<div class="field">
						<label for="reservation-commission">Comisión Booking</label>
						<input id="reservation-commission" type="number" min="0" step="0.01" bind:value={form.bookingCommission} placeholder="Opcional" inputmode="decimal" />
					</div>
					<label class="check-row span-all">
						<input type="checkbox" bind:checked={form.isPaid} />
						<span>El monto ya fue pagado</span>
					</label>
					<label class="check-row span-all">
						<input type="checkbox" bind:checked={form.isCommissionPaid} />
						<span>La comisión de Booking ya fue pagada</span>
					</label>
				{/if}
			</div>

			{#if errorMessage}<p class="form-error" role="alert">{errorMessage}</p>{/if}

			<footer class="form-actions">
				<button class="button button-quiet" type="button" onclick={close} disabled={saving}>Cancelar</button>
				<button class="button button-primary" type="submit" disabled={saving || rooms.length === 0}>
					{saving ? 'Guardando…' : reservation ? 'Guardar cambios' : 'Guardar reserva'}
				</button>
			</footer>
		</form>
	</section>
</dialog>

<style>
	.reservation-dialog {
		width: min(100% - 28px, 620px);
		max-width: 620px;
		max-height: min(92dvh, 900px);
		margin: auto;
		overflow: auto;
		border: 1px solid var(--line);
		border-radius: 22px;
		padding: 0;
		background: #fff;
		color: var(--ink);
		box-shadow: 0 24px 80px rgb(22 37 26 / 24%);
	}

	.reservation-dialog::backdrop {
		background: rgb(24 39 29 / 45%);
		backdrop-filter: blur(2px);
	}

	.form-panel {
		padding: 24px;
	}

	.form-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		margin-bottom: 18px;
	}

	.form-heading .eyebrow {
		margin-bottom: 4px;
	}

	h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 28px;
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1.2;
	}

	.source-info {
		margin-bottom: 16px;
		border: 1px solid #e8d7bd;
		border-radius: 12px;
		padding: 11px 13px;
		background: #fbf6ed;
		color: #725532;
		font-size: 14px;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 15px 13px;
	}

	.span-all {
		grid-column: 1 / -1;
	}

	.optional {
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
	}

	.check-row {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 10px;
		border: 1px solid #e4ebe1;
		border-radius: 11px;
		padding: 8px 11px;
		font-size: 14px;
		cursor: pointer;
	}

	.check-row input {
		width: 18px;
		height: 18px;
		accent-color: var(--forest);
	}

	.form-error {
		margin: 14px 0 0;
		border-radius: 10px;
		padding: 10px 12px;
		background: #fff2ef;
		color: var(--danger);
		font-size: 14px;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 22px;
		padding-top: 15px;
		border-top: 1px solid #edf1eb;
	}

	@media (max-width: 640px) {
		.reservation-dialog {
			width: 100%;
			max-width: none;
			max-height: 94dvh;
			margin: auto 0 0;
			border-right: 0;
			border-bottom: 0;
			border-left: 0;
			border-radius: 22px 22px 0 0;
		}

		.form-panel {
			padding: 20px 16px calc(16px + env(safe-area-inset-bottom));
		}

		h2 {
			font-size: 25px;
		}
	}

	@media (max-width: 420px) {
		.form-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.span-all {
			grid-column: auto;
		}
	}
</style>
