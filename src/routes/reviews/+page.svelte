<script lang="ts">
	import { checkLabel, clockHours, formatEt } from '#lib/admin-charts.ts';
	import AdminNav from '#lib/AdminNav.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const stages = [
		{ id: '', label: 'All stages' },
		{ id: 'first_pass', label: '1 · First pass' },
		{ id: 'fraud', label: '2 · Fraud check' },
		{ id: 'hq', label: '3 · HQ confirmation' },
		{ id: 'done', label: 'Completed' }
	];
	const statuses = [
		{ id: '', label: 'All statuses' },
		{ id: 'pending', label: 'Pending' },
		{ id: 'needs_changes', label: 'Needs changes' },
		{ id: 'confirmed', label: 'Confirmed' },
		{ id: 'rejected', label: 'Rejected' },
		{ id: 'fraud', label: 'Fraud' },
		{ id: 'needs_info', label: 'Needs info' }
	];

	function countStage(stage: string) {
		return data.facets.cells.filter((cell) => !stage || cell.stage === stage).reduce((sum, cell) => sum + cell.count, 0);
	}
	function countStatus(status: string) {
		return data.facets.cells.filter((cell) => !status || cell.status === status).reduce((sum, cell) => sum + cell.count, 0);
	}
	function link(patch: Record<string, string>) {
		const next = { ...data.query, ...patch };
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
		const text = params.toString();
		return text ? `/reviews?${text}` : '/reviews';
	}
	function stageChip(stage: string) {
		if (stage === 'fraud') return 'chip chip-stage2';
		if (stage === 'hq') return 'chip chip-stage3';
		if (stage === 'done') return 'chip chip-done';
		return 'chip chip-stage1';
	}
	function stageText(stage: string) {
		if (stage === 'first_pass') return '1 · First pass';
		if (stage === 'fraud') return '2 · Fraud check';
		if (stage === 'hq') return '3 · HQ confirmation';
		if (stage === 'done') return 'Completed';
		return stage;
	}
	function statusChip(status: string) {
		if (status === 'rejected' || status === 'fraud') return 'chip chip-rejected';
		if (status === 'needs_changes' || status === 'needs_info') return 'chip chip-needs-changes';
		if (status === 'confirmed' || status === 'clear') return 'chip chip-approved';
		return 'chip chip-pending';
	}

	const pending = $derived(countStatus('pending'));
	const challengeName = $derived(data.facets.challenges.find((challenge) => challenge.slug === data.query.challenge)?.name ?? 'all challenges');
</script>

