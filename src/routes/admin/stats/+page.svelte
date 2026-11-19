<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>admin · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="flex min-h-dvh p-4">
	<div
		class="relative isolate m-auto flex w-full max-w-[720px] flex-col items-center px-6 py-16 before:absolute before:inset-y-0 before:inset-x-[1.1%] before:-z-1 before:opacity-90 before:paper md:px-16 md:py-20"
	>
		{#if data.view === 'stats'}
			<p class="text-center text-[28px] text-balance md:text-[34px]">{data.line}</p>
		{:else if data.view === 'denied'}
			<p class="text-center text-[28px]">not authorised</p>
		{:else if data.view === 'error'}
			<p class="text-center text-[22px] text-balance text-rust">couldn't load sign-ups</p>
		{:else}
			<h1 class="mb-6 font-pirate-3d text-[40px] underline decoration-from-font">admin</h1>
			<form method="POST" action="?/signin" class="flex w-full max-w-[460px] flex-col gap-2 md:flex-row">
				<input
					type="email"
					name="email"
					placeholder="you@hackclub.com"
					aria-label="your email"
					autocomplete="email"
					maxlength="254"
					value={form?.email ?? ''}
					class="h-12 w-full min-w-0 border border-ink bg-cream px-3.5 font-pirate-3d text-[18px] text-ink placeholder:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:flex-1"
				/>
				<button
					class="h-12 cursor-pointer bg-ink px-4 font-pirate-3d text-[20px] text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:w-32"
				>
					sign in
				</button>
			</form>
			{#if form?.error || data.error}
				<p class="mt-3 text-center text-[16px] text-rust">{form?.error ?? data.error}</p>
			{/if}
		{/if}
	</div>
</main>
