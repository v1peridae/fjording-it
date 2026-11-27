<script lang="ts">
	import { REWARD_COPY, type RewardChoice } from '#lib/reward.ts';

	let { choice, disabled = false, nudge = false }: { choice: RewardChoice | null; disabled?: boolean; nudge?: boolean } = $props();
	let local = $state<RewardChoice | null | undefined>(undefined);
	let picked = $derived(local === undefined ? choice : local);
</script>

<div class="reward">
	<p class="lab" id="reward-l">{REWARD_COPY.ask}</p>
	<div class="pick" role="radiogroup" aria-labelledby="reward-l">
		<label class="opt" class:sel={picked === 'cap'}>
			<input type="radio" name="reward" value="cap" checked={picked === 'cap'} {disabled} onchange={() => (local = 'cap')} />
			<span><b>{REWARD_COPY.cap}</b> <i>{REWARD_COPY.capFine}</i></span>
		</label>
		<label class="opt" class:sel={picked === 'prize'}>
			<input type="radio" name="reward" value="prize" checked={picked === 'prize'} {disabled} onchange={() => (local = 'prize')} />
			<span><b>{REWARD_COPY.prize}</b> <i>{REWARD_COPY.prizeFine}</i></span>
		</label>
	</div>
	<p class="note" class:nudge={nudge && !picked}>
		{picked === 'prize' ? REWARD_COPY.pickedPrize : picked === 'cap' ? REWARD_COPY.pickedCap : REWARD_COPY.none}. {REWARD_COPY.when}.
	</p>
</div>

<style>
	.reward .lab {
		margin: 0 0 8px;
		font-family: var(--display);
		font-size: 22px;
		line-height: 1.15;
	}

	.reward .opt {
		padding: 10px 14px;
	}

	.reward .opt + .opt {
		border-top: 1.5px solid var(--ink);
	}

	.reward .opt b {
		font-family: var(--display);
		font-weight: normal;
		display: block;
	}

	.reward .opt i {
		font-family: var(--times);
		font-size: 18px;
	}

	.reward .note {
		margin: 8px 0 0;
		font-family: var(--times);
		font-size: 18px;
	}

	.reward .note.nudge {
		font-weight: bold;
	}
</style>
