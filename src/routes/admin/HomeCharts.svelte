<script lang="ts">
	import type { ChallengeDay, FlagBar, HoursPoint, StackColumn, Throughput } from '#lib/admin-charts.ts';
	import type { DayBar } from '#lib/signup-stats.ts';

	let {
		signups,
		submissions,
		challengeNames,
		pipeline,
		approved,
		flags,
		throughput
	}: {
		signups: { error: string } | { days: DayBar[] };
		submissions: ChallengeDay[];
		challengeNames: { slug: string; name: string }[];
		pipeline: StackColumn[];
		approved: HoursPoint[];
		flags: FlagBar[];
		throughput: Throughput;
	} = $props();

	const INK = '#07160a';
	const RUST = '#8a2b1d';
	const CREAM = '#f9f3d5';
	const SERIES = [INK, RUST, '#7BA35A', '#2FB3A0', '#6B5294'];
	const PART: Record<string, string> = {
		pending: INK,
		needs_changes: RUST,
		rejected: '#b83227',
		fraud: RUST,
		needs_info: '#e3b341',
		confirmed: '#7BA35A',
		clear: '#7BA35A'
	};

	type Tip = { id: string; x: number; y: number; below: boolean; title: string; detail?: string };
	let tip = $state<Tip | null>(null);

	const daily = $derived('days' in signups ? layoutBars(signups.days.map((day) => ({ ...day, value: day.count, line: day.cumulative }))) : null);
	const ships = $derived(layoutStacked(submissions.map((day) => ({ key: day.date, label: day.label, parts: challengeParts(day) }))));
	const funnel = $derived(layoutStacked(pipeline.map((column) => ({ key: column.key, label: column.label, parts: column.parts.map((part) => ({ key: part.key, label: part.label, count: part.count, color: PART[part.key] ?? INK })) }))));
	const hours = $derived(layoutBars(approved.map((day) => ({ key: day.date, label: day.label, value: day.hours, line: day.cumulative }))));
	const flagChart = $derived(layoutBars(flags.map((row) => ({ key: row.kind, label: row.label, value: row.flagged, line: null }))));
	const flow = $derived(layoutLines(throughput));

	function challengeParts(day: ChallengeDay) {
		const slugs = challengeNames.map((challenge) => challenge.slug);
		const extra = Object.keys(day.counts).filter((slug) => !slugs.includes(slug));
		return [...slugs, ...extra]
			.filter((slug) => (day.counts[slug] ?? 0) > 0)
			.map((slug) => {
				const known = challengeNames.findIndex((challenge) => challenge.slug === slug);
				const colorIndex = known >= 0 ? known : challengeNames.length + extra.indexOf(slug);
				return {
					key: slug,
					label: challengeNames.find((challenge) => challenge.slug === slug)?.name ?? slug,
					count: day.counts[slug] ?? 0,
					color: SERIES[colorIndex % SERIES.length]
				};
			});
	}

	function layoutBars(series: { key?: string; date?: string; label: string; value: number; line: number | null }[]) {
		if (series.length === 0) return null;
		const slot = Math.max(72, series.length > 10 ? 64 : 88);
		const padL = 48;
		const padR = series.some((row) => row.line != null) ? 56 : 16;
		const padT = 28;
		const padB = 44;
		const width = Math.max(640, series.length * slot + padL + padR);
		const height = 280;
		const innerH = height - padT - padB;
		const gap = (width - padL - padR) / series.length;
		const maxBar = Math.max(1, ...series.map((row) => row.value));
		const lineValues = series.map((row) => row.line).filter((value): value is number => value != null);
		const maxLine = Math.max(1, ...lineValues, 0);
		const bars = series.map((row, index) => {
			const barH = row.value === 0 ? 0 : Math.max(6, (row.value / maxBar) * innerH);
			const barW = Math.min(gap * 0.62, 48);
			const x = padL + index * gap + (gap - barW) / 2;
			const cx = padL + index * gap + gap / 2;
			return { ...row, id: row.key ?? row.date ?? String(index), x, y: padT + innerH - barH, barW, barH, cx, hitX: padL + index * gap };
		});
		const points = bars.map((bar) => ({
			x: bar.cx,
			y: bar.line == null ? 0 : padT + innerH - (bar.line / maxLine) * innerH
		}));
		const line = bars
			.map((bar, index) => (bar.line == null ? '' : `${index === 0 ? 'M' : 'L'}${bar.cx.toFixed(1)} ${points[index].y.toFixed(1)}`))
			.join(' ');
		return { width, height, padL, padT, padR, innerH, gap, base: padT + innerH, bars, points, line, maxBar, maxLine, left: ticks(maxBar), right: ticks(maxLine), hasLine: lineValues.length > 0 };
	}

	function layoutStacked(columns: { key: string; label: string; parts: { key: string; label: string; count: number; color: string }[] }[]) {
		if (columns.length === 0) return null;
		const padL = 48;
		const padR = 16;
		const padT = 28;
		const padB = 44;
		const width = Math.max(640, columns.length * 120 + padL + padR);
		const height = 280;
		const innerH = height - padT - padB;
		const gap = (width - padL - padR) / columns.length;
		const max = Math.max(1, ...columns.map((column) => column.parts.reduce((sum, part) => sum + part.count, 0)));
		const drawn = columns.map((column, index) => {
			const total = column.parts.reduce((sum, part) => sum + part.count, 0);
			const barW = Math.min(gap * 0.62, 72);
			const x = padL + index * gap + (gap - barW) / 2;
			let y = padT + innerH;
			const segs = column.parts.map((part) => {
				const h = (part.count / max) * innerH;
				y -= h;
				return { ...part, x, y, h, w: barW, id: `${column.key}-${part.key}` };
			});
			return { ...column, total, x, barW, cx: x + barW / 2, segs };
		});
		return { width, height, padL, padT, innerH, base: padT + innerH, max, drawn, left: ticks(max) };
	}

	function layoutLines(data: Throughput) {
		if (data.days.length === 0 || data.reviewers.length === 0) return null;
		const padL = 48;
		const padR = 16;
		const padT = 28;
		const padB = 44;
		const width = Math.max(640, data.days.length * 88 + padL + padR);
		const height = 280;
		const innerH = height - padT - padB;
		const gap = (width - padL - padR) / data.days.length;
		const max = Math.max(1, ...data.days.flatMap((day) => data.reviewers.map((email) => day.counts[email] ?? 0)));
		const series = data.reviewers.map((email, index) => {
			const points = data.days.map((day, dayIndex) => {
				const count = day.counts[email] ?? 0;
				return {
					x: padL + dayIndex * gap + gap / 2,
					y: padT + innerH - (count / max) * innerH,
					count,
					label: day.label,
					id: `${email}-${day.date}`
				};
			});
			const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
			return { email, color: SERIES[index % SERIES.length], points, d };
		});
		return { width, height, padL, padT, innerH, base: padT + innerH, gap, max, left: ticks(max), days: data.days, series };
	}

	function ticks(max: number) {
		if (max <= 1) return [0, max];
		return [...new Set([0, Math.round(max / 2), max])];
	}

	function yAt(max: number, value: number, padT: number, innerH: number) {
		return padT + innerH - (value / Math.max(max, 1)) * innerH;
	}

	function place(el: SVGGraphicsElement) {
		const painted = el.querySelector('rect, circle') ?? el;
		const rect = painted.getBoundingClientRect();
		const x = Math.min(window.innerWidth - 160, Math.max(160, rect.left + rect.width / 2));
		return { x, y: rect.top, below: rect.top < 88 };
	}

	function show(el: SVGGraphicsElement, id: string, title: string, detail?: string) {
		tip = { id, ...place(el), title, detail };
	}

	function hide(event: Event, id: string) {
		if (document.activeElement === event.currentTarget) return;
		if (tip?.id === id) tip = null;
	}

	function onKey(event: KeyboardEvent, el: SVGGraphicsElement, id: string, title: string, detail?: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
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

<section class="card-cream chart">
	<div class="sec-head">
		<h2>waitlist emails over time</h2>
		<span class="sub">each day, and the running total. eastern time. <a href="/admin/stats">waitlist →</a></span>
	</div>
	{#if 'error' in signups}
		<p>{signups.error}</p>
	{:else if !daily}
		<p>no sign-ups yet</p>
	{:else}
		<div class="legend"><span><i style="background:#07160a"></i> that day</span><span><i class="line"></i> running total</span></div>
		<div class="scroll">
			<svg class="plot" width={daily.width} height={daily.height} viewBox={`0 0 ${daily.width} ${daily.height}`} role="img" aria-label="Daily sign-ups and running total. Hover a bar for the count.">
				{#each daily.left as tick (tick)}
					<line x1={daily.padL} x2={daily.width - daily.padR} y1={yAt(daily.maxBar, tick, daily.padT, daily.innerH)} y2={yAt(daily.maxBar, tick, daily.padT, daily.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={daily.padL - 8} y={yAt(daily.maxBar, tick, daily.padT, daily.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each daily.right as tick (`s-${tick}`)}
					<text x={daily.width - 8} y={yAt(daily.maxLine, tick, daily.padT, daily.innerH) + 5} text-anchor="end" fill={RUST} font-size="15">{tick}</text>
				{/each}
				<path d={daily.line} fill="none" stroke={RUST} stroke-width="3" />
				{#each daily.points as point, index (`sp-${daily.bars[index].id}`)}
					<circle cx={point.x} cy={point.y} r="4.5" fill={RUST} />
				{/each}
				{#each daily.bars as bar (bar.id)}
					{@const title = `${bar.label}: ${bar.value} ${bar.value === 1 ? 'sign-up' : 'sign-ups'}`}
					<g data-bar tabindex="0" role="button" aria-label={`${title}, running total ${bar.line}`} class="hit"
						onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, bar.id, title, `running total ${bar.line}`); }}
						onpointerleave={(event) => hide(event, bar.id)}
						onfocus={(event) => show(event.currentTarget, bar.id, title, `running total ${bar.line}`)}
						onblur={(event) => hide(event, bar.id)}
						onkeydown={(event) => onKey(event, event.currentTarget, bar.id, title, `running total ${bar.line}`)}>
						<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} fill={tip?.id === bar.id ? RUST : INK} />
						<rect x={bar.hitX} y={daily.padT} width={daily.gap} height={daily.innerH} fill="transparent" />
					</g>
					<text x={bar.cx} y={daily.base + 24} text-anchor="middle" fill={INK} font-size="15">{bar.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

<section class="card-cream chart">
	<div class="sec-head">
		<h2>submissions per day</h2>
		<span class="sub">one stack per day, split by challenge. eastern time.</span>
	</div>
	{#if !ships}
		<p>no submissions yet</p>
	{:else}
		<div class="legend">
			{#each challengeNames as challenge, index (challenge.slug)}
				<span><i style="background:{SERIES[index % SERIES.length]}"></i> {challenge.name}</span>
			{/each}
		</div>
		<div class="scroll">
			<svg class="plot" width={ships.width} height={ships.height} viewBox={`0 0 ${ships.width} ${ships.height}`} role="img" aria-label="Submissions per day by challenge.">
				{#each ships.left as tick (tick)}
					<line x1={ships.padL} x2={ships.width - 12} y1={yAt(ships.max, tick, ships.padT, ships.innerH)} y2={yAt(ships.max, tick, ships.padT, ships.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={ships.padL - 8} y={yAt(ships.max, tick, ships.padT, ships.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each ships.drawn as column (column.key)}
					{#each column.segs as seg (seg.id)}
						{@const title = `${column.label} · ${seg.label}: ${seg.count}`}
						<g data-bar tabindex="0" role="button" aria-label={title} class="hit"
							onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, seg.id, title); }}
							onpointerleave={(event) => hide(event, seg.id)}
							onfocus={(event) => show(event.currentTarget, seg.id, title)}
							onblur={(event) => hide(event, seg.id)}
							onkeydown={(event) => onKey(event, event.currentTarget, seg.id, title)}>
							<rect x={seg.x} y={seg.y} width={seg.w} height={Math.max(seg.h, 1)} fill={seg.color} stroke={CREAM} />
						</g>
					{/each}
					<text x={column.cx} y={ships.base + 24} text-anchor="middle" fill={INK} font-size="15">{column.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

<section class="card-cream chart">
	<div class="sec-head">
		<h2>review pipeline</h2>
		<span class="sub">stacked by status. first pass, fraud check, HQ confirmation, then approved.</span>
	</div>
	{#if !funnel}
		<p>no submissions yet</p>
	{:else}
		<div class="scroll">
			<svg class="plot" width={funnel.width} height={funnel.height} viewBox={`0 0 ${funnel.width} ${funnel.height}`} role="img" aria-label="Review pipeline by stage, stacked by status.">
				{#each funnel.left as tick (tick)}
					<line x1={funnel.padL} x2={funnel.width - 12} y1={yAt(funnel.max, tick, funnel.padT, funnel.innerH)} y2={yAt(funnel.max, tick, funnel.padT, funnel.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={funnel.padL - 8} y={yAt(funnel.max, tick, funnel.padT, funnel.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each funnel.drawn as column (column.key)}
					{#each column.segs as seg (seg.id)}
						{@const title = `${column.label} · ${seg.label}: ${seg.count}`}
						<g data-bar tabindex="0" role="button" aria-label={title} class="hit"
							onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, seg.id, title); }}
							onpointerleave={(event) => hide(event, seg.id)}
							onfocus={(event) => show(event.currentTarget, seg.id, title)}
							onblur={(event) => hide(event, seg.id)}
							onkeydown={(event) => onKey(event, event.currentTarget, seg.id, title)}>
							<rect x={seg.x} y={seg.y} width={seg.w} height={Math.max(seg.h, 1)} fill={seg.color} stroke={CREAM} />
						</g>
					{/each}
					<text x={column.cx} y={funnel.base + 24} text-anchor="middle" fill={INK} font-size="15">{column.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

<section class="card-cream chart">
	<div class="sec-head">
		<h2>approved hours over time</h2>
		<span class="sub">hours confirmed that day, and the running total. eastern time.</span>
	</div>
	{#if !hours}
		<p>no approved hours yet</p>
	{:else}
		<div class="legend"><span><i style="background:#07160a"></i> that day</span><span><i class="line"></i> running total</span></div>
		<div class="scroll">
			<svg class="plot" width={hours.width} height={hours.height} viewBox={`0 0 ${hours.width} ${hours.height}`} role="img" aria-label="Approved hours by day and running total.">
				{#each hours.left as tick (tick)}
					<line x1={hours.padL} x2={hours.width - hours.padR} y1={yAt(hours.maxBar, tick, hours.padT, hours.innerH)} y2={yAt(hours.maxBar, tick, hours.padT, hours.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={hours.padL - 8} y={yAt(hours.maxBar, tick, hours.padT, hours.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each hours.right as tick (`h-${tick}`)}
					<text x={hours.width - 8} y={yAt(hours.maxLine, tick, hours.padT, hours.innerH) + 5} text-anchor="end" fill={RUST} font-size="15">{tick}</text>
				{/each}
				<path d={hours.line} fill="none" stroke={RUST} stroke-width="3" />
				{#each hours.points as point, index (`hp-${hours.bars[index].id}`)}
					<circle cx={point.x} cy={point.y} r="4.5" fill={RUST} />
				{/each}
				{#each hours.bars as bar (bar.id)}
					{@const title = `${bar.label}: ${bar.value}h approved`}
					<g data-bar tabindex="0" role="button" aria-label={`${title}, running total ${bar.line}h`} class="hit"
						onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, bar.id, title, `running total ${bar.line}h`); }}
						onpointerleave={(event) => hide(event, bar.id)}
						onfocus={(event) => show(event.currentTarget, bar.id, title, `running total ${bar.line}h`)}
						onblur={(event) => hide(event, bar.id)}
						onkeydown={(event) => onKey(event, event.currentTarget, bar.id, title, `running total ${bar.line}h`)}>
						<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} fill={tip?.id === bar.id ? RUST : INK} />
						<rect x={bar.hitX} y={hours.padT} width={hours.gap} height={hours.innerH} fill="transparent" />
					</g>
					<text x={bar.cx} y={hours.base + 24} text-anchor="middle" fill={INK} font-size="15">{bar.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

<section class="card-cream chart">
	<div class="sec-head">
		<h2>flagged by check</h2>
		<span class="sub">latest result of each check. a flag never rejects on its own.</span>
	</div>
	{#if flags.length === 0}
		<p>no checks yet</p>
	{:else if flags.every((row) => row.flagged === 0)}
		<p>nothing flagged. {flags.map((row) => `${row.label} checked ${row.ran}`).join(' · ')}.</p>
	{:else if flagChart}
		<div class="scroll">
			<svg class="plot" width={flagChart.width} height={flagChart.height} viewBox={`0 0 ${flagChart.width} ${flagChart.height}`} role="img" aria-label="Flagged submissions by check type.">
				{#each flagChart.left as tick (tick)}
					<line x1={flagChart.padL} x2={flagChart.width - flagChart.padR} y1={yAt(flagChart.maxBar, tick, flagChart.padT, flagChart.innerH)} y2={yAt(flagChart.maxBar, tick, flagChart.padT, flagChart.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={flagChart.padL - 8} y={yAt(flagChart.maxBar, tick, flagChart.padT, flagChart.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each flagChart.bars as bar (bar.id)}
					{@const row = flags.find((item) => item.kind === bar.id)}
					{@const title = `${bar.label}: ${bar.value} flagged`}
					<g data-bar tabindex="0" role="button" aria-label={title} class="hit"
						onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, bar.id, title, row ? `${row.ran} checked` : undefined); }}
						onpointerleave={(event) => hide(event, bar.id)}
						onfocus={(event) => show(event.currentTarget, bar.id, title, row ? `${row.ran} checked` : undefined)}
						onblur={(event) => hide(event, bar.id)}
						onkeydown={(event) => onKey(event, event.currentTarget, bar.id, title, row ? `${row.ran} checked` : undefined)}>
						<rect x={bar.x} y={bar.y} width={bar.barW} height={bar.barH} fill={tip?.id === bar.id ? RUST : INK} />
					</g>
					<text x={bar.cx} y={flagChart.base + 24} text-anchor="middle" fill={INK} font-size="15">{bar.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

<section class="card-cream chart">
	<div class="sec-head">
		<h2>reviewer throughput</h2>
		<span class="sub">reviews per person per day. eastern time.</span>
	</div>
	{#if !flow}
		<p>no reviews yet</p>
	{:else}
		<div class="legend">
			{#each flow.series as series (series.email)}
				<span><i style="background:{series.color}"></i> {series.email}</span>
			{/each}
		</div>
		<div class="scroll">
			<svg class="plot" width={flow.width} height={flow.height} viewBox={`0 0 ${flow.width} ${flow.height}`} role="img" aria-label="Reviews per reviewer per day.">
				{#each flow.left as tick (tick)}
					<line x1={flow.padL} x2={flow.width - 12} y1={yAt(flow.max, tick, flow.padT, flow.innerH)} y2={yAt(flow.max, tick, flow.padT, flow.innerH)} stroke={INK} stroke-opacity="0.35" />
					<text x={flow.padL - 8} y={yAt(flow.max, tick, flow.padT, flow.innerH) + 5} text-anchor="end" fill={INK} font-size="15">{tick}</text>
				{/each}
				{#each flow.series as series (series.email)}
					<path d={series.d} fill="none" stroke={series.color} stroke-width="3" />
					{#each series.points as point (point.id)}
						{@const title = `${series.email} · ${point.label}: ${point.count} ${point.count === 1 ? 'review' : 'reviews'}`}
						<g data-bar tabindex="0" role="button" aria-label={title} class="hit"
							onpointerenter={(event) => { if (event.pointerType === 'touch') return; show(event.currentTarget, point.id, title); }}
							onpointerleave={(event) => hide(event, point.id)}
							onfocus={(event) => show(event.currentTarget, point.id, title)}
							onblur={(event) => hide(event, point.id)}
							onkeydown={(event) => onKey(event, event.currentTarget, point.id, title)}>
							<circle cx={point.x} cy={point.y} r="6" fill={series.color} />
						</g>
					{/each}
				{/each}
				{#each flow.days as day, index (day.date)}
					<text x={flow.padL + index * flow.gap + flow.gap / 2} y={flow.base + 24} text-anchor="middle" fill={INK} font-size="15">{day.label}</text>
				{/each}
			</svg>
		</div>
	{/if}
</section>

{#if tip}
	<div class="tip" class:below={tip.below} style="left: {tip.x}px; top: {tip.y}px;">
		<p>{tip.title}</p>
		{#if tip.detail}<p>{tip.detail}</p>{/if}
	</div>
{/if}

<style>
	.chart { margin-bottom: 22px; }
	.legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 10px; font-size: 16px; }
	.legend i { display: inline-block; width: 16px; height: 16px; margin-right: 6px; vertical-align: -2px; background: #07160a; }
	.legend i.line { height: 4px; width: 22px; background: #8a2b1d; vertical-align: 3px; }
	.scroll { overflow-x: auto; }
	.plot { display: block; max-width: none; font-family: pirate, 'Noailles Pirate', serif; }
	.hit { cursor: pointer; outline: none; }
	.tip {
		position: fixed;
		z-index: 30;
		pointer-events: none;
		transform: translate(-50%, -100%);
		border: 2px solid #07160a;
		background: #f9f3d5;
		color: #07160a;
		padding: 8px 12px;
		font-size: 16px;
		line-height: 1.3;
	}
	.tip.below { transform: translate(-50%, 8px); }
	.tip p { margin: 0; }
</style>
