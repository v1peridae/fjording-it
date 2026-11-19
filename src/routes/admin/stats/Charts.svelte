<script lang="ts">
	import type { DayBar, HourBar } from '#lib/signup-stats.ts';

	let { days, hours }: { days: DayBar[]; hours: HourBar[] } = $props();

	const daily = $derived(layoutDays(days));
	const hourly = $derived(layoutHours(hours));

	function layoutDays(series: DayBar[]) {
		const slot = series.length > 18 ? 36 : 56;
		const width = Math.max(640, series.length * slot + 88);
		const height = series.length > 12 ? 280 : 250;
		const padL = 36;
		const padR = 46;
		const padT = 16;
		const padB = series.length > 12 ? 58 : 36;
		const innerW = width - padL - padR;
		const innerH = height - padT - padB;
		const maxDay = Math.max(1, ...series.map((day) => day.count));
		const maxTotal = Math.max(1, ...series.map((day) => day.cumulative));
		const gap = innerW / Math.max(series.length, 1);

		const bars = series.map((day, index) => {
			const barH = day.count === 0 ? 0 : Math.max(3, (day.count / maxDay) * innerH);
			const barW = Math.min(gap * 0.58, 32);
			const x = padL + index * gap + (gap - barW) / 2;
			return { ...day, x, y: padT + innerH - barH, barW, barH, cx: padL + index * gap + gap / 2 };
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
			base: padT + innerH,
			bars,
			line,
			points,
			maxDay,
			maxTotal,
			rotate: series.length > 12,
			dayTicks: tickIndexes(series.length),
			leftTicks: axisTicks(maxDay),
			rightTicks: axisTicks(maxTotal)
		};
	}

	function layoutHours(series: HourBar[]) {
		const width = 720;
		const height = 220;
		const padL = 32;
		const padR = 12;
		const padT = 12;
		const padB = 32;
		const innerW = width - padL - padR;
		const innerH = height - padT - padB;
		const max = Math.max(1, ...series.map((hour) => hour.count));
		const gap = innerW / series.length;
		const bars = series.map((hour, index) => {
			const barH = hour.count === 0 ? 0 : Math.max(3, (hour.count / max) * innerH);
			const barW = gap * 0.62;
			const x = padL + index * gap + (gap - barW) / 2;
			return { ...hour, x, y: padT + innerH - barH, barW, barH };
		});
		return { width, height, padL, padT, innerH, base: padT + innerH, bars, max, ticks: axisTicks(max) };
	}

	function axisTicks(max: number) {
		if (max <= 1) return [0, max];
		const mid = Math.round(max / 2);
		return [...new Set([0, mid, max])];
	}

	function tickIndexes(length: number) {
		if (length <= 12) return seriesIndexes(length);
		const step = Math.ceil(length / 8);
		const indexes: number[] = [];
		for (let i = 0; i < length; i += step) indexes.push(i);
		if (indexes.at(-1) !== length - 1) indexes.push(length - 1);
		return indexes;
	}

	function seriesIndexes(length: number) {
		return Array.from({ length }, (_, index) => index);
	}

	function y(max: number, value: number, padT: number, innerH: number) {
		return padT + innerH - (value / max) * innerH;
	}

	const busiest = $derived(
		days.reduce((best, day) => (day.count > best.count ? day : best), days[0] ?? { label: '', count: 0 })
	);
	const busiestHour = $derived(
		hours.reduce((best, hour) => (hour.count > best.count ? hour : best), hours[0] ?? { label: '', count: 0 })
	);
</script>

<section class="mt-8">
	<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-[22px]">over time</h2>
			<p class="mt-1 text-[15px]">each day, and the running total. eastern time.</p>
		</div>
		<div class="flex gap-4 text-[15px]">
			<span class="inline-flex items-center gap-2"><span class="h-3 w-3 bg-ink"></span> that day</span>
			<span class="inline-flex items-center gap-2"><span class="h-0.5 w-4 bg-rust"></span> running total</span>
		</div>
	</div>
	<div class="overflow-x-auto">
		<svg
			class="block h-auto max-w-none font-pirate"
			width={daily.width}
			height={daily.height}
			viewBox={`0 0 ${daily.width} ${daily.height}`}
			role="img"
			aria-label={`Daily sign-ups and running total in Eastern time. Busiest day ${busiest.label} with ${busiest.count}.`}
		>
			{#each daily.leftTicks as tick (tick)}
				<line
					x1={daily.padL}
					x2={daily.width - 46}
					y1={y(daily.maxDay, tick, daily.padT, daily.innerH)}
					y2={y(daily.maxDay, tick, daily.padT, daily.innerH)}
					class="stroke-ink/25"
				/>
				<text
					x={daily.padL - 8}
					y={y(daily.maxDay, tick, daily.padT, daily.innerH) + 4}
					text-anchor="end"
					class="fill-ink"
					font-size="13">{tick}</text
				>
			{/each}
			{#each daily.rightTicks as tick (tick)}
				<text
					x={daily.width - 8}
					y={y(daily.maxTotal, tick, daily.padT, daily.innerH) + 4}
					text-anchor="end"
					class="fill-rust"
					font-size="13">{tick}</text
				>
			{/each}
			{#each daily.bars as bar (bar.date)}
				<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} class="fill-ink">
					<title>{bar.label}: {bar.count}</title>
				</rect>
			{/each}
			<path d={daily.line} class="fill-none stroke-rust" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
			{#if daily.points.length <= 21}
				{#each daily.points as point, index (`${days[index].date}-pt`)}
					<circle cx={point.x} cy={point.y} r="3.5" class="fill-rust">
						<title>{days[index].label}: {days[index].cumulative} total</title>
					</circle>
				{/each}
			{/if}
			{#each daily.dayTicks as index (days[index].date)}
				<text
					x={daily.bars[index].cx}
					y={daily.rotate ? daily.base + 16 : daily.base + 20}
					text-anchor={daily.rotate ? 'end' : 'middle'}
					class="fill-ink"
					font-size="13"
					transform={daily.rotate ? `rotate(-40 ${daily.bars[index].cx} ${daily.base + 16})` : undefined}
					>{days[index].label}</text
				>
			{/each}
		</svg>
	</div>
</section>

<section class="mt-8">
	<h2 class="text-[22px]">by hour of day</h2>
	<p class="mt-1 text-[15px]">when people sign up, eastern time. busiest hour is {busiestHour.label}.</p>
	<div class="mt-4 overflow-x-auto">
		<svg
			class="block h-auto max-w-none font-pirate"
			width={hourly.width}
			height={hourly.height}
			viewBox={`0 0 ${hourly.width} ${hourly.height}`}
			role="img"
			aria-label={`Sign-ups by hour of day in Eastern time. Busiest hour ${busiestHour.label} with ${busiestHour.count}.`}
		>
			{#each hourly.ticks as tick (tick)}
				<line
					x1={hourly.padL}
					x2={hourly.width - 12}
					y1={y(hourly.max, tick, hourly.padT, hourly.innerH)}
					y2={y(hourly.max, tick, hourly.padT, hourly.innerH)}
					class="stroke-ink/25"
				/>
				<text
					x={hourly.padL - 6}
					y={y(hourly.max, tick, hourly.padT, hourly.innerH) + 4}
					text-anchor="end"
					class="fill-ink"
					font-size="13">{tick}</text
				>
			{/each}
			{#each hourly.bars as bar (bar.hour)}
				<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} class="fill-ink">
					<title>{bar.label}: {bar.count}</title>
				</rect>
				{#if bar.hour % 3 === 0}
					<text
						x={bar.x + bar.barW / 2}
						y={hourly.base + 20}
						text-anchor="middle"
						class="fill-ink"
						font-size="13">{bar.label}</text
					>
				{/if}
			{/each}
		</svg>
	</div>
</section>
