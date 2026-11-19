<script lang="ts">
	import type { PageProps } from './$types';
	import Charts from './Charts.svelte';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>admin · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="min-h-dvh bg-hc-snow px-4 py-8 font-phantom text-hc-ink md:px-6 md:py-12">
	{#if data.view === 'stats'}
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
			<header>
				<p class="text-sm font-bold text-hc">fjording it</p>
				<h1 class="mt-1 text-3xl font-bold tracking-tight text-balance tabular-nums md:text-4xl">{data.report.line}</h1>
				<p class="mt-2 text-sm text-hc-muted">Times below are Eastern time.</p>
			</header>

			{#if data.report.daysSeries.length > 0}
				<Charts days={data.report.daysSeries} hours={data.report.hours} />
			{:else}
				<section class="rounded-2xl border border-black/10 bg-white p-6 text-sm text-hc-muted">No sign-ups yet.</section>
			{/if}

			<section class="rounded-2xl border border-black/10 bg-white p-4 shadow-[0_1px_2px_rgba(23,23,29,0.04)] md:p-6">
				<h2 class="text-lg font-bold">Latest</h2>
				{#if data.report.recent.length === 0}
					<p class="mt-3 text-sm text-hc-muted">Nothing here yet.</p>
				{:else}
					<div class="mt-3 overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="text-hc-muted">
								<tr class="border-b border-black/10">
									{#if data.report.hasNames}
										<th class="py-2 pr-4 font-medium" scope="col">Name</th>
									{/if}
									<th class="py-2 font-medium" scope="col">When</th>
								</tr>
							</thead>
							<tbody>
								{#each data.report.recent as row, index (`${row.at}-${index}`)}
									<tr class="border-b border-black/5 last:border-0">
										{#if data.report.hasNames}
											<td class="py-2.5 pr-4">{row.name ?? ''}</td>
										{/if}
										<td class="py-2.5 tabular-nums">{row.when}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="mt-3 text-xs text-hc-muted">Eastern time. Newest first.</p>
				{/if}
			</section>
		</div>
	{:else}
		<div class="mx-auto flex min-h-[70dvh] w-full max-w-md items-center">
			<div class="w-full rounded-2xl border border-black/10 bg-white p-6 shadow-[0_1px_2px_rgba(23,23,29,0.04)] md:p-8">
				<p class="text-sm font-bold text-hc">fjording it</p>
				{#if data.view === 'denied'}
					<h1 class="mt-3 text-2xl font-bold">not authorised</h1>
				{:else if data.view === 'error'}
					<h1 class="mt-3 text-2xl font-bold text-hc">couldn't load sign-ups</h1>
				{:else}
					<h1 class="mt-3 text-2xl font-bold">admin</h1>
					<form method="POST" action="?/signin" class="mt-6 flex flex-col gap-2 sm:flex-row">
						<input
							type="email"
							name="email"
							placeholder="you@hackclub.com"
							aria-label="your email"
							autocomplete="email"
							maxlength="254"
							value={form?.email ?? ''}
							class="h-12 min-w-0 flex-1 rounded-xl border border-black/15 px-3.5 text-base text-hc-ink outline-none placeholder:text-hc-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hc"
						/>
						<button
							class="h-12 cursor-pointer rounded-full bg-hc px-5 text-base font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hc"
						>
							sign in
						</button>
					</form>
					{#if form?.error || data.error}
						<p class="mt-3 text-sm text-hc">{form?.error ?? data.error}</p>
					{/if}
				{/if}
			</div>
		</div>
	{/if}
</main>
