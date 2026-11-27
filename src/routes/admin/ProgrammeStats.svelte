<script lang="ts">
	import { formatEt, waitAge } from '#lib/admin-charts.ts';
	import type { DaySeries, ProgrammeStats, Turnaround } from '#lib/programme-stats.ts';

	let { stats }: { stats: ProgrammeStats } = $props();

	const c = $derived(stats.clock.countdown);
	const s = $derived(stats.submissions);
	const h = $derived(stats.hours);
	const countryPeak = $derived(Math.max(1, stats.countries.unknown.accounts, ...stats.countries.rows.map((row) => row.accounts)));
	const hoursPeak = $derived(Math.max(1, ...h.buckets.map((b) => b.count)));

	function pct(value: number | null): string {
		return value == null ? '—' : `${value}%`;
	}

	function share(part: number, whole: number): string {
		if (whole <= 0) return '—';
		return `${Math.round((part / whole) * 1000) / 10}%`;
	}

	function duration(hours: number | null): string {
		if (hours == null || !Number.isFinite(hours)) return '—';
		if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
		if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
		const days = Math.floor(hours / 24);
		return `${days}d ${Math.round(hours - days * 24)}h`;
	}

	function turnaround(t: Turnaround): string {
		return t.n === 0 ? 'no reviews yet' : `median ${duration(t.median)} · average ${duration(t.average)}`;
	}

	function peak(series: DaySeries): number {
		return Math.max(1, ...series.map((day) => day.count));
	}
</script>

