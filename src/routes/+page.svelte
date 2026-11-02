<script lang="ts">
	import { onMount } from 'svelte'
	import {
		Bell,
		CalendarDays,
		Check,
		ChevronRight,
		CircleAlert,
		Download,
		FileText,
		House,
		List,
		Plus,
		RefreshCw,
		Search,
		Settings,
		Share2,
		WifiOff
	} from 'lucide-svelte'
	import CalendarMonth from '../lib/CalendarMonth.svelte'
	import ReservationCard from '../lib/ReservationCard.svelte'
	import ReservationForm from '../lib/ReservationForm.svelte'
	import { ApiError, api } from '../lib/api'
	import { addMonth, formatDate, previousMonth, todayKey } from '../lib/dates'
	import { previewReservations, previewRooms, previewStatuses } from '../lib/mock'
	import { canReceivePush, currentPushSubscription, enablePushOnThisDevice, disablePushOnThisDevice } from '../lib/push'
	import type { ApiRoom, ApiStatus, CalendarRoomSettings, Reservation, ReservationDraft } from '../lib/types'

	type Tab = 'calendar' | 'list' | 'reports' | 'settings'
	type CalendarFeedback = { kind: 'pending' | 'success' | 'error'; message: string }
	type InstallPromptEvent = Event & {
		prompt: () => Promise<void>
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
	}
	type RsidWindow = Window & {
		RSID_MENU?: { donde: string; entrarEstilo: 'texto'; cosas: Array<{ t: string; u: string; i: string }> }
	}

	const calendarSources = [
		{ key: 'booking', title: 'Booking.com' },
		{ key: 'airbnb', title: 'Airbnb' }
	] as const

	let reservations = $state<Reservation[]>([])
	let rooms = $state<ApiRoom[]>([])
	let statuses = $state<ApiStatus[]>([])
	let calendarSettings = $state<CalendarRoomSettings[]>([])
	let loading = $state(true)
	let refreshing = $state(false)
	let sessionReady = $state(false)
	let accessIssue = $state<'signed-out' | 'unauthorized' | null>(null)
	let savingCalendar = $state('')
	let syncingCalendar = $state('')
	let settingsLoaded = $state(false)
	let loadError = $state('')
	let notice = $state('')
	let activeTab = $state<Tab>('calendar')
	let cursor = $state(new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
	let selectedDate = $state(todayKey())
	let roomFilter = $state('all')
	let listQuery = $state('')
	let formOpen = $state(false)
	let formInitialDate = $state(todayKey())
	let editingReservation = $state<Reservation | null>(null)
	let pendingDelete = $state<Reservation | null>(null)
	let isPreviewMode = $state(false)
	let pushState = $state<'checking' | 'active' | 'off' | 'denied' | 'unsupported'>('checking')
	let pushBusy = $state(false)
	let pushMessage = $state('')
	let installPrompt = $state<InstallPromptEvent | null>(null)
	let installMessage = $state('')
	let isInstalled = $state(false)
	let calendarDrafts = $state<Record<string, string>>({})
	let calendarFeedback = $state<Record<string, CalendarFeedback>>({})
	let reportStart = $state(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`)
	let reportEnd = $state(todayKey())

	const selectedReservations = $derived.by(() =>
		reservations
			.filter((reservation) => {
				if (roomFilter !== 'all' && String(reservation.roomId) !== roomFilter) return false
				return selectedDate >= reservation.startDate && selectedDate < reservation.endDate
			})
			.sort((a, b) => a.startDate.localeCompare(b.startDate))
	)

	const upcomingReservations = $derived.by(() => {
		const today = todayKey()
		return reservations
			.filter((reservation) => reservation.startDate >= today)
			.sort((a, b) => a.startDate.localeCompare(b.startDate))
			.slice(0, 3)
	})

	const filteredReservations = $derived.by(() => {
		const query = listQuery.trim().toLocaleLowerCase('es-PA')
		return [...reservations]
			.filter((reservation) => roomFilter === 'all' || String(reservation.roomId) === roomFilter)
			.filter((reservation) =>
				!query ||
				reservation.name.toLocaleLowerCase('es-PA').includes(query) ||
				reservation.room.toLocaleLowerCase('es-PA').includes(query)
			)
			.sort((a, b) => a.startDate.localeCompare(b.startDate))
	})

	const reportReservations = $derived.by(() =>
		reservations
			.filter((reservation) => reservation.startDate >= reportStart && reservation.startDate <= reportEnd)
			.sort((a, b) => a.startDate.localeCompare(b.startDate))
	)

	const reportTotals = $derived.by(() => {
		const withAmount = reportReservations.filter((reservation) => reservation.totalPrice !== null)
		return {
			count: reportReservations.length,
			hosting: withAmount.reduce((sum, reservation) => sum + (reservation.totalPrice ?? 0), 0),
			paid: withAmount.reduce((sum, reservation) => sum + reservation.amountPaid, 0),
			missingAmount: reportReservations.length - withAmount.length,
			bookingCommission: withAmount.reduce((sum, reservation) => sum + reservation.bookingCommission, 0)
		}
	})

	function mountRsidMenu() {
		if (import.meta.env.DEV || document.querySelector('[data-rsid-session]')) return
		const win = window as RsidWindow
		win.RSID_MENU = {
			donde: '#rsid-profile',
			entrarEstilo: 'texto',
			cosas: [{ t: 'Mis reservas', u: '/', i: 'pedido' }]
		}
		const script = document.createElement('script')
		script.src = 'https://pay.rsanjur.com/sesion.js'
		script.defer = true
		script.dataset.rsidSession = 'true'
		document.head.appendChild(script)
	}

	async function loadData() {
		if (isPreviewMode) {
			reservations = previewReservations()
			rooms = previewRooms
			statuses = previewStatuses
			sessionReady = true
			accessIssue = null
			loading = false
			refreshing = false
			loadError = ''
			return
		}

		if (sessionReady) refreshing = true
		else loading = true
		loadError = ''
		try {
			const [nextReservations, nextRooms, nextStatuses] = await Promise.all([
				api.getReservations(),
				api.getRooms(),
				api.getStatuses()
			])
			reservations = nextReservations
			rooms = nextRooms
			statuses = nextStatuses
			sessionReady = true
			accessIssue = null
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				sessionReady = false
				accessIssue = 'signed-out'
				loadError = 'Inicia sesión con RS ID para consultar las reservas.'
			} else if (error instanceof ApiError && error.status === 403) {
				sessionReady = false
				accessIssue = 'unauthorized'
				loadError = 'Esta cuenta de RS ID todavía no está autorizada para esta app.'
			} else {
				accessIssue = null
				loadError = error instanceof Error ? error.message : 'No se pudieron cargar las reservas.'
			}
		} finally {
			loading = false
			refreshing = false
		}
	}

	async function loadCalendarSettings() {
		if (settingsLoaded || isPreviewMode) return
		try {
			calendarSettings = await api.getCalendarSettings()
			settingsLoaded = true
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) {
				sessionReady = false
				accessIssue = 'signed-out'
				loadError = 'Inicia sesión con RS ID para continuar.'
			} else if (error instanceof ApiError && error.status === 403) {
				sessionReady = false
				accessIssue = 'unauthorized'
				loadError = 'Esta cuenta de RS ID todavía no está autorizada para esta app.'
			} else {
				loadError = error instanceof Error ? error.message : 'No se pudo cargar la configuración de calendarios.'
			}
		}
	}

	async function refreshPushState() {
		if (import.meta.env.DEV || !canReceivePush()) {
			pushState = 'unsupported'
			return
		}
		if (Notification.permission === 'denied') {
			pushState = 'denied'
			return
		}
		try {
			pushState = (await currentPushSubscription()) ? 'active' : 'off'
		} catch {
			pushState = 'off'
		}
	}

	function handleInstallPrompt(event: Event) {
		event.preventDefault()
		installPrompt = event as InstallPromptEvent
	}

	function onAppInstalled() {
		isInstalled = true
		installPrompt = null
		installMessage = 'La app quedó instalada en este dispositivo.'
	}

	onMount(() => {
		isPreviewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'ui'
		mountRsidMenu()
		void loadData()
		void refreshPushState()

		const media = window.matchMedia('(display-mode: standalone)')
		isInstalled = media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
		window.addEventListener('beforeinstallprompt', handleInstallPrompt)
		window.addEventListener('appinstalled', onAppInstalled)
		return () => {
			window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
			window.removeEventListener('appinstalled', onAppInstalled)
		}
	})

	function switchTab(tab: Tab) {
		activeTab = tab
		if (tab === 'settings') void loadCalendarSettings()
	}

	function openNewReservation(date = selectedDate) {
		editingReservation = null
		formInitialDate = date
		formOpen = true
	}

	function openEditReservation(reservation: Reservation) {
		editingReservation = reservation
		formInitialDate = reservation.startDate
		formOpen = true
	}

	function reservationFromDraft(draft: ReservationDraft, id: string, existing?: Reservation): Reservation {
		const room = rooms.find((item) => item.id === draft.roomId)?.nombre ?? existing?.room ?? 'Hospedaje'
		const selectedStatus = statuses.find((item) => item.id === draft.statusId)?.nombre
		const status: Reservation['status'] =
			draft.totalPrice === null ? 'sin monto' : selectedStatus === 'pagado' ? 'pagado' : 'por cobrar'

		return {
			id,
			name: draft.name.trim(),
			startDate: draft.startDate,
			endDate: draft.endDate,
			peopleCount: draft.peopleCount ?? 0,
			room,
			roomId: draft.roomId,
			totalPrice: draft.totalPrice,
			amountPaid: draft.totalPrice === null ? 0 : draft.amountPaid,
			status,
			statusId: draft.totalPrice === null ? null : draft.statusId,
			bookingCommission: draft.totalPrice === null ? 0 : draft.bookingCommission,
			bookingCommissionStatus: draft.bookingCommissionStatus,
			origin: existing?.origin ?? 'manual',
			anotaciones: existing?.anotaciones ?? []
		}
	}

	async function saveReservation(draft: ReservationDraft) {
		if (isPreviewMode) {
			const room = rooms.find((item) => item.id === draft.roomId)?.nombre ?? 'Hospedaje'
			if (editingReservation) {
				reservations = reservations.map((item) =>
					item.id === editingReservation?.id
						? {
							...item,
							...draft,
							peopleCount: draft.peopleCount ?? 0,
							room,
							status: draft.totalPrice === null ? 'sin monto' : draft.statusId === 2 ? 'pagado' : 'por cobrar'
						}
						: item
				)
			} else {
				reservations = [
					{
						id: `preview-${Date.now()}`,
						...draft,
					peopleCount: draft.peopleCount ?? 0,
						room,
						status: draft.totalPrice === null ? 'sin monto' : draft.statusId === 2 ? 'pagado' : 'por cobrar',
						origin: 'manual',
						anotaciones: []
					},
					...reservations
				]
			}
			notice = 'Reserva guardada.'
			return
		}

		if (editingReservation) {
			const current = editingReservation
			await api.updateReservation(current.id, draft)
			reservations = reservations.map((item) =>
				item.id === current.id ? reservationFromDraft(draft, current.id, item) : item
			)
			notice = 'Cambios guardados.'
			return
		}

		const id = await api.createReservation(draft)
		reservations = [reservationFromDraft(draft, id), ...reservations]
		notice = 'Reserva creada.'
	}

	async function confirmDelete() {
		if (!pendingDelete) return
		const target = pendingDelete
		pendingDelete = null
		if (isPreviewMode) {
			reservations = reservations.filter((reservation) => reservation.id !== target.id)
		} else {
			await api.deleteReservation(target.id)
			await loadData()
		}
		notice = 'Reserva eliminada.'
	}

	async function addAnnotation(reservationId: string, content: string) {
		if (isPreviewMode) {
			reservations = reservations.map((reservation) =>
				reservation.id === reservationId
					? { ...reservation, anotaciones: [...reservation.anotaciones, { id: `note-${Date.now()}`, content }] }
					: reservation
			)
			return
		}
		await api.addAnnotation(reservationId, content)
		await loadData()
	}

	async function deleteAnnotation(annotationId: string) {
		if (isPreviewMode) {
			reservations = reservations.map((reservation) => ({
				...reservation,
				anotaciones: reservation.anotaciones.filter((note) => note.id !== annotationId)
			}))
			return
		}
		await api.deleteAnnotation(annotationId)
		await loadData()
	}

	async function togglePush() {
		pushBusy = true
		pushMessage = ''
		try {
			if (pushState === 'active') {
				await disablePushOnThisDevice()
				pushState = 'off'
				pushMessage = 'Avisos desactivados en este dispositivo.'
			} else {
				await enablePushOnThisDevice()
				pushState = 'active'
				pushMessage = 'Listo. Este dispositivo recibirá avisos de nuevas reservas.'
			}
		} catch (error) {
			pushMessage = error instanceof Error ? error.message : 'No se pudo actualizar el permiso de avisos.'
			await refreshPushState()
		} finally {
			pushBusy = false
		}
	}

	async function saveCalendar(roomId: number, source: 'booking' | 'airbnb') {
		const key = `${roomId}:${source}`
		const url = calendarDrafts[key]?.trim() ?? ''
		if (!isPreviewMode && !url) {
			const message = 'Pega el enlace iCal para guardar.'
			calendarFeedback[key] = { kind: 'error', message }
			loadError = message
			return
		}
		savingCalendar = key
		calendarFeedback[key] = { kind: 'pending', message: 'Guardando el enlace…' }
		loadError = ''
		let sourceSaved = false
		try {
			if (!isPreviewMode) {
				await api.saveCalendarSource(roomId, source, url)
				sourceSaved = true
				calendarDrafts[key] = ''
				await api.syncCalendarSource(roomId, source)
				await loadData()
				calendarSettings = await api.getCalendarSettings()
				settingsLoaded = true
			}
			calendarDrafts[key] = ''
			const message = `${source === 'booking' ? 'Booking' : 'Airbnb'} guardado y sincronizado.`
			calendarFeedback[key] = { kind: 'success', message }
			notice = message
		} catch (error) {
			if (sourceSaved) {
				try {
					calendarSettings = await api.getCalendarSettings()
					settingsLoaded = true
				} catch {
					// El error original explica qué paso no se pudo completar.
				}
			}
			const errorMessage = error instanceof ApiError
				? error.message
				: 'No se pudo conectar con el servidor. Revisa la conexión e intenta otra vez.'
			const message = sourceSaved
				? `El enlace quedó guardado, pero no se pudo sincronizar: ${errorMessage}`
				: errorMessage
			calendarFeedback[key] = { kind: 'error', message }
			loadError = message
		} finally {
			savingCalendar = ''
		}
	}

	async function syncCalendar(roomId: number, source: 'booking' | 'airbnb') {
		const key = `${roomId}:${source}`
		syncingCalendar = key
		loadError = ''
		try {
			await api.syncCalendarSource(roomId, source)
			await Promise.all([loadData(), refreshCalendarSettings()])
			notice = 'Calendario actualizado.'
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'No se pudo actualizar el calendario.'
		} finally {
			syncingCalendar = ''
		}
	}

	async function refreshCalendarSettings() {
		if (isPreviewMode) return
		calendarSettings = await api.getCalendarSettings()
		settingsLoaded = true
	}

	function calendarDraftKey(roomId: number, source: 'booking' | 'airbnb'): string {
		return `${roomId}:${source}`
	}

	function sourceStatus(roomId: number, source: 'booking' | 'airbnb') {
		return calendarSettings.find((item) => item.roomId === roomId)?.[source]
	}

	async function copyFeedLink(url: string) {
		if (!url) return
		try {
			await navigator.clipboard.writeText(url)
			notice = 'Enlace copiado. Pégalo en Booking y Airbnb para compartir las fechas bloqueadas.'
		} catch {
			loadError = 'No se pudo copiar. Mantén presionado el enlace para copiarlo.'
		}
	}

	async function installApp() {
		if (isInstalled) {
			installMessage = 'La app ya está instalada en este dispositivo.'
			return
		}
		if (installPrompt) {
			await installPrompt.prompt()
			const choice = await installPrompt.userChoice
			installMessage = choice.outcome === 'accepted' ? 'La instalación empezó.' : 'Puedes instalarla después desde el menú del navegador.'
			installPrompt = null
			return
		}
		const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent)
		installMessage = isAppleMobile
			? 'En Safari, toca Compartir y elige “Agregar a pantalla de inicio”.'
			: 'Abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla principal”.'
	}

	function printReport() {
		window.print()
	}
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
	<meta name="theme-color" content="#25583a" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

<div class="app-frame">
	<header class="topbar">
		<a class="brand-lockup" href="/" aria-label="Senderos Amados, inicio">
			<img src="/brand/logo.webp" alt="" width="48" height="52" />
			<span class="brand-copy"><strong>Senderos Amados</strong><span>Reservas familiares</span></span>
		</a>
		<div class="topbar-actions">
			<button class="button button-quiet install-button" type="button" onclick={installApp}>
				{#if isInstalled}<Check size={17} aria-hidden="true" />{:else}<Download size={17} aria-hidden="true" />{/if}
				<span>{isInstalled ? 'Instalada' : 'Instalar app'}</span>
			</button>
			<span id="rsid-profile" class="rsid-profile" aria-live="polite"></span>
		</div>
	</header>

	<main>
		<section class="page-intro">
			<div>
				<p class="eyebrow">Acceso privado · RS ID</p>
				<h1 class="page-heading">Reservas</h1>
				<p class="intro-copy">Fechas claras para que el equipo esté en la misma página.</p>
			</div>
			{#if !loading && (sessionReady || isPreviewMode)}
				<button class="button button-primary new-reservation" type="button" onclick={() => openNewReservation()} disabled={rooms.length === 0}>
					<Plus size={18} aria-hidden="true" /> Nueva reserva
				</button>
			{/if}
		</section>

		{#if notice}
			<div class="notice toast" role="status">
				<span>{notice}</span>
				<button class="dismiss-notice" type="button" aria-label="Cerrar aviso" onclick={() => (notice = '')}>×</button>
			</div>
		{/if}
		{#if loadError && !(accessIssue && !sessionReady && !isPreviewMode)}
			<div class="notice notice-error alert" role="alert">
				<CircleAlert size={18} aria-hidden="true" /><span>{loadError}</span>
				{#if !isPreviewMode && !loadError.includes('RS ID')}
					<button class="text-button" type="button" onclick={() => void loadData()}>Reintentar</button>
				{/if}
			</div>
		{/if}
		{#if installMessage}
			<div class="notice install-note" role="status">
				<Share2 size={17} aria-hidden="true" /><span>{installMessage}</span>
				<button class="dismiss-notice" type="button" aria-label="Cerrar aviso" onclick={() => (installMessage = '')}>×</button>
			</div>
		{/if}

		{#if loading || sessionReady || isPreviewMode}
			<nav class="section-nav" aria-label="Secciones de reservas">
				<button class:active={activeTab === 'calendar'} type="button" aria-current={activeTab === 'calendar' ? 'page' : undefined} onclick={() => switchTab('calendar')}>
					<CalendarDays size={17} aria-hidden="true" /><span>Calendario</span>
				</button>
				<button class:active={activeTab === 'list'} type="button" aria-current={activeTab === 'list' ? 'page' : undefined} onclick={() => switchTab('list')}>
					<List size={17} aria-hidden="true" /><span>Reservas</span>
				</button>
				<button class:active={activeTab === 'reports'} type="button" aria-current={activeTab === 'reports' ? 'page' : undefined} onclick={() => switchTab('reports')}>
					<FileText size={17} aria-hidden="true" /><span>Informe</span>
				</button>
				<button class:active={activeTab === 'settings'} type="button" aria-current={activeTab === 'settings' ? 'page' : undefined} onclick={() => switchTab('settings')}>
					<Settings size={17} aria-hidden="true" /><span>Ajustes</span>
				</button>
			</nav>
		{/if}

		{#if loading}
			{#if activeTab === 'calendar'}
				<div class="calendar-loading" aria-live="polite">
					<div class="loading-panel">
						<RefreshCw size={16} aria-hidden="true" />
						<span>Cargando reservas…</span>
					</div>
					<CalendarMonth
						{cursor}
						{selectedDate}
						reservations={[]}
						roomFilter="all"
						onSelectDate={(date) => (selectedDate = date)}
						onPreviousMonth={() => (cursor = previousMonth(cursor))}
						onNextMonth={() => (cursor = addMonth(cursor))}
					/>
				</div>
			{:else}
				<section class="loading-panel" aria-live="polite">
					<RefreshCw size={16} aria-hidden="true" />
					<span>Cargando reservas…</span>
				</section>
			{/if}
		{/if}
		{#if !loading && accessIssue && !sessionReady && !isPreviewMode}
			<section class="login-panel card">
				<div class="login-icon"><House size={23} aria-hidden="true" /></div>
				<h2>{accessIssue === 'unauthorized' ? 'Acceso familiar' : 'Entra con RS ID'}</h2>
				<p>{loadError}</p>
				<div class="login-tip">
					{accessIssue === 'unauthorized'
						? 'Usa una cuenta familiar autorizada. Si debería tener acceso, verifica el correo de RS ID.'
						: 'Toca «Entrar» arriba para iniciar sesión con RS ID. Si acabas de entrar, recarga esta página.'}
				</div>
			</section>
		{/if}
		{#if !loading && (sessionReady || isPreviewMode) && activeTab === 'calendar'}
			<div class="filter-row">
				<label for="calendar-room-filter">Ver alojamiento</label>
				<select id="calendar-room-filter" bind:value={roomFilter}>
					<option value="all">Todos los alojamientos</option>
					{#each rooms as room (room.id)}<option value={String(room.id)}>{room.nombre}</option>{/each}
				</select>
				<button class="button button-quiet refresh-button" type="button" onclick={() => void loadData()} disabled={refreshing}>
					<RefreshCw size={16} aria-hidden="true" /><span>{refreshing ? 'Actualizando…' : 'Actualizar'}</span>
				</button>
			</div>
			<div class="calendar-layout">
				<CalendarMonth
					{cursor}
					{selectedDate}
					{reservations}
					{roomFilter}
					onSelectDate={(date) => (selectedDate = date)}
					onPreviousMonth={() => (cursor = previousMonth(cursor))}
					onNextMonth={() => (cursor = addMonth(cursor))}
				/>
				<section class="selected-day card" aria-labelledby="selected-day-heading">
					<header class="selected-day-heading">
						<div>
							<p class="eyebrow">Día seleccionado</p>
							<h2 id="selected-day-heading">{formatDate(selectedDate, "EEEE d 'de' MMMM")}</h2>
						</div>
						<button class="icon-button" type="button" aria-label="Crear reserva para este día" onclick={() => openNewReservation(selectedDate)}>
							<Plus size={19} aria-hidden="true" />
						</button>
					</header>
					{#if selectedReservations.length}
						<div class="day-reservations">
							{#each selectedReservations as reservation (reservation.id)}
								<button class="day-reservation" type="button" onclick={() => openEditReservation(reservation)}>
									<span class="day-reservation-dot" class:from-booking={reservation.origin === 'booking'} class:from-airbnb={reservation.origin === 'airbnb'}></span>
									<span class="day-reservation-copy"><strong>{reservation.name}</strong><small>{reservation.room} · {formatDate(reservation.startDate)}–{formatDate(reservation.endDate)}</small></span>
									<ChevronRight size={17} aria-hidden="true" />
								</button>
							{/each}
						</div>
					{:else}
						<div class="empty-day">
							<div class="empty-icon"><CalendarDays size={23} aria-hidden="true" /></div>
							<strong>No hay reservas este día</strong>
							<p>Las fechas ocupadas de Booking y Airbnb también aparecen aquí.</p>
							<button class="button button-primary" type="button" onclick={() => openNewReservation(selectedDate)}><Plus size={17} aria-hidden="true" />Agregar reserva</button>
						</div>
					{/if}
				</section>
			</div>

			<section class="upcoming-section">
				<div class="section-heading">
					<div><p class="eyebrow">Vista rápida</p><h2>Próximas reservas</h2></div>
					<button class="text-button" type="button" onclick={() => switchTab('list')}>Ver todas <ChevronRight size={16} aria-hidden="true" /></button>
				</div>
				{#if upcomingReservations.length}
					<div class="reservation-list compact-list">
						{#each upcomingReservations as reservation (reservation.id)}
							<ReservationCard {reservation} onEdit={openEditReservation} onDelete={(item) => (pendingDelete = item)} onAddAnnotation={addAnnotation} onDeleteAnnotation={deleteAnnotation} />
						{/each}
					</div>
				{:else}
					<div class="card empty-list"><CalendarDays size={20} aria-hidden="true" /><span>No hay próximas reservas. Las anteriores siguen en «Ver todas».</span></div>
				{/if}
			</section>
		{/if}
		{#if !loading && (sessionReady || isPreviewMode) && activeTab === 'list'}
			<section class="list-view">
				<div class="section-heading list-heading">
					<div><p class="eyebrow">Registro completo</p><h2>Reservas</h2></div>
					<button class="button button-primary" type="button" onclick={() => openNewReservation()}><Plus size={18} aria-hidden="true" />Nueva reserva</button>
				</div>
				<div class="list-controls">
					<label class="search-field" for="reservation-search"><Search size={17} aria-hidden="true" /><input id="reservation-search" bind:value={listQuery} placeholder="Buscar huésped o alojamiento" autocomplete="off" /></label>
					<label class="sr-only" for="list-room-filter">Filtrar por alojamiento</label>
					<select id="list-room-filter" bind:value={roomFilter}><option value="all">Todos los alojamientos</option>{#each rooms as room (room.id)}<option value={String(room.id)}>{room.nombre}</option>{/each}</select>
				</div>
				{#if filteredReservations.length}
					<div class="reservation-list">
						{#each filteredReservations as reservation (reservation.id)}
						<ReservationCard {reservation} onEdit={openEditReservation} onDelete={(item) => (pendingDelete = item)} onAddAnnotation={addAnnotation} onDeleteAnnotation={deleteAnnotation} />
						{/each}
					</div>
				{:else}
					<div class="card empty-list"><Search size={20} aria-hidden="true" /><span>{reservations.length ? 'No encontramos reservas con esos filtros.' : 'Todavía no hay reservas registradas.'}</span></div>
				{/if}
			</section>
		{/if}
		{#if !loading && (sessionReady || isPreviewMode) && activeTab === 'reports'}
			<section class="report-screen">
				<header class="section-heading report-toolbar">
					<div><p class="eyebrow">Resumen del periodo</p><h2>Informe de reservas</h2></div>
					<button class="button button-primary" type="button" onclick={printReport}><FileText size={17} aria-hidden="true" />Guardar como PDF</button>
				</header>
				<div class="report-filters card">
					<div class="field"><label for="report-start">Desde</label><input id="report-start" type="date" bind:value={reportStart} /></div>
					<div class="field"><label for="report-end">Hasta</label><input id="report-end" type="date" bind:value={reportEnd} min={reportStart} /></div>
					<p>El informe usa solo los montos registrados. Las reservas sin monto aparecen indicadas, no como $0.</p>
				</div>
				<div class="report-summary">
					<div class="summary-card card"><span>Reservas</span><strong>{reportTotals.count}</strong></div>
					<div class="summary-card card"><span>Monto registrado</span><strong>${reportTotals.hosting.toFixed(2)}</strong></div>
					<div class="summary-card card"><span>Abonado</span><strong>${reportTotals.paid.toFixed(2)}</strong></div>
					<div class="summary-card card"><span>Sin monto</span><strong>{reportTotals.missingAmount}</strong></div>
				</div>
				<div class="report-table-wrap card">
					<table>
						<thead><tr><th>Alojamiento</th><th>Estadía</th><th>Nombre</th><th>Personas</th><th>Monto</th><th>Abonado</th><th>Saldo</th></tr></thead>
						<tbody>
							{#if reportReservations.length > 0}
								{#each reportReservations as reservation (reservation.id)}
									<tr>
										<td>{reservation.room}</td>
										<td>{formatDate(reservation.startDate, 'dd/MM/yyyy')}–{formatDate(reservation.endDate, 'dd/MM/yyyy')}</td>
										<td>{reservation.name}</td>
										<td>{reservation.peopleCount || 'Sin dato'}</td>
										<td>{reservation.totalPrice === null ? 'Sin monto' : `$${reservation.totalPrice.toFixed(2)}`}</td>
										<td>{reservation.totalPrice === null ? '—' : `$${reservation.amountPaid.toFixed(2)}`}</td>
										<td>{reservation.totalPrice === null ? '—' : `$${Math.max(reservation.totalPrice - reservation.amountPaid, 0).toFixed(2)}`}</td>
									</tr>
								{/each}
							{:else}
								<tr><td colspan="7" class="empty-table">No hay reservas en este periodo.</td></tr>
							{/if}
						</tbody>
					</table>
				</div>
				<div class="print-report">
					<header><img src="/brand/logo.webp" alt="Senderos Amados" /><div><h1>Informe de reservas</h1><p>Periodo: {formatDate(reportStart, 'dd/MM/yyyy')} al {formatDate(reportEnd, 'dd/MM/yyyy')}</p></div></header>
					<p class="print-totals">{reportTotals.count} reservas · Monto registrado: ${reportTotals.hosting.toFixed(2)} · Abonado: ${reportTotals.paid.toFixed(2)} · Sin monto: {reportTotals.missingAmount}</p>
					<table><thead><tr><th>Alojamiento</th><th>Entrada</th><th>Salida</th><th>Nombre</th><th>Personas</th><th>Monto</th><th>Abonado</th><th>Saldo</th><th>Origen</th></tr></thead><tbody>
						{#each reportReservations as reservation (reservation.id)}<tr><td>{reservation.room}</td><td>{formatDate(reservation.startDate, 'dd/MM/yyyy')}</td><td>{formatDate(reservation.endDate, 'dd/MM/yyyy')}</td><td>{reservation.name}</td><td>{reservation.peopleCount || 'Sin dato'}</td><td>{reservation.totalPrice === null ? 'Sin monto' : `$${reservation.totalPrice.toFixed(2)}`}</td><td>{reservation.totalPrice === null ? '—' : `$${reservation.amountPaid.toFixed(2)}`}</td><td>{reservation.totalPrice === null ? '—' : `$${Math.max(reservation.totalPrice - reservation.amountPaid, 0).toFixed(2)}`}</td><td>{reservation.origin === 'booking' ? 'Booking' : reservation.origin === 'airbnb' ? 'Airbnb' : reservation.origin === 'bot' ? 'Bot' : 'Manual'}</td></tr>{/each}
					</tbody></table>
					<footer>Senderos Amados · Informe familiar · {new Date().toLocaleDateString('es-PA')}</footer>
				</div>
			</section>
		{/if}
		<section class="settings-view" class:hidden={activeTab !== 'settings' || loading || (!sessionReady && !isPreviewMode)}>
				<header class="section-heading"><div><p class="eyebrow">Este dispositivo</p><h2>Ajustes</h2></div></header>
				<div class="settings-grid">
					<section class="settings-card card">
						<div class="settings-icon"><Bell size={20} aria-hidden="true" /></div>
						<h3>Avisos de nuevas reservas</h3>
						<p>Activa los avisos aquí para que este dispositivo reciba una notificación cuando se registre una reserva nueva.</p>
						{#if pushState === 'active'}
							<div class="settings-state is-on"><Check size={16} aria-hidden="true" />Avisos activos en este dispositivo</div>
							<button class="button button-quiet" type="button" disabled={pushBusy} onclick={togglePush}>{pushBusy ? 'Actualizando…' : 'Desactivar aquí'}</button>
						{:else if pushState === 'denied'}
							<div class="settings-state is-off"><CircleAlert size={16} aria-hidden="true" />El navegador bloqueó los avisos</div>
							<p class="settings-help">Cámbialo desde los ajustes de notificaciones del navegador o del teléfono.</p>
						{:else if pushState === 'unsupported'}
							<div class="settings-state is-off"><WifiOff size={16} aria-hidden="true" />Abre la app instalada para activar avisos</div>
							<p class="settings-help">Este navegador de desarrollo no permite probar avisos push.</p>
						{:else}
							<div class="settings-state"><Bell size={16} aria-hidden="true" />Este dispositivo todavía no está suscrito</div>
							<button class="button button-primary" type="button" disabled={pushBusy} onclick={togglePush}>{pushBusy ? 'Activando…' : 'Activar avisos'}</button>
						{/if}
						{#if pushMessage}<p class="settings-help" role="status">{pushMessage}</p>{/if}
					</section>

					<section class="settings-card card install-card">
						<div class="settings-icon"><Download size={20} aria-hidden="true" /></div>
						<h3>Instalar como aplicación</h3>
						<p>Agrega Reservas a la pantalla de inicio para abrirla como una app y recibir avisos en este dispositivo.</p>
						<button class="button button-quiet" type="button" onclick={installApp}>{isInstalled ? 'Ya está instalada' : 'Ver cómo instalar'}</button>
						{#if installMessage}<p class="settings-help" role="status">{installMessage}</p>{/if}
					</section>
				</div>

				<section class="calendar-settings-section">
					<div class="section-heading"><div><p class="eyebrow">Booking + Airbnb</p><h2>Calendarios externos</h2></div><span class="settings-count">Dos entradas por alojamiento</span></div>
				<div class="calendar-help card">
					<p><strong>Entrada:</strong> pega el enlace iCal que entrega cada plataforma. La app solo importa fechas bloqueadas, no nombres, huéspedes ni precios.</p>
					<p><strong>Salida:</strong> copia el enlace de cada alojamiento y pégalo tanto en Booking como en Airbnb para que bloqueen las reservas registradas aquí.</p>
					<p class="private-link-note">Los enlaces iCal son privados. No los compartas en chats públicos.</p>
				</div>
				{#if isPreviewMode}
					<div class="card empty-list"><CalendarDays size={20} aria-hidden="true" /><span>La vista previa muestra el diseño. Los enlaces se configuran en la app publicada.</span></div>
				{:else if !settingsLoaded}
					<div class="card settings-loading"><RefreshCw size={18} aria-hidden="true" />Cargando calendarios…</div>
				{:else if calendarSettings.length}
					<div class="external-calendar-list">
						{#each calendarSettings as calendar (calendar.roomId)}
							<article class="external-calendar-card card">
								<header class="external-calendar-heading"><div><span class="house-icon"><House size={18} aria-hidden="true" /></span><h3>{calendar.roomName}</h3></div><span class="outbound-label">Salida para las dos plataformas</span></header>
								<div class="outbound-row">
									<label class="sr-only" for={`feed-${calendar.roomId}`}>Enlace de salida para {calendar.roomName}</label>
									<input id={`feed-${calendar.roomId}`} readonly value={calendar.exportUrl || 'Se generará al configurar calendarios'} />
									<button class="button button-quiet" type="button" disabled={!calendar.exportUrl} onclick={() => void copyFeedLink(calendar.exportUrl)}><Share2 size={16} aria-hidden="true" />Copiar</button>
								</div>
								<div class="source-grid">
									{#each calendarSources as source (source.key)}
						{@const draftKey = calendarDraftKey(calendar.roomId, source.key)}
										<div class="source-form">
											<div class="source-title"><strong>{source.title}</strong><span class:connected={sourceStatus(calendar.roomId, source.key)?.configured}>{sourceStatus(calendar.roomId, source.key)?.configured ? 'Conectado' : 'Sin configurar'}</span></div>
											<label class="sr-only" for={`source-${calendar.roomId}-${source.key}`}>Enlace iCal de {source.title} para {calendar.roomName}</label>
							<input id={`source-${calendar.roomId}-${source.key}`} type="url" bind:value={calendarDrafts[draftKey]} oninput={() => { delete calendarFeedback[draftKey] }} placeholder="Pega aquí el enlace iCal" autocomplete="off" inputmode="url" />
											<div class="source-actions">
								<button class="button button-primary" type="button" disabled={savingCalendar === draftKey || !calendarDrafts[draftKey]?.trim()} onclick={() => void saveCalendar(calendar.roomId, source.key)}>{savingCalendar === draftKey ? 'Guardando…' : 'Guardar enlace'}</button>
								{#if sourceStatus(calendar.roomId, source.key)?.configured}<button class="text-button" type="button" disabled={syncingCalendar === draftKey} onclick={() => void syncCalendar(calendar.roomId, source.key)}><RefreshCw size={15} aria-hidden="true" />{syncingCalendar === draftKey ? 'Actualizando…' : 'Actualizar ahora'}</button>{/if}
											</div>
							{#if calendarFeedback[draftKey]}<small class:source-feedback-error={calendarFeedback[draftKey].kind === 'error'} class:source-feedback-success={calendarFeedback[draftKey].kind === 'success'} role={calendarFeedback[draftKey].kind === 'error' ? 'alert' : 'status'} aria-live="polite">{calendarFeedback[draftKey].message}</small>{/if}
											{#if sourceStatus(calendar.roomId, source.key)?.lastSyncedAt}<small>Última revisión: {new Date(sourceStatus(calendar.roomId, source.key)?.lastSyncedAt ?? '').toLocaleString('es-PA')}</small>{/if}
											{#if sourceStatus(calendar.roomId, source.key)?.lastError}<small class="source-error">No se pudo leer el calendario. Revisa que el enlace siga activo.</small>{/if}
										</div>
									{/each}
								</div>
							</article>
						{/each}
					</div>
				{:else}
					<div class="card empty-list"><CalendarDays size={20} aria-hidden="true" /><span>No hay alojamientos configurados en la API.</span></div>
				{/if}
				</section>
				<div class="privacy-footer"><CircleAlert size={16} aria-hidden="true" /><span>App privada para la familia. No compartas enlaces iCal ni notificaciones con personas fuera del equipo.</span></div>
				<footer class="site-footer">
					<span>Senderos Amados · Acceso familiar</span>
					<a class="site-credit" href="https://rsanjur.com" target="_blank" rel="noopener noreferrer">
						<img src="/brand/rs-logo.svg" alt="" width="20" height="20" />
						<span>Hecho por rsanjur.com</span>
					</a>
				</footer>
			</section>
	</main>
</div>

{#if formOpen}
	{#key editingReservation?.id ?? 'new-reservation'}
		<ReservationForm rooms={rooms} {statuses} reservation={editingReservation} initialDate={formInitialDate} onSave={saveReservation} onClose={() => (formOpen = false)} />
	{/key}
{/if}

{#if pendingDelete}
	<div class="confirm-backdrop" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) pendingDelete = null }}>
		<div class="confirm-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="delete-heading" aria-describedby="delete-description">
			<div class="confirm-icon"><CircleAlert size={22} aria-hidden="true" /></div>
			<h2 id="delete-heading">¿Eliminar esta reserva?</h2>
			<p id="delete-description">Se eliminará “{pendingDelete.name}” de {pendingDelete.room}. Esta acción no se puede deshacer.</p>
			<div class="confirm-actions"><button class="button button-quiet" type="button" onclick={() => (pendingDelete = null)}>Conservar</button><button class="button button-danger" type="button" onclick={() => void confirmDelete()}>Eliminar reserva</button></div>
		</div>
	</div>
{/if}

{#if !loading && (sessionReady || isPreviewMode)}
	<nav class="mobile-nav" aria-label="Navegación de la app">
		<button class:active={activeTab === 'calendar'} type="button" onclick={() => switchTab('calendar')}><CalendarDays size={19} aria-hidden="true" /><span>Calendario</span></button>
		<button class:active={activeTab === 'list'} type="button" onclick={() => switchTab('list')}><List size={19} aria-hidden="true" /><span>Reservas</span></button>
		<button class:active={activeTab === 'reports'} type="button" onclick={() => switchTab('reports')}><FileText size={19} aria-hidden="true" /><span>Informe</span></button>
		<button class:active={activeTab === 'settings'} type="button" onclick={() => switchTab('settings')}><Settings size={19} aria-hidden="true" /><span>Ajustes</span></button>
	</nav>
{/if}

<style>
	.page-intro,
	.section-heading,
	.filter-row,
	.selected-day-heading,
	.list-controls,
	.report-toolbar,
	.settings-state,
	.external-calendar-heading,
	.outbound-row,
	.source-title,
	.source-actions,
	.install-note,
	.alert,
	.toast {
		display: flex;
	}

	.page-intro {
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px;
		margin: 0 0 22px;
	}

	.intro-copy {
		margin: 10px 0 0;
		color: var(--muted);
		font-size: 15px;
	}

	.new-reservation {
		flex-shrink: 0;
	}

	.install-button {
		min-height: 42px;
		padding: 0 12px;
		font-size: 13px;
	}

	.rsid-profile:empty {
		display: none;
	}

	.section-nav {
		display: flex;
		align-items: center;
		gap: 4px;
		width: fit-content;
		margin-bottom: 19px;
		border: 1px solid #e0e8dd;
		border-radius: 14px;
		padding: 4px;
		background: #edf2e9;
	}

	.section-nav button {
		display: inline-flex;
		min-height: 42px;
		align-items: center;
		gap: 8px;
		border: 1px solid transparent;
		border-radius: 10px;
		padding: 0 14px;
		background: transparent;
		color: #607063;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}

	.section-nav button.active {
		border-color: #dbe5d9;
		background: #fff;
		color: var(--forest);
		box-shadow: 0 2px 6px rgb(36 60 43 / 5%);
	}

	.toast,
	.alert,
	.install-note {
		align-items: center;
		gap: 9px;
		margin-bottom: 13px;
	}

	.toast {
		justify-content: space-between;
	}

	.alert span,
	.install-note span {
		flex: 1;
	}

	.dismiss-notice {
		width: 35px;
		height: 35px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font-size: 22px;
		cursor: pointer;
	}

	.login-panel {
		display: grid;
		justify-items: center;
		gap: 10px;
		max-width: 520px;
		margin: 50px auto;
		padding: 36px 24px;
		text-align: center;
	}

	.login-icon,
	.empty-icon,
	.settings-icon,
	.confirm-icon {
		display: grid;
		width: 48px;
		height: 48px;
		place-items: center;
		border-radius: 15px;
		background: var(--leaf-pale);
		color: var(--forest);
	}

	.loading-panel {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin: 18px auto;
		padding: 8px 0;
		color: var(--muted);
		font-size: 14px;
	}

	.loading-panel :global(svg) {
		animation: spin 1.3s linear infinite;
	}

	.loading-panel span,
	.login-panel p {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	.login-panel h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 27px;
	}

	.login-tip {
		border-radius: 11px;
		padding: 10px 12px;
		background: #f5f7f2;
		color: #69766b;
		font-size: 13px;
	}

	.filter-row {
		align-items: center;
		gap: 10px;
		margin: 0 0 12px;
	}

	.filter-row label {
		color: var(--muted);
		font-size: 13px;
		font-weight: 700;
	}

	.filter-row select,
	.list-controls select {
		min-height: 44px;
		min-width: 190px;
		border: 1px solid var(--line);
		border-radius: 11px;
		padding: 0 34px 0 12px;
		background: white;
		color: var(--ink);
		font-size: 14px;
	}

	.refresh-button {
		min-height: 44px;
		margin-left: auto;
		padding: 0 12px;
		font-size: 14px;
	}

	.calendar-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.55fr) minmax(290px, 0.85fr);
		align-items: start;
		gap: 18px;
	}

	.selected-day {
		min-height: 100%;
		padding: 20px;
	}

	.selected-day-heading {
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 15px;
	}

	.selected-day-heading .eyebrow {
		margin-bottom: 4px;
	}

	.selected-day-heading h2,
	.section-heading h2 {
		margin: 0;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.025em;
		line-height: 1.2;
		text-transform: capitalize;
	}

	.day-reservations {
		display: grid;
		gap: 8px;
	}

	.day-reservation {
		display: flex;
		min-width: 0;
		min-height: 59px;
		align-items: center;
		gap: 10px;
		border: 1px solid #e9eee7;
		border-radius: 12px;
		padding: 9px 11px;
		background: #fff;
		text-align: left;
		cursor: pointer;
	}

	.day-reservation:hover {
		border-color: #c9dac8;
		background: #f8faf7;
	}

	.day-reservation-dot {
		width: 9px;
		height: 9px;
		flex: 0 0 9px;
		border-radius: 50%;
		background: #477b54;
	}

	.day-reservation-dot.from-booking {
		background: var(--sun);
	}

	.day-reservation-dot.from-airbnb {
		background: #ba5c56;
	}

	.day-reservation-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 2px;
	}

	.day-reservation-copy strong,
	.day-reservation-copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.day-reservation-copy strong {
		font-size: 14px;
	}

	.day-reservation-copy small {
		color: var(--muted);
		font-size: 12px;
	}

	.empty-day {
		display: grid;
		justify-items: center;
		gap: 9px;
		padding: 12px 8px 6px;
		text-align: center;
	}

	.empty-day .empty-icon {
		width: 43px;
		height: 43px;
		border-radius: 13px;
	}

	.empty-day strong {
		font-size: 15px;
	}

	.empty-day p {
		max-width: 240px;
		margin: 0 0 4px;
		color: var(--muted);
		font-size: 13px;
	}

	.empty-day .button {
		min-height: 42px;
	}

	.upcoming-section,
	.list-view,
	.report-screen,
	.settings-view {
		margin-top: 26px;
	}

	.section-heading {
		align-items: flex-end;
		justify-content: space-between;
		gap: 15px;
		margin-bottom: 13px;
	}

	.section-heading .eyebrow {
		margin-bottom: 4px;
	}

	.section-heading h2 {
		font-size: 25px;
	}

	.text-button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border: 0;
		border-radius: 8px;
		padding: 7px 8px;
		background: transparent;
		color: var(--forest);
		font-size: 14px;
		font-weight: 750;
		cursor: pointer;
	}

	.text-button:hover {
		background: #edf4eb;
	}

	.reservation-list {
		display: grid;
		gap: 11px;
	}

	.compact-list {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.empty-list {
		display: flex;
		min-height: 72px;
		align-items: center;
		gap: 10px;
		padding: 15px 17px;
		color: var(--muted);
		font-size: 14px;
	}

	.list-view,
	.report-screen,
	.settings-view {
		margin-top: 4px;
	}

	.settings-view.hidden {
		display: none;
	}

	.list-heading {
		align-items: center;
	}

	.list-controls {
		align-items: center;
		gap: 10px;
		margin: 0 0 13px;
	}

	.search-field {
		display: flex;
		min-height: 46px;
		flex: 1;
		align-items: center;
		gap: 9px;
		border: 1px solid var(--line);
		border-radius: 12px;
		padding: 0 12px;
		background: white;
		color: var(--muted);
	}

	.search-field input {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		border: 0;
		outline: 0;
		background: transparent;
		color: var(--ink);
		font-size: 16px;
	}

	.search-field input:focus-visible {
		outline: 0;
	}

	.report-toolbar {
		align-items: center;
	}

	.report-filters {
		display: grid;
		grid-template-columns: 190px 190px minmax(0, 1fr);
		align-items: end;
		gap: 12px;
		margin-bottom: 14px;
		padding: 17px;
	}

	.report-filters p {
		margin: 0 0 3px;
		color: var(--muted);
		font-size: 13px;
	}

	.report-summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}

	.summary-card {
		display: grid;
		gap: 5px;
		padding: 15px;
	}

	.summary-card span {
		color: var(--muted);
		font-size: 13px;
	}

	.summary-card strong {
		font-size: 21px;
		font-variant-numeric: tabular-nums;
	}

	.report-table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	th,
	td {
		border-bottom: 1px solid #edf1eb;
		padding: 12px 13px;
		text-align: left;
		white-space: nowrap;
	}

	th {
		background: #f7f9f5;
		color: #526357;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	tbody tr:last-child td {
		border-bottom: 0;
	}

	.empty-table {
		padding: 28px;
		color: var(--muted);
		text-align: center;
	}

	.print-report {
		display: none;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 13px;
	}

	.settings-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 10px;
		padding: 20px;
	}

	.settings-icon {
		width: 43px;
		height: 43px;
		border-radius: 13px;
	}

	.settings-card h3 {
		margin: 0;
		font-size: 17px;
	}

	.settings-card > p {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	.settings-state {
		align-items: center;
		gap: 7px;
		color: #68756a;
		font-size: 13px;
		font-weight: 700;
	}

	.settings-state.is-on {
		color: #2c673a;
	}

	.settings-state.is-off {
		color: #855334;
	}

	.settings-help {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
	}

	.calendar-settings-section {
		margin-top: 28px;
	}

	.settings-count,
	.outbound-label {
		border-radius: 999px;
		padding: 5px 10px;
		background: #edf3e9;
		color: #4a6650;
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
	}

	.calendar-help {
		margin-bottom: 12px;
		padding: 15px 17px;
		box-shadow: none;
	}

	.calendar-help p {
		margin: 0;
		color: #5f6f63;
		font-size: 14px;
	}

	.calendar-help p + p {
		margin-top: 7px;
	}

	.calendar-help strong {
		color: var(--ink);
	}

	.calendar-help .private-link-note {
		color: #8a5a2d;
		font-size: 13px;
	}

	.external-calendar-list {
		display: grid;
		gap: 13px;
	}

	.external-calendar-card {
		padding: 17px;
	}

	.external-calendar-heading {
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 12px;
	}

	.external-calendar-heading > div {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 9px;
	}

	.house-icon {
		display: grid;
		width: 37px;
		height: 37px;
		flex: 0 0 37px;
		place-items: center;
		border-radius: 11px;
		background: var(--leaf-pale);
		color: var(--forest);
	}

	.external-calendar-heading h3 {
		margin: 0;
		font-size: 17px;
	}

	.outbound-row {
		align-items: center;
		gap: 8px;
		margin-bottom: 13px;
	}

	.outbound-row input,
	.source-form input {
		width: 100%;
		min-width: 0;
		min-height: 45px;
		border: 1px solid #d9e3d7;
		border-radius: 11px;
		padding: 0 11px;
		background: #fbfcfa;
		color: #4c5b4f;
		font-size: 14px;
	}

	.outbound-row .button {
		min-height: 45px;
	}

	.source-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}

	.source-form {
		display: grid;
		min-width: 0;
		gap: 9px;
		border: 1px solid #e9eee7;
		border-radius: 13px;
		padding: 12px;
		background: #fcfdfb;
	}

	.source-title,
	.source-actions {
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.source-title strong {
		font-size: 14px;
	}

	.source-title span {
		color: #8a6a49;
		font-size: 11px;
		font-weight: 700;
	}

	.source-title span.connected {
		color: #3d7046;
	}

	.source-actions .button {
		min-height: 41px;
		padding: 0 12px;
		font-size: 13px;
	}

	.source-actions .text-button {
		min-height: 41px;
		font-size: 12px;
	}

	.source-form small {
		color: #728075;
		font-size: 12px;
	}

	.source-form small.source-error {
		color: var(--danger);
	}

	.source-form small.source-feedback-error {
		color: var(--danger);
	}

	.source-form small.source-feedback-success {
		color: #3d7046;
	}

	.settings-loading {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 16px;
		color: var(--muted);
	}

	.privacy-footer {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-top: 22px;
		color: #748074;
		font-size: 12px;
	}

	.privacy-footer :global(svg) {
		flex: 0 0 16px;
	}

	.site-footer {
		display: grid;
		justify-items: center;
		margin-top: 13px;
		color: #879387;
		font-size: 12px;
		text-align: center;
	}

	.site-credit {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		color: inherit;
		text-decoration: none;
	}

	.site-credit img {
		width: 20px;
		height: 20px;
		border-radius: 5px;
	}

	.site-credit:hover span {
		text-decoration: underline;
	}

	.confirm-backdrop {
		position: fixed;
		z-index: 1200;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 18px;
		background: rgb(24 39 29 / 48%);
	}

	.confirm-dialog {
		width: min(100%, 440px);
		padding: 23px;
	}

	.confirm-icon {
		background: #fff0e7;
		color: #a65232;
	}

	.confirm-dialog h2 {
		margin: 15px 0 7px;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 25px;
	}

	.confirm-dialog p {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	.confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 20px;
	}

	.mobile-nav {
		display: none;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 1020px) {
		.calendar-layout {
			grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
			gap: 12px;
		}

		.compact-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 760px) {
		.calendar-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.selected-day {
			min-height: 0;
		}

		.report-filters {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.report-filters p {
			grid-column: 1 / -1;
		}

		.compact-list {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 640px) {
		.page-intro {
			align-items: flex-start;
		}

		.intro-copy {
			max-width: 230px;
			font-size: 14px;
		}

		.new-reservation {
			width: 46px;
			min-width: 46px;
			padding: 0;
			font-size: 0;
		}

		.new-reservation :global(svg) {
			width: 20px;
			height: 20px;
		}

		.topbar-actions {
			gap: 6px;
		}

		.install-button {
			width: 42px;
			min-width: 42px;
			min-height: 42px;
			padding: 0;
		}

		.install-button span {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
		}

		.section-nav {
			display: none;
		}

		.filter-row {
			flex-wrap: wrap;
		}

		.filter-row label {
			width: 100%;
		}

		.filter-row select {
			min-width: 0;
			flex: 1;
		}

		.refresh-button {
			margin-left: 0;
		}

		.section-heading h2,
		.selected-day-heading h2 {
			font-size: 22px;
		}

		.list-heading {
			align-items: flex-end;
		}

		.list-heading .button {
			min-height: 42px;
			padding: 0 11px;
			font-size: 13px;
		}

		.list-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.list-controls select {
			width: 100%;
		}

		.report-toolbar {
			align-items: flex-start;
		}

		.report-toolbar .button {
			min-height: 42px;
			padding: 0 10px;
			font-size: 13px;
		}

		.report-filters {
			grid-template-columns: minmax(0, 1fr);
			padding: 14px;
		}

		.report-filters p {
			grid-column: auto;
		}

		.report-summary {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.summary-card {
			padding: 13px;
		}

		.summary-card strong {
			font-size: 19px;
		}

		.settings-grid,
		.source-grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.external-calendar-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.outbound-row {
			align-items: stretch;
		}

		.outbound-row .button {
			padding: 0 10px;
		}

		.source-actions {
			align-items: flex-start;
			flex-direction: column;
		}

		.mobile-nav {
			position: fixed;
			z-index: 1000;
			inset: auto 0 0;
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 2px;
			border-top: 1px solid #dfe7dc;
			padding: 6px 5px calc(6px + env(safe-area-inset-bottom));
			background: rgb(255 255 255 / 97%);
			backdrop-filter: blur(12px);
		}

		.mobile-nav button {
			display: flex;
			min-width: 0;
			min-height: 54px;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 3px;
			border: 0;
			border-radius: 11px;
			padding: 4px 2px;
			background: transparent;
			color: #738076;
			font-size: 10px;
			font-weight: 750;
			cursor: pointer;
		}

		.mobile-nav button.active {
			background: #edf4eb;
			color: var(--forest);
		}

		.mobile-nav button span {
			overflow: hidden;
			max-width: 100%;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	@media print {
		:global(html),
		:global(body) {
			background: #fff !important;
			color: #18271d !important;
		}

		:global(body) {
			font-size: 11px;
		}

		:global(.app-frame),
		:global(.mobile-nav),
		:global(dialog),
		:global(.confirm-backdrop) {
			display: none !important;
		}

		.print-report {
			display: block !important;
			padding: 0;
		}

		.print-report header {
			display: flex;
			align-items: center;
			gap: 16px;
			margin-bottom: 16px;
		}

		.print-report header img {
			width: 72px;
			height: 72px;
			object-fit: contain;
		}

		.print-report h1 {
			margin: 0;
			font-size: 22px;
		}

		.print-report header p,
		.print-totals {
			margin: 4px 0 0;
		}

		.print-report table {
			font-size: 9px;
		}

		.print-report th,
		.print-report td {
			padding: 6px 5px;
			white-space: normal;
		}

		.print-report footer {
			margin-top: 20px;
			color: #68756a;
			font-size: 9px;
		}
	}
</style>
