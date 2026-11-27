<script lang="ts">
	import { onMount } from 'svelte';
	import { timeUntilDeadline } from '#lib/hackathon.ts';
	import PublicNav from '../PublicNav.svelte';
	import type { PageProps } from './$types';
	import '../hackathon.css';

	let { data }: PageProps = $props();
	let ticked = $state<number | undefined>(undefined);
	let view = $derived(timeUntilDeadline(new Date(ticked ?? data.now)));

	onMount(() => {
		ticked = Date.now();
		const id = setInterval(() => {
			ticked = Date.now();
		}, 30_000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<title>you · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="hackathon submit-page">
	<picture class="bg">
		<source media="(max-width: 760px)" srcset="/hackathon/lauklines-3600.jpg" />
		<img
			src="/hackathon/lauklines-3600.jpg"
			srcset="/hackathon/lauklines-2400.jpg 2400w, /hackathon/lauklines-3600.jpg 3600w"
			sizes="100vw"
			width="3600"
			height="2400"
			alt="northern lights over a fjord at lauklines, norway"
		/>
	</picture>
	<div class="topbar torn-bottom">
		<div class="wrap">
			<PublicNav home="/hackathon" links={[{ href: '/hackathon#prizes', label: 'prizes' }]} label={data.label} />
		</div>
	</div>
	<header class="submit-hero">
		<div class="wrap">
			<h1 class="ask">your challenge</h1>
		</div>
	</header>
	<main class="wrap formwrap">
		<section class="formcard paper you-card">
			<p class="k">people at 5 hours</p>
			<p class="v">{data.reached === 0 ? 'nobody has 5 hours yet' : data.reached}</p>
			<p class="k">time left</p>
			{#if view.phase === 'done'}
				<p class="v">that's a wrap</p>
			{:else}
				<p class="v">{view.days} days {view.hours} hrs {view.minutes} mins</p>
			{/if}
			<p class="k">your hours</p>
			{#if !data.linked}
				<p class="v">link a hackatime project to count hours</p>
			{:else if data.hoursUnknown}
				<p class="v">couldn't check your hours yet</p>
			{:else}
				<p class="v">{data.hours} so far</p>
			{/if}
			<p class="next">
				{#if data.linked}
					<a href="/hackathon/details">your details</a>
				{:else}
					<a href="/hackathon/start">set up your project</a>
				{/if}
				· <a href="/hackathon/submit">submit</a>
			</p>
		</section>
	</main>
</div>

<style>
	.you-card .k {
		margin: 14px 0 0;
		font-family: var(--times);
		font-size: 18px;
	}

	.you-card .v {
		margin: 0;
		font-family: var(--display);
		font-size: 28px;
		line-height: 1.15;
	}

	.you-card .next {
		margin: 22px 0 0;
		font-family: var(--times);
		font-size: 20px;
	}

	.you-card .next a {
		color: inherit;
	}
</style>
