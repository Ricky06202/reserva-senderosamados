<script lang="ts">
	import { CalendarDays, CircleDollarSign, Clock, House, Pencil, Trash2, UsersRound, X } from 'lucide-svelte'
	import { formatDate, stayNights } from './dates'
	import type { Reservation } from './types'

	interface Props {
		reservation: Reservation
		onEdit: (reservation: Reservation) => void
		onDelete: (reservation: Reservation) => void
		onAddAnnotation: (reservationId: string, content: string) => Promise<void>
		onDeleteAnnotation: (annotationId: string) => Promise<void>
	}

	let { reservation, onEdit, onDelete, onAddAnnotation, onDeleteAnnotation }: Props = $props()
	let noteText = $state('')
	let showNoteForm = $state(false)
	let savingNote = $state(false)
	let noteError = $state('')

	const imported = $derived(reservation.origin === 'booking' || reservation.origin === 'airbnb')
	const originLabel = $derived(
		reservation.origin === 'booking'
			? 'Booking'
			: reservation.origin === 'airbnb'
				? 'Airbnb'
				: reservation.origin === 'bot'
					? 'Bot de reservas'
					: 'Registro manual'
	)
	const needsDetails = $derived(imported && reservation.peopleCount === 0)
	const stayLength = $derived(stayNights(reservation.startDate, reservation.endDate))
	function formatTime(value: string): string {
		const match = /^(\d{2}):(\d{2})$/.exec(value)
		if (!match) return value
		const hour = Number(match[1])
		const minute = match[2]
		return `${hour % 12 || 12}:${minute} ${hour < 12 ? 'a. m.' : 'p. m.'}`
	}
	const balance = $derived(
		reservation.totalPrice === null
			? null
			: Math.max(reservation.totalPrice - reservation.amountPaid, 0)
	)

	async function addNote() {
		if (!noteText.trim() || savingNote) return
		savingNote = true
		noteError = ''
		try {
			await onAddAnnotation(reservation.id, noteText.trim())
			noteText = ''
			showNoteForm = false
		} catch {
			noteError = 'No se pudo guardar la nota. Intenta otra vez.'
		} finally {
			savingNote = false
		}
	}
</script>

