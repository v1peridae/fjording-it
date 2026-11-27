<script lang="ts">
	import { CHALLENGE_SPAN } from '#lib/hackathon.ts';
	import PublicNav from '../PublicNav.svelte';
	import type { PageProps } from './$types';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>join · fjording it</title>
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
			<PublicNav home="/" links={[{ href: '/hackathon#rules', label: 'rules' }]} label={data.label} />
		</div>
	</div>
	<header class="submit-hero">
		<div class="wrap">
			<h1 class="ask">do you want to join the northern challenge?</h1>
		</div>
	</header>
	<main class="wrap formwrap">
		<form class="formcard paper join-ask" method="POST">
			{#if form?.error}<p class="banner strip torn">{form.error}</p>{/if}
			<p>{CHALLENGE_SPAN}. you can set up a project now or come back to it.</p>
			<p class="prizes">
				code for 5 hours and we send you a cap. the top 5 projects, picked by HQ, each get $300 toward a flight to norway once you get your ticket.
			</p>
			<div class="ask">
				<button class="btn stampbtn inkstamp stamp" name="choice" value="in" type="submit">yes</button>
				<button class="later-btn" name="choice" value="later" type="submit">not now</button>
			</div>
		</form>
	</main>
</div>

<style>
	.join-ask p {
		margin: 0 0 16px;
		font-family: var(--times);
		font-size: 24px;
	}

	.join-ask .prizes {
		font-size: 22px;
	}

	.ask {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 18px;
	}

	.later-btn {
		background: transparent;
		border: 0;
		border-bottom: 2px solid var(--ink);
		color: var(--ink);
		font-family: var(--display);
		font-size: 22px;
		cursor: pointer;
		padding: 0 0 2px;
	}
</style>
