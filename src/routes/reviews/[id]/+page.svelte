<script lang="ts">
	import { checkLabel, clockHours, formatEt } from '#lib/admin-charts.ts';
	import AdminNav from '#lib/AdminNav.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const submission = $derived(data.submission);
	const stage = $derived(submission.stage);
	const order = ['first_pass', 'fraud', 'hq'] as const;
	const index = $derived(stage === 'done' ? 3 : order.indexOf(stage as (typeof order)[number]));
	const first = $derived([...data.reviews].reverse().find((review) => review.stage === 'first_pass'));
	const fraud = $derived([...data.reviews].reverse().find((review) => review.stage === 'fraud'));
	const hours = $derived(data.approved);
	const five = $derived(hours >= 5);

	function stepClass(step: number) {
		if (index > step) return 'sp-step done';
		if (index === step) return 'sp-step active';
		return 'sp-step';
	}
	function checkChip(flag: string) {
		if (flag === 'flag') return 'chip chip-flag';
		if (flag === 'unavailable') return 'chip chip-needs-changes';
		return 'chip chip-approved';
	}
	function checkWord(flag: string) {
		if (flag === 'flag') return 'Flagged';
		if (flag === 'unavailable') return "couldn't check";
		return 'Clear';
	}
	function decisionLabel(decision: string) {
		const labels: Record<string, string> = {
			approved: 'Approved',
			rejected: 'Rejected',
			needs_changes: 'Needs changes',
			clear: 'Marked clear',
			fraud: 'Flagged as fraud',
			needs_info: 'Needs info',
			confirmed: 'Confirmed',
			sent_back: 'Sent back'
		};
		return labels[decision] ?? decision;
	}
</script>