<article class="reservation-card card" class:needs-details={needsDetails}>
	<header class="card-head">
		<div class="identity">
			<div class="guest-line">
				<h3>{reservation.name || 'Reserva sin nombre'}</h3>
				{#if needsDetails}
					<span class="completion-badge">Completar datos</span>
				{/if}
			</div>
			<div class="meta-line">
				<span class="meta-item"><CalendarDays size={15} aria-hidden="true" />
					{formatDate(reservation.startDate)} – {formatDate(reservation.endDate)}
				</span>
				<span class="meta-item"><Clock size={15} aria-hidden="true" />Entrada {formatTime(reservation.checkInTime)}</span>
				<span class="meta-item"><Clock size={15} aria-hidden="true" />Salida {formatTime(reservation.checkOutTime)}</span>
				<span class="meta-item"><House size={15} aria-hidden="true" />{reservation.room}</span>
				<span class="meta-item">
					<UsersRound size={15} aria-hidden="true" />
					{reservation.peopleCount > 0 ? `${reservation.peopleCount} personas` : 'Personas sin dato'}
				</span>
			</div>
		</div>
		<div class="card-actions">
			<button class="icon-button" type="button" aria-label="Editar reserva" onclick={() => onEdit(reservation)}>
				<Pencil size={17} aria-hidden="true" />
			</button>
			{#if !imported}
				<button class="icon-button delete-button" type="button" aria-label="Eliminar reserva" onclick={() => onDelete(reservation)}>
					<Trash2 size={17} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</header>

	<div class="badges">
		<span class="origin-badge" class:external={imported}>{originLabel}</span>
		{#if reservation.totalPrice === null}
			<span class="status-badge no-amount"><CircleDollarSign size={14} aria-hidden="true" />Monto sin registrar</span>
		{:else}
			<span class="status-badge" class:paid={reservation.status === 'pagado'} class:unpaid={reservation.status === 'por cobrar'}>
				{reservation.status === 'pagado' ? 'Pagado' : 'Por cobrar'}
			</span>
		{/if}
	</div>

	{#if needsDetails}
		<p class="external-hint">
			El calendario de {originLabel} solo comparte fechas. Completa los datos de esta reserva cuando los tengas.
		</p>
	{/if}

	{#if reservation.totalPrice !== null}
		<section class="money-summary" aria-label="Resumen de pago">
			<div>
				<span>Monto total</span>
				<strong>${reservation.totalPrice.toFixed(2)}</strong>
			</div>
			<div>
				<span>Abonado</span>
				<strong>${reservation.amountPaid.toFixed(2)}</strong>
			</div>
			<div class="balance">
				<span>Saldo</span>
				<strong>${(balance ?? 0).toFixed(2)}</strong>
			</div>
			{#if reservation.bookingCommission > 0}
				<div>
					<span>Comisión Booking</span>
					<strong>${reservation.bookingCommission.toFixed(2)}</strong>
				</div>
			{/if}
		</section>
	{:else}
		<div class="no-money">El monto se puede añadir después, sin perder las fechas.</div>
	{/if}

	<footer class="notes-section">
		<div class="notes-heading">
			<h4>Anotaciones <span>{reservation.anotaciones.length}</span></h4>
			<button class="text-button" type="button" onclick={() => (showNoteForm = !showNoteForm)}>
				{showNoteForm ? 'Cancelar' : 'Agregar nota'}
			</button>
		</div>

		{#if showNoteForm}
			<form class="note-form" onsubmit={(event) => { event.preventDefault(); void addNote() }}>
				<label class="sr-only" for={`note-${reservation.id}`}>Nueva anotación</label>
				<textarea id={`note-${reservation.id}`} bind:value={noteText} maxlength="600" placeholder="Escribe una nota para el equipo…"></textarea>
				<button class="button button-primary" type="submit" disabled={savingNote || !noteText.trim()}>
					{savingNote ? 'Guardando…' : 'Guardar nota'}
				</button>
			</form>
			{#if noteError}<p class="note-error" role="alert">{noteError}</p>{/if}
		{/if}

		{#if reservation.anotaciones.length}
			<ul class="notes-list">
				{#each reservation.anotaciones as note (note.id)}
					<li>
						<p>{note.content}</p>
						<button class="note-remove" type="button" aria-label="Eliminar anotación" onclick={() => void onDeleteAnnotation(note.id)}>
							<X size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{:else if !showNoteForm}
			<p class="empty-note">Todavía no hay anotaciones.</p>
		{/if}

		{#if stayLength > 0}
			<p class="stay-length">{stayLength} noche{stayLength === 1 ? '' : 's'}</p>
		{/if}
	</footer>
</article>

<style>
	.reservation-card {
		padding: 18px;
	}

	.reservation-card.needs-details {
		border-color: #e7d6bd;
	}

	.card-head,
	.guest-line,
	.meta-line,
	.meta-item,
	.card-actions,
	.badges,
	.notes-heading {
		display: flex;
	}

	.card-head {
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.identity {
		min-width: 0;
	}

	.guest-line {
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 750;
		line-height: 1.3;
	}

	.meta-line {
		flex-wrap: wrap;
		gap: 7px 15px;
		margin-top: 8px;
		color: var(--muted);
		font-size: 13px;
	}

	.meta-item {
		align-items: center;
		gap: 5px;
	}

	.card-actions {
		flex: 0 0 auto;
		gap: 6px;
	}

	.delete-button {
		color: #8b4138;
	}

	.badges {
		flex-wrap: wrap;
		gap: 7px;
		margin-top: 13px;
	}

	.origin-badge,
	.status-badge,
	.completion-badge {
		display: inline-flex;
		min-height: 27px;
		align-items: center;
		gap: 5px;
		border-radius: 999px;
		padding: 3px 10px;
		background: #f0f3ee;
		color: #536356;
		font-size: 12px;
		font-weight: 700;
	}

	.origin-badge.external,
	.completion-badge {
		background: var(--sun-pale);
		color: #805124;
	}

	.status-badge.paid {
		background: #e7f2e5;
		color: #315f39;
	}

	.status-badge.unpaid {
		background: #faf0df;
		color: #795320;
	}

	.status-badge.no-amount {
		background: #f1f3ef;
		color: #59685c;
	}

	.external-hint,
	.no-money {
		margin: 13px 0 0;
		border-radius: 11px;
		padding: 10px 12px;
		background: #fbf6ed;
		color: #725532;
		font-size: 13px;
	}

	.money-summary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		margin-top: 15px;
		border-top: 1px solid #edf1eb;
		padding-top: 13px;
	}

	.money-summary div {
		display: grid;
		gap: 3px;
	}

	.money-summary span {
		color: var(--muted);
		font-size: 12px;
	}

	.money-summary strong {
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}

	.money-summary .balance strong {
		color: var(--forest);
	}

	.notes-section {
		position: relative;
		margin-top: 15px;
		border-top: 1px solid #edf1eb;
		padding-top: 12px;
	}

	.notes-heading {
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h4 {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
		color: #536356;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	h4 span {
		color: #7a897c;
		font-variant-numeric: tabular-nums;
	}

	.text-button {
		min-height: 40px;
		border: 0;
		border-radius: 8px;
		padding: 0 6px;
		background: transparent;
		color: var(--forest);
		font-size: 13px;
		font-weight: 750;
		cursor: pointer;
	}

	.text-button:hover {
		background: #f0f5ee;
	}

	.note-form {
		display: grid;
		gap: 8px;
		margin-top: 10px;
	}

	.note-form textarea {
		min-height: 72px;
		border: 1px solid #d4dfd2;
		border-radius: 11px;
		padding: 10px 12px;
		background: #fff;
		font-size: 16px;
		resize: vertical;
	}

	.note-form .button {
		justify-self: start;
		min-height: 42px;
	}

	.notes-list {
		display: grid;
		gap: 7px;
		margin: 9px 0 0;
		padding: 0;
		list-style: none;
	}

	.notes-list li {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		border: 1px solid #eee8db;
		border-radius: 11px;
		padding: 9px 10px;
		background: #fffaf0;
	}

	.notes-list p {
		margin: 0;
		font-size: 14px;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.note-remove {
		display: grid;
		width: 36px;
		height: 36px;
		flex: 0 0 36px;
		place-items: center;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: #718071;
		cursor: pointer;
	}

	.note-remove:hover {
		background: #f6ece2;
		color: var(--danger);
	}

	.empty-note,
	.stay-length,
	.note-error {
		margin: 8px 0 0;
		color: #7d897e;
		font-size: 12px;
	}

	.note-error {
		color: var(--danger);
	}

	.stay-length {
		text-align: right;
	}

	@media (max-width: 480px) {
		.reservation-card {
			padding: 15px 13px;
		}

		h3 {
			font-size: 17px;
		}

		.card-actions {
			gap: 4px;
		}

		.card-actions .icon-button {
			width: 40px;
			height: 40px;
			flex-basis: 40px;
		}

		.money-summary {
			gap: 6px;
		}
	}
</style>
