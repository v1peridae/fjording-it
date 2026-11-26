<script lang="ts">
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
	<div class="topbar torn-bottom">
		<div class="wrap">
			<PublicNav home="/" links={[{ href: '/hackathon#rules', label: 'rules' }]} label={data.label} />
		</div>
	</div>
	<header class="submit-hero">
		<div class="wrap">
			<h1 class="ask">Do you want to join the Northern Challenge?</h1>
		</div>
	</header>
	<main class="wrap formwrap">
		<form class="formcard paper join-ask" method="POST">
			{#if form?.error}<p class="banner strip torn">{form.error}</p>{/if}
			<p>ten days online, Nov 27 to Dec 6. you can set up a project now, or come back to it.</p>
			<div class="ask">
				<button class="btn stampbtn inkstamp stamp" name="choice" value="in" type="submit">yes</button>
				<button class="later-btn" name="choice" value="later" type="submit">not now</button>
			</div>
		</form>
	</main>
</div>

<style>
	.join-ask p {
		margin: 0 0 22px;
		font-family: var(--times);
		font-size: 24px;
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
