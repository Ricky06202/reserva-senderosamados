import { assets, immutable } from '$app/manifest'
import { version } from '$app/env'
import { self } from '$app/service-worker'

const CACHE_NAME = `senderos-shell-${version}`
const STATIC_PATHS = new Set(
	[...new Set([...immutable, ...assets].map((asset) => asset.path))].map((path) =>
		path.startsWith('/') ? path : `/${path}`
	)
)
const APP_SHELL = '/'

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(async (cache) => {
			await cache.addAll([...STATIC_PATHS, APP_SHELL])
		})
	)
	self.skipWaiting()
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith('senderos-shell-') && key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	)
})

self.addEventListener('fetch', (event) => {
	const request = event.request
	const url = new URL(request.url)

	if (request.method !== 'GET' || url.origin !== self.location.origin) return
	if (url.pathname.startsWith('/api/')) return

	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(async () => (await caches.match(APP_SHELL)) ?? Response.error())
		)
		return
	}

	if (STATIC_PATHS.has(url.pathname)) {
		event.respondWith(
			caches.match(request).then((cached) => cached ?? fetch(request, { cache: 'no-store' }))
		)
	}
})

self.addEventListener('push', (event) => {
	let payload: { title?: string; body?: string; url?: string } = {
		title: 'Senderos Amados',
		body: 'Hay una nueva actualización de reservas.',
		url: '/'
	}

	try {
		if (event.data) payload = { ...payload, ...event.data.json() }
	} catch {
		// El aviso genérico basta si el contenido no es JSON válido.
	}

	event.waitUntil(
		self.registration.showNotification(payload.title || 'Senderos Amados', {
			body: payload.body || 'Hay una nueva actualización de reservas.',
			icon: '/icons/senderos-192.png',
			badge: '/icons/senderos-192.png',
			data: { url: payload.url || '/' },
			tag: 'senderos-reserva'
		})
	)
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const rawUrl = (event.notification.data as { url?: string } | undefined)?.url || '/'
	const target = new URL(rawUrl, self.location.origin)
	if (target.origin !== self.location.origin) target.pathname = '/'

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
			for (const client of clients) {
				if ('focus' in client && 'navigate' in client) {
					await client.navigate(target.href)
					return client.focus()
				}
			}
			return self.clients.openWindow(target.href)
		})
	)
})
