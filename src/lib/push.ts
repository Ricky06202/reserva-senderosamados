import { api } from './api'

function applicationKey(value: string): ArrayBuffer {
	const padding = '='.repeat((4 - (value.length % 4)) % 4)
	const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
	const raw = atob(base64)
	const bytes = new Uint8Array(raw.length)
	for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
	return bytes.buffer as ArrayBuffer
}

export function canReceivePush(): boolean {
	return typeof window !== 'undefined' &&
		navigator.serviceWorker !== undefined &&
		'PushManager' in window &&
		'Notification' in window
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
	if (!canReceivePush()) return null
	const registration = await navigator.serviceWorker.ready
	return registration.pushManager.getSubscription()
}

export async function enablePushOnThisDevice(): Promise<void> {
	if (!canReceivePush()) throw new Error('Este navegador no permite avisos push.')
	if (Notification.permission === 'denied') {
		throw new Error('Los avisos están bloqueados. Actívalos desde los ajustes del navegador.')
	}

	const permission = Notification.permission === 'granted'
		? 'granted'
		: await Notification.requestPermission()
	if (permission !== 'granted') throw new Error('No se dio permiso para enviar avisos.')

	const registration = await navigator.serviceWorker.ready
	const { publicKey } = await api.getPushPublicKey()
	if (!publicKey) throw new Error('Todavía no está configurado el servicio de avisos.')

	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: applicationKey(publicKey)
		}))

	await api.savePushSubscription(subscription.toJSON())
}

export async function disablePushOnThisDevice(): Promise<void> {
	const subscription = await currentPushSubscription()
	if (!subscription) return
	await api.deletePushSubscription(subscription.endpoint)
	await subscription.unsubscribe()
}
