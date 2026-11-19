<script lang="ts">
	import type { DayBar, HourBar } from '#lib/signup-stats.ts';

	let { days, hours }: { days: DayBar[]; hours: HourBar[] } = $props();

	const daily = $derived(layoutDays(days));
	const hourly = $derived(layoutHours(hours));

	type Tip = { id: string; x: number; y: number; below: boolean; title: string; detail?: string };
	let tip = $state<Tip | null>(null);

	function layoutDays(series: DayBar[]) {
		const slot = Math.max(64, series.length > 14 ? 72 : 88);
		const padL = 52;
		const padR = 64;
		const padT = 36;
		const padB = 44;
		const width = Math.max(880, series.length * slot + padL + padR);
		const height = 360;
		const innerW = width - padL - padR;
		const innerH = height - padT - padB;
		const maxDay = Math.max(1, ...series.map((day) => day.count));
		const maxTotal = Math.max(1, ...series.map((day) => day.cumulative));
		const gap = innerW / Math.max(series.length, 1);
		const bars = series.map((day, index) => {
			const barH = day.count === 0 ? 0 : Math.max(8, (day.count / maxDay) * innerH);
			const barW = Math.min(gap * 0.72, 64);
			const x = padL + index * gap + (gap - barW) / 2;
			return { ...day, x, y: padT + innerH - barH, barW, barH, cx: padL + index * gap + gap / 2, hitX: padL + index * gap };
		});
		const line = bars
			.map((bar, index) => {
				const y = padT + innerH - (bar.cumulative / maxTotal) * innerH;
				return `${index === 0 ? 'M' : 'L'}${bar.cx.toFixed(1)} ${y.toFixed(1)}`;
			})
			.join(' ');
		const points = bars.map((bar) => ({
			x: bar.cx,
			y: padT + innerH - (bar.cumulative / maxTotal) * innerH
		}));
		return {
			width,
			height,
			padL,
			padT,
			innerH,
			gap,
			plotRight: width - padR,
			base: padT + innerH,
			bars,
			line,
			points,
			maxDay,
			maxTotal,
			leftTicks: axisTicks(maxDay),
			rightTicks: axisTicks(maxTotal)
		};
	}

	function layoutHours(series: HourBar[]) {
		const width = 920;
		const height = 300;
		const padL = 44;
		const padR = 16;
		const padT = 28;
		const padB = 40;
		const innerW = width - padL - padR;
		const innerH = height - padT - padB;
		const max = Math.max(1, ...series.map((hour) => hour.count));
		const gap = innerW / series.length;
		const bars = series.map((hour, index) => {
			const barH = hour.count === 0 ? 0 : Math.max(8, (hour.count / max) * innerH);
			const barW = gap * 0.7;
			const x = padL + index * gap + (gap - barW) / 2;
			return { ...hour, x, y: padT + innerH - barH, barW, barH, hitX: padL + index * gap };
		});
		return { width, height, padL, padT, innerH, gap, base: padT + innerH, bars, max, ticks: axisTicks(max) };
	}

	function axisTicks(max: number) {
		if (max <= 1) return [0, max];
		const mid = Math.round(max / 2);
		return [...new Set([0, mid, max])];
	}

	function yAt(max: number, value: number, padT: number, innerH: number) {
		return padT + innerH - (value / max) * innerH;
	}

	function noun(count: number) {
		return count === 1 ? 'sign-up' : 'sign-ups';
	}

	function hourName(hour: number) {
		const clock = hour % 12 || 12;
		return `${clock} ${hour < 12 ? 'AM' : 'PM'} ET`;
	}

	function place(el: SVGGraphicsElement) {
		const painted = el.querySelector('rect') ?? el;
		const rect = painted.getBoundingClientRect();
		const x = Math.min(window.innerWidth - 150, Math.max(150, rect.left + rect.width / 2));
		const y = rect.top;
		return { x, y, below: y < 88 };
	}

	function show(el: SVGGraphicsElement, id: string, title: string, detail?: string) {
		tip = { id, ...place(el), title, detail };
	}

	function hide(event: Event, id: string) {
		const el = event.currentTarget as Element;
		if (document.activeElement === el) return;
		if (tip?.id === id) tip = null;
	}

	function onKey(event: KeyboardEvent, el: SVGGraphicsElement, id: string, title: string, detail?: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		if (tip?.id === id) tip = null;
		else show(el, id, title, detail);
	}

	function tap(event: MouseEvent, el: SVGGraphicsElement, id: string, title: string, detail?: string) {
		const touch = window.matchMedia('(hover: none)').matches;
		if (!touch) return;
		event.preventDefault();
		if (tip?.id === id) tip = null;
		else show(el, id, title, detail);
	}

	$effect(() => {
		function dismiss(event: PointerEvent) {
			const target = event.target;
			if (target instanceof Element && target.closest('[data-bar]')) return;
			tip = null;
		}
		window.addEventListener('pointerdown', dismiss);
		return () => window.removeEventListener('pointerdown', dismiss);
	});
