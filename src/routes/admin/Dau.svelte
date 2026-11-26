<script lang="ts">
	import type { DayTotal } from '#lib/coding-days.ts';

	let {
		today,
		days,
		signups,
		onboarded,
		empty,
		refreshFailed
	}: {
		today: number;
		days: DayTotal[];
		signups: number;
		onboarded: number;
		empty: boolean;
		refreshFailed: number;
	} = $props();

	let peak = $derived(Math.max(1, ...days.map((day) => day.people)));
</script>

<section class="dau" aria-label="Coding activity">
	<div class="sec-head">
		<h2>coding activity</h2>
		<span class="sub">{today} coding today</span>
	</div>
	<p class="totals">{signups} sign-ups · {onboarded} finished onboarding</p>
	{#if empty}
		<p>no coding time on a linked project in this window yet.</p>
	{/if}
	{#if refreshFailed > 0}
		<p>couldn't refresh Hackatime for {refreshFailed} linked {refreshFailed === 1 ? 'project' : 'projects'}.</p>
	{/if}
	<ol>
		{#each days as day (day.day)}
			<li>
				<span>{day.label}</span>
				<span class="bar" aria-hidden="true"><span style:width="{(day.people / peak) * 100}%"></span></span>
				<strong>{day.people}</strong>
				<span class="hours">{day.hours}h</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.dau {
		background: var(--cream);
		color: var(--ink);
		border: 2px solid var(--ink);
		padding: 16px 18px 18px;
		margin-bottom: 22px;
	}
	.sec-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		align-items: baseline;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 8px;
		margin-bottom: 10px;
	}
	h2 {
		font-family: pirate3d, serif;
		font-weight: 400;
		font-size: 32px;
		line-height: 1;
		margin: 0;
	}
	.sub, .totals, .hours { font-family: times, serif; }
	.totals { margin: 0 0 10px; }
	ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
	li { display: grid; grid-template-columns: 72px 1fr 28px 48px; gap: 8px; align-items: center; }
	.bar { height: 10px; background: #efe6c4; }
	.bar span { display: block; height: 100%; background: #07160a; }
</style>
