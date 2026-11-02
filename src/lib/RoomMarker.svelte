<script lang="ts">
	import { LogIn, LogOut } from 'lucide-svelte'

	interface Props {
		roomId: number | null
		size?: number
		arrival?: boolean
		departure?: boolean
		lightOnDark?: boolean
	}

	let { roomId, size = 14, arrival = false, departure = false, lightOnDark = false }: Props = $props()

	function shapeClass(): string {
		if (roomId === 1) return 'room-one'
		if (roomId === 2) return 'room-two'
		if (roomId === 3) return 'room-three'
		return 'room-other'
	}
</script>

<span
	class="room-marker-wrap"
	class:light-on-dark={lightOnDark}
	style={`--marker-size: ${size}px`}
	aria-hidden="true"
>
	<span class={`room-marker ${shapeClass()}`}></span>
	{#if arrival || departure}
		<span class="event-arrows">
			{#if arrival}
				<span class="event-arrow">
					<span class="event-arrow-outline"><LogIn size={7} strokeWidth={5} /></span>
					<span class="event-arrow-ink"><LogIn size={7} strokeWidth={2.5} /></span>
				</span>
			{/if}
			{#if departure}
				<span class="event-arrow">
					<span class="event-arrow-outline"><LogOut size={7} strokeWidth={5} /></span>
					<span class="event-arrow-ink"><LogOut size={7} strokeWidth={2.5} /></span>
				</span>
			{/if}
		</span>
	{/if}
</span>

<style>
	.room-marker-wrap {
		position: relative;
		display: inline-block;
		flex: 0 0 var(--marker-size);
		width: var(--marker-size);
		height: var(--marker-size);
		vertical-align: middle;
	}

	.room-marker {
		position: absolute;
		top: 0;
		left: 0;
		width: var(--marker-size);
		height: var(--marker-size);
		background: transparent;
		filter: drop-shadow(0 0 1px #23362b);
	}

	.room-marker::before,
	.room-marker::after {
		position: absolute;
		content: '';
	}

	.room-marker::before {
		inset: 0;
		background: #fff;
	}

	.room-marker::after {
		inset: 2px;
		background: var(--room-color, #665d12);
	}

	.room-one {
		--room-color: #19743a;
	}

	.room-one::before,
	.room-one::after {
		border-radius: 50%;
	}

	.room-two {
		--room-color: #c62828;
	}

	.room-two::before,
	.room-two::after {
		clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
	}

	.room-three {
		--room-color: #225da8;
	}

	.room-three::before,
	.room-three::after {
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}

	.room-other::before {
		border-radius: 2px;
	}

	.room-other::after {
		border-radius: 1px;
	}

	.event-arrows {
		position: absolute;
		top: -8px;
		left: 50%;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1px;
		height: 7px;
		transform: translateX(-50%);
	}

	.event-arrow {
		position: relative;
		flex: 0 0 7px;
		width: 7px;
		height: 7px;
	}

	.event-arrow-outline,
	.event-arrow-ink {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
	}

	.event-arrow-outline {
		color: #fff;
	}

	.event-arrow-ink {
		color: #23362b;
	}

	.room-marker-wrap.light-on-dark .event-arrow-outline {
		color: #23362b;
	}

	.room-marker-wrap.light-on-dark .event-arrow-ink {
		color: #fff;
	}
</style>
