<script lang="ts">
	import { onMount } from 'svelte'
	import type { Snippet } from 'svelte'
	import '../app.css'
	let { children }: { children: Snippet } = $props()

	onMount(() => {
		if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
		void navigator.serviceWorker.register('/service-worker.js').catch(() => undefined)
	})
</script>

<svelte:head>
	<title>Reservas | Senderos Amados</title>
	<meta
		name="description"
		content="Calendario privado de reservas de Senderos Amados."
	/>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="color-scheme" content="light" />
</svelte:head>

{@render children()}