<section class="kpi-grid" aria-label="Programme at a glance">
	<div class="kpi dark">
		<span class="k-lbl">the northern challenge · {c.label}</span>
		{#if c.phase === 'done'}
			<span class="k-val">ended</span>
		{:else}
			<span class="k-val">{Number(c.days)}d {Number(c.hours)}h {Number(c.minutes)}m</span>
		{/if}
		<span class="k-sub">
			{#if stats.clock.day}day {stats.clock.day} of {stats.clock.totalDays} ·{/if}
			ends {formatEt(stats.clock.endsAt)}
		</span>
	</div>
	<div class="kpi kiwi">
		<span class="k-lbl">joined the challenge</span>
		<span class="k-val">{stats.joined} <small>/ {stats.accounts}</small></span>
		<span class="k-sub">{pct(stats.joinRate)} of challenge accounts joined</span>
	</div>
	<div class="kpi">
		<span class="k-lbl">hit 5h in the window</span>
		<span class="k-val">{h.hitFive}</span>
		<span class="k-sub">{h.closeToFive} close (3h to under 5h) · {h.fiveNotSubmitted} at 5h+ not submitted yet</span>
	</div>
	<div class="kpi">
		<span class="k-lbl">review backlog</span>
		<span class="k-val">{s.backlog.count}</span>
		<span class="k-sub">
			{#if s.backlog.oldestAt}oldest waiting {waitAge(s.backlog.oldestAt)} · median age {duration(s.backlog.medianAgeHours)}{:else}nothing waiting on reviewers{/if}
		</span>
	</div>
</section>

<section class="card-cream block" aria-label="Signed up versus joined">
	<div class="sec-head">
		<h2>signed up vs joined</h2>
		<span class="sub">
			challenge accounts (signed in with Hack Club Auth)
			{#if stats.testersExcluded > 0}· {stats.testersExcluded} tester {stats.testersExcluded === 1 ? 'account' : 'accounts'} left out{/if}
		</span>
	</div>
	<div class="table-wrap">
		<table class="adm mobile-cards">
			<thead><tr><th>Step</th><th>People</th><th>Of accounts</th><th>Of joined</th></tr></thead>
			<tbody>
				<tr><td data-label="Step">challenge accounts</td><td data-label="People" class="mono">{stats.accounts}</td><td data-label="Of accounts" class="mono">{stats.accounts ? '100%' : '—'}</td><td data-label="Of joined" class="mono">—</td></tr>
				<tr><td data-label="Step">joined the challenge</td><td data-label="People" class="mono">{stats.joined}</td><td data-label="Of accounts" class="mono">{share(stats.joined, stats.accounts)}</td><td data-label="Of joined" class="mono">{stats.joined ? '100%' : '—'}</td></tr>
				<tr><td data-label="Step">joined + connected hackatime</td><td data-label="People" class="mono">{stats.connectedJoiners}</td><td data-label="Of accounts" class="mono">{share(stats.connectedJoiners, stats.accounts)}</td><td data-label="Of joined" class="mono">{share(stats.connectedJoiners, stats.joined)}</td></tr>
				<tr><td data-label="Step">joined + submitted</td><td data-label="People" class="mono">{stats.submittedJoiners}</td><td data-label="Of accounts" class="mono">{share(stats.submittedJoiners, stats.accounts)}</td><td data-label="Of joined" class="mono">{share(stats.submittedJoiners, stats.joined)}</td></tr>
			</tbody>
		</table>
	</div>
</section>

<section class="card-cream block" aria-label="Country split">
	<div class="sec-head">
		<h2>where people are</h2>
		<span class="sub">country from the address on their Hack Club Auth account · {stats.countries.known} known · {stats.countries.unknown.accounts} unknown</span>
	</div>
	{#if stats.accounts === 0}
		<p>no challenge accounts yet</p>
	{:else}
		{#if stats.countries.known === 0}
			<p>no country data yet. Hack Club Auth hasn't shared an address country for anyone so far.</p>
		{/if}
		<div class="table-wrap">
			<table class="adm mobile-cards">
				<thead><tr><th>Country</th><th>Accounts</th><th>Share</th><th>Joined</th><th></th></tr></thead>
				<tbody>
					{#each stats.countries.rows as row (row.key)}
						<tr>
							<td data-label="Country">{row.label}</td>
							<td data-label="Accounts" class="mono">{row.accounts}</td>
							<td data-label="Share" class="mono">{share(row.accounts, stats.accounts)}</td>
							<td data-label="Joined" class="mono">{row.joined}</td>
							<td class="barcell" aria-hidden="true"><span class="bar"><span style:width="{(row.accounts / countryPeak) * 100}%"></span></span></td>
						</tr>
					{/each}
					<tr class="unknown">
						<td data-label="Country">Unknown (no address country)</td>
						<td data-label="Accounts" class="mono">{stats.countries.unknown.accounts}</td>
						<td data-label="Share" class="mono">{share(stats.countries.unknown.accounts, stats.accounts)}</td>
						<td data-label="Joined" class="mono">{stats.countries.unknown.joined}</td>
						<td class="barcell" aria-hidden="true"><span class="bar"><span style:width="{(stats.countries.unknown.accounts / countryPeak) * 100}%"></span></span></td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</section>

<section class="two-col">
	{#each [{ title: 'challenge accounts per day', sub: 'first Hack Club Auth sign-in. eastern time.', series: stats.signupsByDay, empty: 'no challenge accounts yet' }, { title: 'challenge joins per day', sub: stats.joinsUndated ? `dated by when the starter project was saved. ${stats.joinsUndated} joined with no project yet, so no date.` : 'dated by when the starter project was saved. eastern time.', series: stats.joinsByDay, empty: stats.joinsUndated ? `no dated joins yet (${stats.joinsUndated} joined without a project)` : 'no joins yet' }] as chart (chart.title)}
		<div class="card-cream">
			<div class="sec-head">
				<h2>{chart.title}</h2>
				<span class="sub">{chart.sub}</span>
			</div>
			{#if chart.series.length === 0}
				<p>{chart.empty}</p>
			{:else}
				{@const top = peak(chart.series)}
				<ol class="days">
					{#each chart.series as day (day.date)}
						<li>
							<span>{day.label}</span>
							<span class="bar" aria-hidden="true"><span style:width="{(day.count / top) * 100}%"></span></span>
							<strong>{day.count}</strong>
							<span class="total">{day.cumulative} total</span>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/each}
</section>

<section class="two-col">
	<div class="card-cream">
		<div class="sec-head">
			<h2>hours so far</h2>
			<span class="sub">people who joined · cached Hackatime time on their linked project, challenge window</span>
		</div>
		{#if stats.joined === 0}
			<p>no one has joined yet</p>
		{:else}
			<ol class="days buckets">
				{#each h.buckets as bucket (bucket.key)}
					<li>
						<span>{bucket.label}</span>
						<span class="bar" aria-hidden="true"><span style:width="{(bucket.count / hoursPeak) * 100}%"></span></span>
						<strong>{bucket.count}</strong>
						<span class="total">{share(bucket.count, stats.joined)}</span>
					</li>
				{/each}
			</ol>
			<p class="note">"no hackatime data yet" means no linked project or no fetch so far. It is not counted as 0h.</p>
		{/if}
	</div>
	<div class="card-paper">
		<div class="sec-head">
			<h2>who to nudge</h2>
			<span class="sub">counts only, from the same data</span>
		</div>
		<div class="kv-grid">
			<div class="kv"><span class="k">at 5h+ but not submitted</span><span class="v big">{h.fiveNotSubmitted}</span></div>
			<div class="kv"><span class="k">close to 5h (3h to under 5h)</span><span class="v big">{h.closeToFive}</span></div>
			<div class="kv"><span class="k">joined, linked a project, 0h so far</span><span class="v big">{h.stalled}</span></div>
			<div class="kv"><span class="k">joined, no starter project yet</span><span class="v big">{h.noProject}</span></div>
			<div class="kv"><span class="k">joined, hackatime not connected</span><span class="v big">{stats.joined - stats.connectedJoiners}</span></div>
		</div>
	</div>
</section>

<section class="card-cream block" aria-label="Submissions and review">
	<div class="sec-head">
		<h2>submissions &amp; review time</h2>
		<span class="sub">the northern challenge · test submissions left out · {s.total} total</span>
	</div>
	{#if s.total === 0}
		<p>no submissions yet</p>
	{:else}
		<div class="flag-list counts">
			<span class="chip chip-pending">{s.inReview} pending review</span>
			<span class="chip chip-needs-changes">{s.waiting} waiting on participant</span>
			<span class="chip chip-approved">{s.approved} approved (HQ confirmed)</span>
			<span class="chip chip-rejected">{s.rejected} rejected (incl. fraud)</span>
		</div>
		<div class="kv-grid">
			<div class="kv"><span class="k">submitted → first review ({s.firstReview.n})</span><span class="v">{turnaround(s.firstReview)}</span></div>
			<div class="kv"><span class="k">submitted → final decision ({s.decision.n})</span><span class="v">{turnaround(s.decision)}</span></div>
			<div class="kv"><span class="k">backlog by age since submitted</span><span class="v">{s.backlog.under1d} under 1 day · {s.backlog.d1to3} 1–3 days · {s.backlog.over3d} over 3 days</span></div>
			<div class="kv"><span class="k">oldest pending</span><span class="v">{s.backlog.oldestAt ? `${waitAge(s.backlog.oldestAt)} · ${formatEt(s.backlog.oldestAt)}` : 'none'}</span></div>
		</div>
	{/if}
</section>

<style>
	.block {
		margin-bottom: 22px;
	}
	small {
		font-size: 24px;
	}
	.days {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
		max-height: 420px;
		overflow-y: auto;
	}
	.days li {
		display: grid;
		grid-template-columns: 72px 1fr 36px 72px;
		gap: 8px;
		align-items: center;
	}
	.buckets li {
		grid-template-columns: 170px 1fr 36px 56px;
	}
	.bar {
		display: block;
		height: 10px;
		background: #efe6c4;
		min-width: 60px;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--ink);
	}
	.barcell {
		width: 30%;
		vertical-align: middle;
	}
	.unknown td {
		font-style: italic;
	}
	.total,
	.note {
		font-family: times, serif;
		font-size: 15px;
	}
	.note {
		margin: 10px 0 0;
	}
	.counts {
		margin-bottom: 14px;
	}
	.big {
		font-family: pirate3d, serif;
		font-size: 32px;
		line-height: 1;
	}
	@media (max-width: 760px) {
		.days li,
		.buckets li {
			grid-template-columns: 64px 1fr 32px 56px;
		}
		.barcell {
			display: none !important;
		}
	}
</style>
