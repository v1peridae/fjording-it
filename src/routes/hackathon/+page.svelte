<script lang="ts">
	import { countdownAt } from '#lib/hackathon.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
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
	<title>fjording it: the hackathon</title>
	<meta name="description" content="online, fri nov 27 to sun dec 6." />
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
			<nav>
				<a class="mini" href="/">fjording it</a>
				<div class="right">
					<ul>
						<li class="opt"><a href="#prizes">prizes</a></li>
						<li class="opt"><a href="#rules">rules</a></li>
						<li>
							<span class="soon" aria-disabled="true">
								<span class="word">submit</span>
								<span class="note">opens nov 27</span>
							</span>
						</li>
					</ul>
					{#if data.handle}
						<span class="tagwrap">
							<img class="string" src="/hackathon/tag-string.svg" alt="" />
							<span class="tag"><span class="t">signed in as</span><b>{data.handle}</b></span>
						</span>
					{/if}
				</div>
			</nav>
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
			<div><span class="subline strip torn">the hackathon</span></div>
			<div class="row">
				<div class="when strip torn">
					<span class="k">online, 10 days</span>
					<b><span class="nw">fri nov 27</span> → <span class="nw">sun dec 6</span></b>
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
					<p class="fine">unlocks when you buy your ticket. capped at what your flight really costs.</p>
				</div>
				<div class="cap torn">
					<!-- Swap the cap here: static/hackathon/cap.png. 756w is the file shipped now; a larger replacement stays sharp at 170px / 110px. -->
					<img
						src="/hackathon/cap.png"
						srcset="/hackathon/cap.png 756w"
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
					<dt>stuck?</dt>
					<dd>ask in <span class="chan">#fjording-help</span></dd>
				</dl>
			</div>
		</div>
	</section>

	<div class="foot-space" aria-hidden="true"></div>
</div>
