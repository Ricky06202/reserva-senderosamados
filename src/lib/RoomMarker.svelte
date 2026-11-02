<script lang="ts">
	import { LogOut } from 'lucide-svelte'

	interface Props {
		roomId: number | null
		size?: number
		departure?: boolean
	}

	let { roomId, size = 14, departure = false }: Props = $props()

	function shapeClass(): string {
		if (roomId === 1) return 'room-one'
		if (roomId === 2) return 'room-two'
		if (roomId === 3) return 'room-three'
		return 'room-other'
	}
</script>

<span class="room-marker-wrap" style={`--marker-size: ${size}px`} aria-hidden="true">
	<span class={`room-marker ${shapeClass()}`}></span>
	{#if departure}
		<LogOut class="departure-mark" size={8} strokeWidth={3} aria-hidden="true" />
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
		inset: 0;
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

	.departure-mark {
		position: absolute;
		right: -2px;
		bottom: -2px;
		z-index: 1;
		box-sizing: content-box;
		padding: 1px;
		border-radius: 50%;
		background: #fff;
		color: #23362b;
		filter: drop-shadow(0 0 1px #fff);
	}
</style>