<svelte:head>
	<title>{submission.projectName} · review</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="review-ui">
	<div class="topbar torn-bottom">
		<div class="wrap">
			<AdminNav role={data.role} active="reviews" route="/reviews/{submission.id}" email={data.email} handle={data.handle} />
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
						<span class="kicker">fjording it · /reviews/{submission.id}</span>
						<h1>{submission.projectName} · submission review</h1>
					</div>
				</div>
				<div class="band-meta torn">
					<strong>{stage === 'first_pass' ? 'Stage 1 · First pass' : stage === 'fraud' ? 'Stage 2 · Fraud check' : stage === 'hq' ? 'Stage 3 · HQ confirmation' : 'Completed'}</strong>
					· <strong>{clockHours(submission.hackatimeSeconds)}</strong> tracked · <strong>{data.checks.filter((check) => check.flag === 'flag').length}</strong> flags
				</div>
			</div>
		</div>
	</header>

	<main class="main-area">
		<div class="wrap">
			<div class="crumbs">
				<div class="left">
					<a class="back-btn" href="/reviews">← back to /reviews</a>
					<span class="route-pill">/reviews/{submission.id}</span>
					<span class="chip chip-stage1">{submission.challengeName}</span>
					<span class="chip chip-pending">{submission.status.replaceAll('_', ' ')}</span>
				</div>
			</div>

			<nav class="stage-progress" aria-label="Review stages">
				<div class={stepClass(0)}><div><span class="sp-k">STAGE 1</span><span class="sp-t">First pass</span></div><span class="sp-badge">{index > 0 ? '✓ done' : index === 0 ? '▶ active' : 'upcoming'}</span></div>
				<div class={stepClass(1)}><div><span class="sp-k">STAGE 2</span><span class="sp-t">Fraud check</span></div><span class="sp-badge">{index > 1 ? '✓ done' : index === 1 ? '▶ active' : 'upcoming'}</span></div>
				<div class={stepClass(2)}><div><span class="sp-k">STAGE 3</span><span class="sp-t">HQ confirmation</span></div><span class="sp-badge">{index > 2 ? '✓ done' : index === 2 ? '▶ active' : 'upcoming'}</span></div>
			</nav>

			<div class="detail-grid">
				<div class="stack">
					<section class="card-cream">
						<div class="sec-head">
							<h2>{submission.projectName}</h2>
							<span class="sub">submitted {formatEt(submission.createdAt)}</span>
						</div>
						<div class="kv-grid">
							<div class="kv">
								<span class="k">author</span>
								<span class="v">
									<strong>{data.participant?.name ?? submission.email}</strong>
									{#if data.participant}
										<br />{data.participant.email}
										<br />hack club {data.participant.hackClubId}
										<br />verification {data.participant.verificationStatus ?? 'not on the sign-in'}
										{#if data.participant.slackId}<br />slack {data.participant.slackId}{/if}
									{:else}
										<br />no hack club auth record on this submission
									{/if}
								</span>
							</div>
							<div class="kv">
								<span class="k">hackatime project</span>
								<span class="v"><strong>{submission.hackatimeProject} · {clockHours(submission.hackatimeSeconds)}</strong> <span class={five ? 'chip chip-ok' : 'chip chip-needs-changes'}>{five ? '5h+ ✓' : 'under 5h'}</span></span>
							</div>
							<div class="kv"><span class="k">github repo</span><span class="v mono">{submission.repoUrl}</span></div>
							<div class="kv"><span class="k">playable url</span><span class="v mono">{submission.demoUrl}</span></div>
						</div>
						<div class="link-row">
							<a class="btn btn-ink btn-sm" href={submission.repoUrl} target="_blank" rel="noreferrer">Open GitHub repo ↗</a>
							<a class="btn btn-kiwi btn-sm" href={submission.demoUrl} target="_blank" rel="noreferrer">Open Playable URL ↗</a>
							{#if data.githubUsername}<span class="chip chip-stage1">github {data.githubUsername}</span>{/if}
							{#if data.hackatimeUserId}<span class="chip chip-stage1">Hackatime ID: {data.hackatimeUserId}</span>{/if}
						</div>
						<div class="kv" style="margin-bottom:12px">
							<span class="k">what did you build and learn?</span>
							<p class="v" style="margin:4px 0 0">{submission.description}</p>
						</div>
						<div class="kv" style="margin-bottom:14px">
							<span class="k">live hours</span>
							<p class="v" style="margin:4px 0 0">{data.liveHours ?? data.liveNote}</p>
							<p class="v" style="margin:4px 0 0">daily hours aren't stored on this submission</p>
						</div>
						{#if submission.hasScreenshot}
							<div class="shot-box">
								<img src="/reviews/{submission.id}/screenshot" alt="Submitted screenshot of {submission.projectName}" />
								<div class="shot-cap"><span>submitted screenshot</span></div>
							</div>
						{:else}
							<p>no screenshot on this submission</p>
						{/if}
					</section>

					<section class="card-ink">
						<div class="sec-head">
							<h2>automated check evidence</h2>
							<form method="POST" action="?/recheck"><button class="btn btn-teal btn-sm" type="submit">Re-run checks</button></form>
						</div>
						{#if data.checks.length === 0}
							<p>no checks yet</p>
						{:else}
							<div class="check-list">
								{#each data.checks as check (check.kind)}
									<div class="check-item">
										<div class="check-top">
											<span class="check-name">{checkLabel(check.kind)}</span>
											<span class={checkChip(check.flag)}>{checkWord(check.flag)}</span>
										</div>
										<p class="check-ev">{check.summary}</p>
										{#if check.evidence.length}
											<ul>
												{#each check.evidence as item, i (`${check.kind}-${i}`)}
													<li>{item.label}: {#if item.href}<a href={item.href}>{item.value}</a>{:else}{item.value}{/if}</li>
												{/each}
											</ul>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<section class="card-cream">
						<div class="sec-head"><h2>review history</h2><span class="sub">all stage decisions</span></div>
						<ol class="timeline">
							<li>
								<div class="tl-top"><span class="tl-stage">Submission received</span><span class="tl-meta">{formatEt(submission.createdAt)} · {submission.email}</span></div>
								<p class="tl-note">Submitted <strong>{submission.projectName}</strong> ({clockHours(submission.hackatimeSeconds)} Hackatime) to {submission.challengeName}.</p>
							</li>
							{#if data.checks[0]}
								<li>
									<div class="tl-top"><span class="tl-stage">Automated checks ran</span><span class="tl-meta">{formatEt(data.checks[0].ranAt)}</span></div>
									<p class="tl-note">{data.checks.map((check) => `${checkLabel(check.kind)}: ${check.flag}`).join(' · ')}</p>
								</li>
							{/if}
							{#each data.reviews as review (review.id)}
								<li>
									<div class="tl-top">
										<span class="tl-stage">{review.stage.replaceAll('_', ' ')} — {decisionLabel(review.decision)}{review.overrideHours != null ? ` (${review.overrideHours}h override)` : ''}</span>
										<span class="tl-meta">{formatEt(review.createdAt)} · {review.reviewerEmail}</span>
									</div>
									{#if review.note}<p class="tl-note">{review.note}</p>{/if}
								</li>
							{/each}
							{#if stage !== 'done'}
								<li>
									<div class="tl-top"><span class="tl-stage">{stage.replaceAll('_', ' ')} — awaiting decision</span><span class="tl-meta">current stage</span></div>
									<p class="tl-note">{data.allowed ? 'The form is on the right.' : "you can't act on this stage"}</p>
								</li>
							{/if}
						</ol>
					</section>
				</div>

				<div>
					{#if data.allowed && stage === 'first_pass'}
						<form class="paper review-panel" method="POST" action="?/review">
							<div class="sec-head"><h2>1 · first pass review</h2><span class="sub">stage 1 form</span></div>
							<div class="field"><label for="f-lapse">Justification - Lapse Links, comma-separated</label><input id="f-lapse" name="lapse_links" type="text" value={first?.lapseLinks.join(', ') ?? ''} /></div>
							<div class="field"><label for="f-tech">Justification - Specific Technical Features</label><textarea id="f-tech" name="technical_features" rows="3">{first?.technicalFeatures ?? ''}</textarea></div>
							<div class="field"><label for="f-defl">Justification - Deflation Justification</label><textarea id="f-defl" name="deflation_justification" rows="2">{first?.deflationJustification ?? ''}</textarea></div>
							<div class="field"><label for="f-alt">Justification - Alternate Tracking Method</label><input id="f-alt" name="alternate_tracking" type="text" value={first?.alternateTracking ?? ''} /></div>
							<div class="field"><label for="f-add">Justification - Additional Justification</label><textarea id="f-add" name="additional_justification" rows="2">{first?.additionalJustification ?? ''}</textarea></div>
							<div class="field"><label for="f-ovr">Hours spent linked to - Optional - Override Hours Spent</label><input id="f-ovr" name="override_hours" type="number" step="0.1" value={first?.overrideHours ?? ''} /></div>
							<div class="field"><label for="f-note">Reviewer note</label><textarea id="f-note" name="note" rows="3"></textarea></div>
							{#if form?.error}<p>{form.error}</p>{/if}
							<div class="form-actions">
								<button class="stampbtn stamp" name="decision" value="approved">approve</button>
								<button class="btn btn-amber" name="decision" value="needs_changes">Request changes</button>
								<button class="btn btn-red" name="decision" value="rejected">Reject</button>
							</div>
						</form>
					{:else if data.allowed && stage === 'fraud'}
						<form class="paper review-panel" method="POST" action="?/review">
							<div class="sec-head"><h2>2 · fraud check</h2><span class="sub">stage 2 form</span></div>
							<div class="readonly-recap">
								<h3>automated flags &amp; first-pass recap</h3>
								<dl>
									<dt>active flags</dt>
									<dd>{#if data.checks.filter((check) => check.flag === 'flag').length === 0}none{:else}{data.checks.filter((check) => check.flag === 'flag').map((check) => checkLabel(check.kind)).join(', ')}{/if}</dd>
									<dt>first pass</dt>
									<dd>{first ? `${decisionLabel(first.decision)} by ${first.reviewerEmail}` : 'no first-pass decision yet'}{#if submission.overrideHours != null} · override {submission.overrideHours}h{/if}</dd>
									<dt>deflation note</dt><dd>{first?.deflationJustification || '—'}</dd>
									<dt>lapse links</dt><dd class="mono">{first?.lapseLinks.join(', ') || '—'}</dd>
								</dl>
							</div>
							<div class="field"><label for="f2-note">Reviewer note</label><textarea id="f2-note" name="note" rows="4"></textarea></div>
							<input type="hidden" name="lapse_links" value={first?.lapseLinks.join(', ') ?? ''} />
							{#if form?.error}<p>{form.error}</p>{/if}
							<div class="form-actions">
								<button class="stampbtn stamp" name="decision" value="clear">mark clear</button>
								<button class="btn btn-red" name="decision" value="fraud">Flag as fraud</button>
								<button class="btn btn-amber" name="decision" value="needs_info">Needs info</button>
								<button class="btn btn-ink" name="decision" value="sent_back">Send back</button>
							</div>
						</form>
					{:else if data.allowed && stage === 'hq'}
						<form class="paper review-panel" method="POST" action="?/review">
							<div class="sec-head"><h2>3 · HQ confirmation</h2><span class="sub">stage 3 final sign-off</span></div>
							<div class="readonly-recap">
								<h3>ready to confirm</h3>
								<dl>
									<dt>final hours</dt><dd><strong>{hours}h</strong> {five ? 'meets the 5 hour minimum' : 'under 5 hours'}</dd>
									<dt>stage 1</dt><dd>{first ? `${decisionLabel(first.decision)} by ${first.reviewerEmail}` : '—'}</dd>
									<dt>stage 2</dt><dd>{fraud ? `${decisionLabel(fraud.decision)} by ${fraud.reviewerEmail}` : '—'}</dd>
									<dt>airtable</dt><dd>{data.airtable === 'configured' ? (data.outbox ? data.outbox.status : 'not eligible until this confirm') : `not configured. ${data.airtable}`}</dd>
								</dl>
							</div>
							<div class="readonly-recap">
								<h3>justifications summary (read-only)</h3>
								<dl>
									<dt>Lapse links</dt><dd class="mono">{first?.lapseLinks.join(', ') || '—'}</dd>
									<dt>Tech features</dt><dd>{first?.technicalFeatures || '—'}</dd>
									<dt>Deflation</dt><dd>{first?.deflationJustification || '—'}</dd>
									<dt>Alt tracking</dt><dd>{first?.alternateTracking || '—'}</dd>
									<dt>Additional</dt><dd>{first?.additionalJustification || '—'}</dd>
								</dl>
							</div>
							<div class="field"><label for="f3-note">Reviewer note</label><textarea id="f3-note" name="note" rows="3"></textarea></div>
							<input type="hidden" name="lapse_links" value={first?.lapseLinks.join(', ') ?? ''} />
							{#if form?.error}<p>{form.error}</p>{/if}
							<div class="form-actions">
								<button class="stampbtn stamp" name="decision" value="confirmed">confirm &amp; approve</button>
								<button class="btn btn-amber" name="decision" value="sent_back">Send back</button>
							</div>
						</form>
					{:else}
						<section class="paper review-panel">
							<div class="sec-head"><h2>{stage === 'done' ? 'completed' : 'this stage'}</h2></div>
							<p>{stage === 'done' ? 'HQ already confirmed this submission.' : "you can't act on this stage"}</p>
							<p>airtable: {data.airtable === 'configured' ? (data.outbox?.status ?? 'not eligible until hq confirms') : data.airtable}{data.outbox?.lastError ? ` · ${data.outbox.lastError}` : ''}</p>
							{#if data.role === 'owner' && data.outbox && data.outbox.status !== 'synced'}
								<form method="POST" action="?/sync"><button class="btn btn-ink" type="submit">sync to Airtable</button></form>
							{/if}
						</section>
					{/if}
					{#if data.role === 'owner' && data.allowed && data.outbox && data.outbox.status !== 'synced'}
						<form method="POST" action="?/sync" style="margin-top:12px"><button class="btn btn-ink btn-sm" type="submit">sync to Airtable</button></form>
						{#if data.outbox.lastError}<p>{data.outbox.lastError}</p>{/if}
					{/if}
				</div>
			</div>
		</div>
	</main>
</div>
