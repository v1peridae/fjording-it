<script lang="ts">
	import type { PageProps } from './$types';
	import Charts from './Charts.svelte';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>admin · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="flex min-h-dvh p-4">
	<div
		class="relative isolate m-auto flex w-full max-w-[1000px] flex-col px-5 py-12 before:absolute before:inset-y-0 before:inset-x-[1.1%] before:-z-1 before:opacity-90 before:paper md:px-14 md:py-16"
	>
		{#if data.view === 'stats'}
			<header class="text-center">
				<h1 class="text-[28px] text-balance md:text-[36px]">{data.report.line}</h1>
				<p class="mt-2 text-[16px]">times below are eastern time</p>
			</header>

			{#if data.report.daysSeries.length > 0}
				<Charts days={data.report.daysSeries} hours={data.report.hours} />
			{:else}
				<p class="mt-8 text-center text-[18px]">no sign-ups yet</p>
			{/if}

			<section class="mt-8">
				<h2 class="text-[22px]">latest</h2>
				{#if data.report.recent.length === 0}
					<p class="mt-3 text-[16px]">nothing here yet</p>
				{:else}
					<div class="mt-3 overflow-x-auto">
						<table class="w-full text-left text-[16px]">
							<thead>
								<tr class="border-b border-ink/30">
									{#if data.report.hasNames}
										<th class="py-2 pr-4 font-normal" scope="col">name</th>
									{/if}
									<th class="py-2 font-normal" scope="col">when</th>
								</tr>
							</thead>
							<tbody>
								{#each data.report.recent as row, index (`${row.at}-${index}`)}
									<tr class="border-b border-ink/15 last:border-0">
										{#if data.report.hasNames}
											<td class="py-2 pr-4">{row.name ?? ''}</td>
										{/if}
										<td class="py-2">{row.when}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="mt-3 text-[13px]">eastern time. newest first.</p>
				{/if}
			</section>
		{:else if data.view === 'denied'}
			<p class="m-auto text-center text-[28px]">not authorised</p>
		{:else if data.view === 'error'}
			<p class="m-auto text-center text-[22px] text-rust">couldn't load sign-ups</p>
		{:else}
			<div class="m-auto w-full max-w-[460px] text-center">
				<h1 class="mb-6 font-pirate-3d text-[40px] underline decoration-from-font">admin</h1>
				<form method="POST" action="?/signin" class="flex flex-col gap-2 md:flex-row">
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
					<p class="mt-3 text-[16px] text-rust">{form?.error ?? data.error}</p>
				{/if}
			</div>
		{/if}
	</div>
</main>