<svelte:head>
	<title>reviews · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="review-ui">
	<div class="topbar torn-bottom">
		<div class="wrap">
			<AdminNav role={data.role} active="reviews" route="/reviews" email={data.email} handle={data.handle} />
		</div>
	</div>
	<header class="header-band">
		<picture class="bg">
			<source media="(max-width:760px)" srcset="/hackathon/lauklines-2400.jpg" />
			<img src="/hackathon/lauklines-3600.jpg" alt="northern lights over a fjord at lauklines, norway" />
		</picture>
		<div class="wrap">
			<div class="band-row">
				<div class="band-title-wrap">
					<div class="geese-mini torn" aria-hidden="true">
						<img class="g1" src="/hackathon/goose-1.png" alt="" />
						<img class="g2" src="/hackathon/goose-2.png" alt="" />
						<img class="g3" src="/hackathon/goose-3.png" alt="" />
					</div>
					<div class="strip torn">
						<span class="kicker">fjording it · /reviews</span>
						<h1>review queue</h1>
					</div>
				</div>
				<div class="band-meta torn">
					<strong>{challengeName}</strong> · <strong>{pending}</strong> pending · <strong>{data.facets.flagged}</strong> flagged
				</div>
			</div>
		</div>
	</header>
	<main class="main-area">
		<div class="wrap">
			{#if !data.configured}
				<p class="card-cream">database is not configured</p>
			{:else}
				<section class="filter-bar" aria-label="Queue filters">
					<div class="filter-row">
						<div class="tabs">
							{#each stages as stage (stage.id)}
								<a class="tab-btn" class:active={data.query.stage === stage.id} href={link({ stage: stage.id })}>
									{stage.label} <span class="cnt">{countStage(stage.id)}</span>
								</a>
							{/each}
						</div>
						<form class="controls-inline" method="GET">
							{#if data.query.stage}<input type="hidden" name="stage" value={data.query.stage} />{/if}
							{#if data.query.status}<input type="hidden" name="status" value={data.query.status} />{/if}
							{#if data.query.sort}<input type="hidden" name="sort" value={data.query.sort} />{/if}
							{#if data.query.q}<input type="hidden" name="q" value={data.query.q} />{/if}
							<label for="challenge-sel">challenge</label>
							<select id="challenge-sel" name="challenge" aria-label="Filter by challenge" onchange={(event) => event.currentTarget.form?.requestSubmit()}>
								<option value="">all challenges</option>
								{#each data.facets.challenges as challenge (challenge.slug)}
									<option value={challenge.slug} selected={data.query.challenge === challenge.slug}>{challenge.name} ({challenge.count})</option>
								{/each}
							</select>
						</form>
					</div>
					<div class="filter-row">
						<div class="tabs">
							{#each statuses as status (status.id)}
								<a class="tab-btn" class:active={data.query.status === status.id} href={link({ status: status.id })}>
									{status.label} <span class="cnt">{countStatus(status.id)}</span>
								</a>
							{/each}
						</div>
						<form class="controls-inline" method="GET">
							{#if data.query.challenge}<input type="hidden" name="challenge" value={data.query.challenge} />{/if}
							{#if data.query.stage}<input type="hidden" name="stage" value={data.query.stage} />{/if}
							{#if data.query.status}<input type="hidden" name="status" value={data.query.status} />{/if}
							<label for="sort-sel">sort</label>
							<select id="sort-sel" name="sort" aria-label="Sort submissions" onchange={(event) => event.currentTarget.form?.requestSubmit()}>
								<option value="submitted_desc" selected={data.query.sort === 'submitted_desc'}>Date (newest first)</option>
								<option value="submitted_asc" selected={data.query.sort === 'submitted_asc'}>Date (oldest first)</option>
								<option value="hours_desc" selected={data.query.sort === 'hours_desc'}>Hours (highest first)</option>
								<option value="hours_asc" selected={data.query.sort === 'hours_asc'}>Hours (lowest first)</option>
								<option value="flags_desc" selected={data.query.sort === 'flags_desc'}>Flags (most first)</option>
							</select>
							<input name="q" type="search" value={data.query.q} placeholder="Search project, email, /reviews/id…" aria-label="Search submissions" />
							<button class="btn btn-sm" type="submit">search</button>
						</form>
					</div>
				</section>

				<section class="card-cream">
					<div class="sec-head">
						<h2>submissions ({data.rows.length})</h2>
						<span class="sub">click a project to open it · flags are the latest checks</span>
					</div>
					{#if data.rows.length === 0}
						<p>{countStage('') === 0 ? 'no submissions yet' : 'nothing matches these filters'}</p>
					{:else}
						<div class="table-wrap">
							<table class="adm mobile-cards" id="q-table">
								<thead>
									<tr>
										<th>Route</th><th>Project</th><th>Author</th><th>Challenge</th><th>Submitted</th><th>Hackatime</th><th>Stage</th><th>Status</th><th>Automated check flags</th>
									</tr>
								</thead>
								<tbody>
									{#each data.rows as row (row.id)}
										<tr>
											<td data-label="Route" class="mono nowrap"><a href="/reviews/{row.id}">/reviews/{row.id}</a></td>
											<td data-label="Project"><a class="proj-link" href="/reviews/{row.id}">{row.projectName}</a></td>
											<td data-label="Author">{row.email}</td>
											<td data-label="Challenge">{row.challengeName}</td>
											<td data-label="Submitted" class="mono nowrap">{formatEt(row.createdAt)}</td>
											<td data-label="Hackatime" class="mono nowrap"><strong>{clockHours(row.hackatimeSeconds)}</strong></td>
											<td data-label="Stage"><span class={stageChip(row.stage)}>{stageText(row.stage)}</span></td>
											<td data-label="Status"><span class={statusChip(row.status)}>{row.status.replaceAll('_', ' ')}</span></td>
											<td data-label="Flags">
												<div class="flag-list">
													{#if row.flags.length === 0}
														<span class="chip chip-ok">no flags</span>
													{:else}
														{#each row.flags as flag (flag)}
															<span class="chip chip-flag">{checkLabel(flag)}</span>
														{/each}
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</section>
			{/if}
		</div>
	</main>
</div>
