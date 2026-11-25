<script lang="ts">
	import { ago, formatEt } from '#lib/admin-charts.ts';
	import AdminNav from '#lib/AdminNav.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let confirming = $state<string | null>(null);

	const stages = [
		{ id: 'first_pass', label: 'First pass' },
		{ id: 'fraud', label: 'Fraud check' },
		{ id: 'hq', label: 'HQ confirmation' }
	];

	function totalFor(email: string) {
		return data.stats.find((row) => row.email === email)?.total ?? 0;
	}
	function lastFor(email: string) {
		const at = data.stats.find((row) => row.email === email)?.lastActive;
		return at ? ago(at) : '—';
	}
</script>

<svelte:head>
	<title>reviewers · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="review-ui">
	<div class="topbar torn-bottom">
		<div class="wrap">
			{#if data.view === 'ready' || data.view === 'unconfigured'}
				<AdminNav active="reviewers" route="/admin/reviewers" email={data.email} handle={data.handle} />
			{/if}
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
						<span class="kicker">fjording it · /admin/reviewers</span>
						<h1>reviewers &amp; stage access</h1>
					</div>
				</div>
				<div class="band-meta torn">
					{#if data.view === 'ready'}
						<strong>{data.reviewers.length}</strong> active reviewers · hack club emails
					{:else}
						database is not configured
					{/if}
				</div>
			</div>
		</div>
	</header>
	<main class="main-area">
		<div class="wrap">
			{#if data.view !== 'ready'}
				<p class="card-cream">database is not configured</p>
			{:else}
				<section class="two-col reviewers-layout">
					<form class="paper review-panel" method="POST" action="?/save">
						<div class="sec-head">
							<h2>add reviewer</h2>
							<span class="sub">invite by email</span>
						</div>
						<div class="field">
							<label for="rev-email">Reviewer email <span class="hint-tag">hack club</span></label>
							<input id="rev-email" name="email" type="email" required placeholder="name@hackclub.com" />
						</div>
						<div class="field">
							<p style="margin:0 0 5px">Allowed review stages</p>
							<div class="flag-list" style="margin-top:6px">
								<label class="check-box"><input type="checkbox" name="first_pass" checked /> First pass</label>
								<label class="check-box"><input type="checkbox" name="fraud" /> Fraud check</label>
								<label class="check-box"><input type="checkbox" name="hq" /> HQ confirmation</label>
							</div>
						</div>
						{#if form?.error}<p>{form.error}</p>{/if}
						<div class="form-actions"><button class="stampbtn stamp" type="submit">add reviewer</button></div>
					</form>

					<div class="card-cream">
						<div class="sec-head">
							<h2>active reviewers ({data.reviewers.length})</h2>
							<span class="sub">toggle stages per reviewer · <a href="/admin#reviewer-stats">view reviewer stats →</a></span>
						</div>
						{#if data.reviewers.length === 0}
							<p>no reviewers yet</p>
						{:else}
							<div class="table-wrap">
								<table class="adm mobile-cards">
									<thead>
										<tr><th>Reviewer</th><th>Stages they can review</th><th>Total</th><th>Last active</th><th>Action</th></tr>
									</thead>
									<tbody>
										{#each data.reviewers as reviewer (reviewer.email)}
											<tr>
												<td data-label="Reviewer"><span class="mono">{reviewer.email}</span></td>
												<td data-label="Stages">
													<form class="flag-list" method="POST" action="?/save">
														<input type="hidden" name="email" value={reviewer.email} />
														{#each stages as stage (stage.id)}
															<label class="check-box">
																<input
																	type="checkbox"
																	name={stage.id}
																	checked={reviewer.stages.includes(stage.id)}
																	onchange={(event) => event.currentTarget.form?.requestSubmit()}
																/>
																{stage.label}
															</label>
														{/each}
													</form>
												</td>
												<td data-label="Total" class="mono">{totalFor(reviewer.email)} reviews</td>
												<td data-label="Last active">{lastFor(reviewer.email)}</td>
												<td data-label="Action">
													{#if confirming === reviewer.email}
														<form class="confirm-strip" method="POST" action="?/remove">
															<input type="hidden" name="email" value={reviewer.email} />
															<span>confirm remove {reviewer.email}?</span>
															<button class="btn btn-sm" type="submit">Yes, remove</button>
															<button class="btn btn-ink btn-sm" type="button" onclick={() => (confirming = null)}>Cancel</button>
														</form>
													{:else}
														<button class="btn btn-red btn-sm" type="button" onclick={() => (confirming = reviewer.email)}>Remove</button>
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				</section>

				<section class="card-cream" style="margin-top:22px">
					<div class="sec-head">
						<h2>audit</h2>
						<span class="sub">who added or removed a reviewer</span>
					</div>
					{#if data.audit.length === 0}
						<p>no reviewer changes yet</p>
					{:else}
						<ol class="timeline">
							{#each data.audit as row, index (`${row.createdAt}-${index}`)}
								<li>
									<div class="tl-top">
										<span class="tl-stage">{row.action}</span>
										<span class="tl-meta">{formatEt(row.createdAt)} · {row.actorEmail}</span>
									</div>
									<p class="tl-note">{row.reviewerEmail} · {row.stages.join(', ') || 'no stages'}</p>
								</li>
							{/each}
						</ol>
					{/if}
				</section>
			{/if}
		</div>
	</main>
</div>