</script>

<section class="border-2 border-ink bg-cream p-5 text-ink md:p-6">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-[28px] leading-none">over time</h2>
			<p class="mt-2 text-[18px]">each day, and the running total. eastern time.</p>
		</div>
		<div class="flex gap-5 text-[16px]">
			<span class="inline-flex items-center gap-2"><span class="h-4 w-4 bg-ink"></span> that day</span>
			<span class="inline-flex items-center gap-2"><span class="h-1 w-6 bg-rust"></span> running total</span>
		</div>
	</div>
	<div class="overflow-x-auto">
		<svg
			class="block h-auto max-w-none font-pirate"
			width={daily.width}
			height={daily.height}
			viewBox={`0 0 ${daily.width} ${daily.height}`}
			role="img"
			aria-label="Daily sign-ups and running total in Eastern time. Hover or focus a bar for the exact count."
		>
			{#each daily.leftTicks as tick (tick)}
				<line
					x1={daily.padL}
					x2={daily.plotRight}
					y1={yAt(daily.maxDay, tick, daily.padT, daily.innerH)}
					y2={yAt(daily.maxDay, tick, daily.padT, daily.innerH)}
					stroke="#07160a"
					stroke-opacity="0.35"
					stroke-width="1.5"
				/>
				<text
					x={daily.padL - 10}
					y={yAt(daily.maxDay, tick, daily.padT, daily.innerH) + 5}
					text-anchor="end"
					class="fill-ink"
					font-size="16">{tick}</text
				>
			{/each}
			{#each daily.rightTicks as tick (`total-${tick}`)}
				<text
					x={daily.width - 8}
					y={yAt(daily.maxTotal, tick, daily.padT, daily.innerH) + 5}
					text-anchor="end"
					class="fill-rust"
					font-size="16">{tick}</text
				>
			{/each}
			<path d={daily.line} class="fill-none stroke-rust" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
			{#each daily.points as point, index (`${days[index].date}-pt`)}
				<circle cx={point.x} cy={point.y} r="5" class="fill-rust" />
			{/each}
			{#each daily.bars as bar (bar.date)}
				{@const title = `${bar.label}: ${bar.count} ${noun(bar.count)}`}
				<g
					data-bar
					data-id={bar.date}
					tabindex="0"
					role="button"
					aria-label={`${title}, running total ${bar.cumulative}`}
					class="cursor-pointer outline-none"
					onpointerenter={(event) => {
						if (event.pointerType === 'touch') return;
						show(event.currentTarget as SVGGraphicsElement, bar.date, title, `running total ${bar.cumulative}`);
					}}
					onpointerleave={(event) => hide(event, bar.date)}
					onfocus={(event) =>
						show(event.currentTarget as SVGGraphicsElement, bar.date, title, `running total ${bar.cumulative}`)}
					onblur={(event) => hide(event, bar.date)}
					onkeydown={(event) =>
						onKey(
							event,
							event.currentTarget as SVGGraphicsElement,
							bar.date,
							title,
							`running total ${bar.cumulative}`
						)}
					onclick={(event) =>
						tap(event, event.currentTarget as SVGGraphicsElement, bar.date, title, `running total ${bar.cumulative}`)}
				>
					<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} class={tip?.id === bar.date ? 'fill-rust' : 'fill-ink'} />
					{#if tip?.id === bar.date}
						<rect
							x={bar.x - 3}
							y={bar.y - 3}
							width={bar.barW + 6}
							height={bar.barH + 6}
							class="fill-none stroke-rust"
							stroke-width="3"
						/>
					{/if}
					{#if bar.barW >= 28 && bar.count > 0}
						<text
							x={bar.cx}
							y={bar.barH > 32 ? bar.y + 22 : bar.y - 8}
							text-anchor="middle"
							class="{bar.barH > 32 ? 'fill-cream' : 'fill-ink'} pointer-events-none"
							font-size="16">{bar.count}</text
						>
					{/if}
					<rect x={bar.hitX} y={daily.padT} width={daily.gap} height={daily.innerH} fill="transparent" pointer-events="all" />
				</g>
				<text x={bar.cx} y={daily.base + 26} text-anchor="middle" class="fill-ink" font-size="16">{bar.label}</text>
			{/each}
		</svg>
	</div>
</section>

<section class="border-2 border-ink bg-cream p-5 text-ink md:p-6">
	<h2 class="text-[28px] leading-none">by hour of day</h2>
	<p class="mt-2 text-[18px]">when people sign up, eastern time.</p>
	<div class="mt-4 overflow-x-auto">
		<svg
			class="block h-auto max-w-none font-pirate"
			width={hourly.width}
			height={hourly.height}
			viewBox={`0 0 ${hourly.width} ${hourly.height}`}
			role="img"
			aria-label="Sign-ups by hour of day in Eastern time. Hover or focus a bar for the exact count."
		>
			{#each hourly.ticks as tick (tick)}
				<line
					x1={hourly.padL}
					x2={hourly.width - 12}
					y1={yAt(hourly.max, tick, hourly.padT, hourly.innerH)}
					y2={yAt(hourly.max, tick, hourly.padT, hourly.innerH)}
					stroke="#07160a"
					stroke-opacity="0.35"
					stroke-width="1.5"
				/>
				<text
					x={hourly.padL - 8}
					y={yAt(hourly.max, tick, hourly.padT, hourly.innerH) + 5}
					text-anchor="end"
					class="fill-ink"
					font-size="16">{tick}</text
				>
			{/each}
			{#each hourly.bars as bar (bar.hour)}
				{@const title = `${hourName(bar.hour)}: ${bar.count} ${noun(bar.count)}`}
				<g
					data-bar
					data-id={`h-${bar.hour}`}
					tabindex="0"
					role="button"
					aria-label={title}
					class="cursor-pointer outline-none"
					onpointerenter={(event) => {
						if (event.pointerType === 'touch') return;
						show(event.currentTarget as SVGGraphicsElement, `h-${bar.hour}`, title);
					}}
					onpointerleave={(event) => hide(event, `h-${bar.hour}`)}
					onfocus={(event) => show(event.currentTarget as SVGGraphicsElement, `h-${bar.hour}`, title)}
					onblur={(event) => hide(event, `h-${bar.hour}`)}
					onkeydown={(event) =>
						onKey(event, event.currentTarget as SVGGraphicsElement, `h-${bar.hour}`, title)}
					onclick={(event) => tap(event, event.currentTarget as SVGGraphicsElement, `h-${bar.hour}`, title)}
				>
					<rect
						x={bar.x}
						y={bar.y}
						width={bar.barW}
						height={bar.barH}
						class={tip?.id === `h-${bar.hour}` ? 'fill-rust' : 'fill-ink'}
					/>
					{#if bar.barW >= 22 && bar.count > 0}
						<text
							x={bar.x + bar.barW / 2}
							y={bar.barH > 28 ? bar.y + 20 : bar.y - 8}
							text-anchor="middle"
							class="{bar.barH > 28 ? 'fill-cream' : 'fill-ink'} pointer-events-none"
							font-size="14">{bar.count}</text
						>
					{/if}
					<rect x={bar.hitX} y={hourly.padT} width={hourly.gap} height={hourly.innerH} fill="transparent" pointer-events="all" />
				</g>
				{#if bar.hour % 3 === 0}
					<text x={bar.x + bar.barW / 2} y={hourly.base + 26} text-anchor="middle" class="fill-ink" font-size="16"
						>{bar.label}</text
					>
				{/if}
			{/each}
		</svg>
	</div>
</section>

{#if tip}
	<div
		class="pointer-events-none fixed z-30 border-2 border-ink bg-cream px-3 py-2 text-[16px] leading-snug text-ink {tip.below
			? 'translate-y-2'
			: '-translate-y-full'}"
		style="left: {tip.x}px; top: {tip.y}px; transform: translateX(-50%) {tip.below ? 'translateY(8px)' : 'translateY(-100%)'};"
	>
		<p>{tip.title}</p>
		{#if tip.detail}
			<p>{tip.detail}</p>
		{/if}
	</div>
{/if}
