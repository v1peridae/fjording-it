<script lang="ts">
	import type { FunnelStage } from '#lib/funnel.ts';

	let { stages, approvedHours }: { stages: FunnelStage[]; approvedHours: number } = $props();

	function pct(value: number | null): string {
		if (value == null) return '—';
		return Number.isInteger(value) ? `${value}%` : `${value}%`;
	}
</script>

<section class="funnel" aria-label="Participant funnel">
	<div class="sec-head">
		<h2>participant funnel</h2>
		<span class="sub">{approvedHours}h approved</span>
	</div>
	<ol>
		{#each stages as stage, index (stage.key)}
			<li>
				<span class="step">{index + 1}</span>
				<span class="name">{stage.label}</span>
				<strong>{stage.count}</strong>
				<span class="bar" aria-hidden="true"><span style:width="{stage.ofSignups ?? 0}%"></span></span>
				<span class="meta">{pct(stage.ofPrevious)} of previous</span>
				<span class="meta">{pct(stage.ofSignups)} of sign-ups</span>
			</li>
		{/each}
	</ol>
</section>

<style>
	.funnel {
		background: var(--cream);
		color: var(--ink);
		border: 2px solid var(--ink);
		padding: 16px 18px 18px;
		margin-bottom: 22px;
	}
	.sec-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 14px;
		flex-wrap: wrap;
		margin: 0 0 14px;
		border-bottom: 2px solid var(--ink);
		padding-bottom: 8px;
	}
	h2 {
		font-family: pirate3d, serif;
		font-weight: 400;
		font-size: 32px;
		line-height: 1;
		margin: 0;
	}
	.sub {
		font-family: times, serif;
		font-size: 18px;
	}
	ol {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 12px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.step {
		font-family: times, serif;
		font-size: 14px;
	}
	.name {
		font-size: 17px;
		line-height: 1.15;
	}
	strong {
		font-family: pirate3d, serif;
		font-weight: 400;
		font-size: 36px;
		line-height: 1;
	}
	.bar {
		height: 10px;
		background: var(--ink);
		margin: 4px 0;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--kiwi);
		max-width: 100%;
	}
	.meta {
		font-family: times, serif;
		font-size: 14px;
	}
	@media (max-width: 760px) {
		ol {
			grid-template-columns: 1fr 1fr;
		}
		h2 {
			font-size: 26px;
		}
		strong {
			font-size: 28px;
		}
	}
</style>
