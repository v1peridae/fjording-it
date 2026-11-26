<script lang="ts">
	import { ago, checkLabel, waitAge } from '#lib/admin-charts.ts';
	import AdminNav from '#lib/AdminNav.svelte';
	import Dau from './Dau.svelte';
	import Funnel from './Funnel.svelte';
	import HomeCharts from './HomeCharts.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const stageChip: Record<string, string> = {
		first_pass: 'chip chip-stage1',
		fraud: 'chip chip-stage2',
		hq: 'chip chip-stage3',
		done: 'chip chip-done'
	};
	const stageName: Record<string, string> = {
		first_pass: '1 · First pass',
		fraud: '2 · Fraud check',
		hq: '3 · HQ confirmation',
		done: 'Completed'
	};
</script>

<svelte:head>
	<title>admin home · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="review-ui">
	<div class="topbar torn-bottom">
		<div class="wrap">
			{#if data.view === 'signin'}
				<AdminNav route="/admin" />
			{:else}
				<AdminNav active="stats" route="/admin" email={data.email} handle={data.handle} />
			{/if}
		</div>
	</div>

	{#if data.view === 'signin'}
		<header class="header-band">
			<picture class="bg">
				<source media="(max-width:760px)" srcset="/hackathon/lauklines-2400.jpg" />
				<img src="/hackathon/lauklines-3600.jpg" alt="northern lights over a fjord at lauklines, norway" />
			</picture>
			<div class="wrap">
				<div class="band-row">
					<div class="band-title-wrap">
						<div class="strip torn">
							<span class="kicker">fjording it · /admin</span>
							<h1>admin</h1>
						</div>
					</div>
				</div>
			</div>
		</header>
		<main class="main-area">
			<div class="wrap">
				<form class="paper review-panel" method="POST" action="?/signin">
					<div class="sec-head">
						<h2>sign in</h2>
						<span class="sub">hack club auth</span>
					</div>
					{#if data.next}<input type="hidden" name="next" value={data.next} />{/if}
					<div class="field">
						<label for="email">your email</label>
						<input id="email" type="email" name="email" placeholder="you@hackclub.com" value={form?.email ?? ''} required />
					</div>
					<button class="stampbtn stamp" type="submit">sign in</button>
					{#if form?.error || data.error}<p>{form?.error ?? data.error}</p>{/if}
				</form>
			</div>
		</main>
	{:else}
		{@const home = data.db}
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
							<span class="kicker">fjording it · /admin</span>
							<h1>admin home &amp; stats</h1>
						</div>
					</div>
					<div class="band-meta torn">
						{#if home}
							<strong>{home.submissions}</strong> ships · <strong>{home.flagged}</strong> flagged ·
							<strong>{home.oldest ? waitAge(home.oldest.createdAt) : 'none'}</strong> waiting
						{:else}
							<strong>{data.dbError ?? 'database is not configured'}</strong>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<main class="main-area">
			<div class="wrap">
				<section class="kpi-grid" aria-label="At-a-glance metrics">
					<div class="kpi">
						<span class="k-lbl">waitlist emails</span>
						{#if 'error' in data.signups}
							<span class="k-val">—</span>
							<span class="k-sub">{data.signups.error}</span>
						{:else}
							<span class="k-val">{data.signups.count}</span>
							<span class="k-sub">+{data.signups.today} in last 24h · email waitlist</span>
						{/if}
					</div>
					<div class="kpi kiwi">
						<span class="k-lbl">submissions · the northern challenge</span>
						<span class="k-val">{home ? home.northern : '—'}</span>
						<span class="k-sub"><a href="/reviews?challenge=northern">open /reviews queue →</a></span>
					</div>
					<div class="kpi dark">
						<span class="k-lbl">approved hours</span>
						<span class="k-val">{home ? `${home.approvedHours}h` : '—'}</span>
						<span class="k-sub">{home ? `across ${home.eligibleShips} confirmed ships at 5h+` : (data.dbError ?? 'database is not configured')}</span>
					</div>
					<div class="kpi">
						<span class="k-lbl">flagged submissions</span>
						<span class="k-val">{home ? home.flagged : '—'}</span>
						<span class="k-sub">{home ? (home.flagged ? 'latest check flagged' : 'none flagged') : ''}</span>
					</div>
				</section>

				{#if data.dau}
					<Dau
						today={data.dau.today}
						days={data.dau.days}
						signups={data.dau.signups}
						onboarded={data.dau.onboarded}
						empty={data.dau.empty}
						refreshFailed={data.dau.refreshFailed}
					/>
				{/if}
				{#if data.funnel}
					<Funnel stages={data.funnel.stages} approvedHours={data.funnel.approvedHours} />
				{:else}
					<section class="card-cream" style="margin-bottom:22px">
						<div class="sec-head"><h2>participant funnel</h2></div>
						<p>{data.dbError ?? 'database is not configured'}</p>
					</section>
				{/if}

				{#if home}
					<HomeCharts
						signups={'error' in data.signups ? data.signups : { days: data.signups.days }}
						submissions={home.charts.submissions}
						challengeNames={home.charts.challenges}
						pipeline={home.charts.pipeline}
						approved={home.charts.approved}
						flags={home.charts.flags}
						throughput={home.charts.throughput}
					/>
				{:else}
					<HomeCharts
						signups={'error' in data.signups ? data.signups : { days: data.signups.days }}
						submissions={[]}
						challengeNames={[]}
						pipeline={[]}
						approved={[]}
						flags={[]}
						throughput={{ reviewers: [], days: [] }}
					/>
					<p class="card-cream">{data.dbError ?? 'database is not configured'}</p>
				{/if}

				{#if home}
					<section class="card-ink" style="margin-bottom:22px">
						<div class="sec-head">
							<h2>review pipeline by stage</h2>
							<span class="sub">3 stages in order: first pass → fraud check → HQ confirmation</span>
						</div>
						<div class="stage-cards" style="margin-bottom:0">
							<a class="stage-card" href="/reviews?stage=first_pass">
								<span class="st-num">STAGE 1</span>
								<span class="st-name">First pass</span>
								<span class="st-count">{home.stages.first_pass.total}</span>
								<span class="st-meta">{home.stages.first_pass.pending} pending · {home.stages.first_pass.needsChanges} needs changes</span>
							</a>
							<a class="stage-card" href="/reviews?stage=fraud">
								<span class="st-num">STAGE 2</span>
								<span class="st-name">Fraud check</span>
								<span class="st-count">{home.stages.fraud.total}</span>
								<span class="st-meta">{home.stages.fraud.pending} pending · {home.stages.fraud.fraud} fraud</span>
							</a>
							<a class="stage-card" href="/reviews?stage=hq">
								<span class="st-num">STAGE 3</span>
								<span class="st-name">HQ confirmation</span>
								<span class="st-count">{home.stages.hq.total}</span>
								<span class="st-meta">{home.stages.hq.pending ? `${home.stages.hq.pending} awaiting HQ sign-off` : 'none waiting'}</span>
							</a>
							<a class="stage-card" href="/reviews?stage=done">
								<span class="st-num">DONE</span>
								<span class="st-name">Completed</span>
								<span class="st-count">{home.stages.done.total}</span>
								<span class="st-meta">{home.stages.done.confirmed} confirmed · {home.stages.done.synced} synced</span>
							</a>
						</div>
					</section>

					<section class="two-col">
						<div class="card-cream">
							<div class="sec-head">
								<h2>submissions by challenge</h2>
								<span class="sub">{home.perChallenge.length ? 'live queue' : 'no challenges yet'}</span>
							</div>
							{#if home.perChallenge.every((row) => row.total === 0)}
								<p>no submissions yet</p>
							{:else}
								<div class="table-wrap">
									<table class="adm mobile-cards">
										<thead>
											<tr><th>Challenge</th><th>Total</th><th>Pending</th><th>Needs chg</th><th>Approved</th><th>Rejected</th></tr>
										</thead>
										<tbody>
											{#each home.perChallenge as row (row.slug)}
												<tr>
													<td data-label="Challenge"><a class="proj-link" href="/reviews?challenge={row.slug}">{row.name}</a></td>
													<td data-label="Total" class="mono">{row.total}</td>
													<td data-label="Pending" class="mono">{row.pending}</td>
													<td data-label="Needs chg" class="mono">{row.needsChanges}</td>
													<td data-label="Approved" class="mono">{row.approved}</td>
													<td data-label="Rejected" class="mono">{row.rejected}</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
						<div class="card-paper">
							<div class="sec-head">
								<h2>oldest waiting submission</h2>
								<span class="sub">still in review</span>
							</div>
							{#if !home.oldest}
								<p>none waiting</p>
							{:else}
								<div class="kv-grid">
									<div class="kv"><span class="k">age waiting</span><span class="v" style="font-family:pirate3d,serif;font-size:32px">{waitAge(home.oldest.createdAt)}</span></div>
									<div class="kv"><span class="k">submission route</span><span class="v mono">/reviews/{home.oldest.id}</span></div>
									<div class="kv"><span class="k">project &amp; author</span><span class="v"><strong>{home.oldest.projectName}</strong> · {home.oldest.email}</span></div>
									<div class="kv">
										<span class="k">stage &amp; flag</span>
										<span class="v">
											<span class={stageChip[home.oldest.stage] ?? 'chip'}>{stageName[home.oldest.stage] ?? home.oldest.stage}</span>
											{#if home.oldest.flags.length === 0}
												<span class="chip chip-ok">no flags</span>
											{:else}
												{#each home.oldest.flags as flag (flag)}
													<span class="chip chip-flag">{checkLabel(flag)}</span>
												{/each}
											{/if}
										</span>
									</div>
								</div>
								<a class="btn btn-ink" href="/reviews/{home.oldest.id}">open /reviews/{home.oldest.id} →</a>
							{/if}
						</div>
					</section>

					<section class="card-cream" id="reviewer-stats">
						<div class="sec-head">
							<h2>reviewer stats</h2>
							<span class="sub"><a href="/admin/reviewers">manage reviewers →</a></span>
						</div>
						<form class="controls-inline" method="GET" style="margin-bottom:12px">
							<label>from <input type="date" name="from" value={data.from} /></label>
							<label>to <input type="date" name="to" value={data.to} /></label>
							<button class="btn btn-sm" type="submit">filter</button>
						</form>
						{#if data.people.length === 0}
							<p>no reviewers yet</p>
						{:else}
							<div class="table-wrap">
								<table class="adm mobile-cards">
									<thead>
										<tr>
											<th>Reviewer</th><th>Stages allowed</th><th>First pass</th><th>Fraud check</th><th>HQ conf.</th>
											<th>Approve / Reject / Changes</th><th>Median turnaround</th><th>Last active</th>
										</tr>
									</thead>
									<tbody>
										{#each data.people as person (person.email)}
											<tr>
												<td data-label="Reviewer"><span class="mono">{person.email}</span>{#if person.owner} · owner{/if}</td>
												<td data-label="Stages">
													<div class="flag-list">
														{#if person.owner && person.stages.length === 0}<span class="chip chip-done">all stages</span>{/if}
														{#each person.stages as stage (stage)}
															<span class={stage === 'fraud' ? 'chip chip-stage2' : stage === 'hq' ? 'chip chip-stage3' : 'chip chip-stage1'}>
																{stageName[stage] ?? stage}
															</span>
														{/each}
														{#if !person.owner && person.stages.length === 0}<span class="mono">no stages</span>{/if}
													</div>
												</td>
												<td data-label="First pass" class="mono">{person.firstPass}</td>
												<td data-label="Fraud check" class="mono">{person.fraud}</td>
												<td data-label="HQ conf." class="mono">{person.hq}</td>
												<td data-label="Split">
													<div class="flag-list">
														<span class="chip chip-approved">{person.approved} app</span>
														<span class="chip chip-rejected">{person.rejected} rej</span>
														<span class="chip chip-needs-changes">{person.needsChanges} chg</span>
													</div>
												</td>
												<td data-label="Median turnaround" class="mono">{person.median || '—'}</td>
												<td data-label="Last active">{person.lastActive ? ago(person.lastActive) : '—'}</td>
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
	{/if}
</div>
