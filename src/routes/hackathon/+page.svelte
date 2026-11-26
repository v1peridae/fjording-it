<script lang="ts">
	import { countdownAt } from '#lib/hackathon.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import AdminNav from '#lib/AdminNav.svelte';
	import PublicNav from './PublicNav.svelte';
	import './hackathon.css';

	let { data }: PageProps = $props();
	// Stays unset through hydration so the server clock and the client clock match.
	let ticked = $state<number | undefined>(undefined);
	let now = $derived(ticked ?? data.now);
	let view = $derived(countdownAt(new Date(now)));

	onMount(() => {
		ticked = Date.now();
		const id = setInterval(() => {
			ticked = Date.now();
		}, 30_000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>fjording it: The Northern Challenge</title>
	<meta name="description" content="Nov 27 to Dec 6. closes Sun Dec 6 at 11:59pm ET." />
	<meta name="robots" content="noindex, nofollow" />
	<link
		rel="preload"
		href="/fonts/Hershey-Noailles-Times-Duplex-Italic-Bold.otf"
		as="font"
		type="font/otf"
		crossorigin="anonymous"
	/>
</svelte:head>

<div class="hackathon">
	{#if data.nav.staff}
		<div class="wrap" style="padding-top: 8px">
			<AdminNav role={data.nav.staff} route="/hackathon" email={data.email ?? ''} handle={data.handle} />
		</div>
	{/if}
	<picture class="bg">
		<source media="(max-width: 760px)" srcset="/hackathon/lauklines-3600.jpg" />
		<img
			src="/hackathon/lauklines-3600.jpg"
			srcset="/hackathon/lauklines-2400.jpg 2400w, /hackathon/lauklines-3600.jpg 3600w"
			sizes="100vw"
			width="3600"
			height="2400"
			alt="northern lights over a fjord at lauklines, norway"
			fetchpriority="high"
		/>
	</picture>

	<div class="topbar torn-bottom">
		<div class="wrap">
			<PublicNav home="/" links={data.nav.public} label={data.participantLabel} />
		</div>
	</div>

	<header class="hero">
		<div class="wrap">
			<div class="geese" aria-hidden="true">
				<img class="g1" src="/hackathon/goose-1.png" alt="" />
				<img class="g2" src="/hackathon/goose-2.png" alt="" />
				<img class="g3" src="/hackathon/goose-3.png" alt="" />
			</div>
			<div class="mark"><h1>fjording it</h1><span class="hc">hack club</span></div>
			<div><span class="subline strip torn">The Northern Challenge</span></div>
			<div class="row">
				<div class="when strip torn">
					<span class="k">online, 10 days</span>
					<b>Nov 27 to Dec 6</b>
					<span class="close">closes Sun Dec 6 at 11:59pm ET</span>
				</div>
				<div class="ticket paper" aria-live="polite">
					<p class="lbl">{view.label}</p>
					{#if view.phase === 'done'}
						<div class="count"><span>judging<small>now</small></span></div>
					{:else}
						<div class="count">
							<span>{view.days}<small>days</small></span>
							<span>{view.hours}<small>hrs</small></span>
							<span>{view.minutes}<small>mins</small></span>
						</div>
					{/if}
				</div>
			</div>
			{#if data.notice}
				<p class="banner strip torn">{data.notice}</p>
			{:else if data.participantLabel}
				<p class="yourein strip torn">you're in, {data.participantLabel}.</p>
			{/if}
			{#if data.showJoin}
				<form class="join" method="POST" action="?/join">
					<button class="stamp" type="submit">join the Northern Challenge</button>
				</form>
			{:else if data.needsOnboarding}
				<p class="remind strip torn">when you're ready, <a href="/hackathon/start">name your project and link Hackatime</a>.</p>
			{/if}
		</div>
	</header>

	<section class="block" id="prizes">
		<div class="wrap">
			<div class="headstrip strip torn"><h2>what you can win</h2></div>
			<div class="prizes">
				<div class="stipend paper">
					<p class="amt">$300</p>
					<p class="top">top 5 projects, each</p>
					<p class="what">flight stipend to norway</p>
					<p class="fine">unlocks when you buy your ticket.</p>
				</div>
				<div class="cap torn">
					<!-- Full cap: static/hackathon/cap.png (2000px). cap-600.png is the srcset candidate for the 170px / 110px slot. -->
					<img
						src="/hackathon/cap.png"
						srcset="/hackathon/cap-600.png 600w, /hackathon/cap.png 2000w"
						sizes="(max-width: 760px) 110px, 170px"
						alt="navy fjording it dad cap: three geese over the wordmark"
					/>
					<div class="back">
						<span class="mini-stamp stamp"><img src="/hackathon/goose-2.png" alt="" /></span>
						<p class="what">ship 5+ hours, get the cap</p>
						<p>everyone who ships 5 or more tracked hours gets one.</p>
						<i class="rule"></i>
						<i class="rule"></i>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="block" id="rules">
		<div class="wrap rules">
			<div class="strip torn">
				<h2>the rules</h2>
				<p class="headline">
					ship any software project, <span>at least 5 hours long</span>, with a <span>playable url</span> and
					a <span>github link</span>.
				</p>
			</div>
			<div class="strip torn">
				<dl>
					<dt>who</dt>
					<dd>ages 13 to 18, signed up on fjording.hackclub.com</dd>
					<dt>who picks</dt>
					<dd>the best projects are chosen by a vote run by Hack Club HQ</dd>
					<dt>stuck?</dt>
					<dd>ask in <a class="chan" href="https://hackclub.slack.com/app_redirect?channel=fjording-help">#fjording-help</a></dd>
				</dl>
			</div>
		</div>
	</section>

	<div class="foot-space" aria-hidden="true"></div>
	<a class="submit-fab stamp" href="/hackathon/submit">Submit</a>
</div>
