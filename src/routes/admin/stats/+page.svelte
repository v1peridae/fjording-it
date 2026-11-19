<script lang="ts">
	import type { PageProps } from './$types';
	import Charts from './Charts.svelte';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>admin · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="pointer-events-none fixed inset-0 -z-10 bg-[#f5f0e8] bg-[url(/fjord.png)] bg-cover bg-center bg-no-repeat"
	aria-hidden="true"
></div>

<main class="relative min-h-dvh px-4 py-8 text-[18px] text-ink md:px-6 md:py-12">
	<div class="mx-auto flex w-full max-w-[960px] flex-col gap-5">
		{#if data.view === 'stats'}
			<header class="border-2 border-ink bg-cream px-5 py-6 text-center md:px-8">
				<h1 class="text-[40px] leading-none text-balance md:text-[52px]">{data.report.line}</h1>
				<p class="mt-3 text-[18px]">times below are eastern time</p>
			</header>

			<div class="grid grid-cols-2 gap-3 md:grid-cols-4">
				<div class="border-2 border-ink bg-cream px-4 py-5">
					<p class="text-[16px]">total</p>
					<p class="mt-2 text-[44px] leading-none">{data.report.count}</p>
				</div>
				<div class="border-2 border-ink bg-cream px-4 py-5">
					<p class="text-[16px]">days</p>
					<p class="mt-2 text-[44px] leading-none">{data.report.days ?? 0}</p>
				</div>
				<div class="border-2 border-ink bg-cream px-4 py-5">
					<p class="text-[16px]">today</p>
					<p class="mt-2 text-[44px] leading-none">{data.report.today}</p>
				</div>
				<div class="border-2 border-ink bg-cream px-4 py-5">
					<p class="text-[16px]">avg / day</p>
					<p class="mt-2 text-[44px] leading-none">{data.report.perDay}</p>
				</div>
			</div>

			{#if data.report.daysSeries.length > 0}
				<Charts days={data.report.daysSeries} hours={data.report.hours} />
			{:else}
				<p class="border-2 border-ink bg-cream px-5 py-6 text-center text-[18px]">no sign-ups yet</p>
			{/if}

			<section class="border-2 border-ink bg-cream p-5 md:p-6">
				<h2 class="text-[28px] leading-none">latest</h2>
				{#if data.report.recent.length === 0}
					<p class="mt-4 text-[18px]">nothing here yet</p>
				{:else}
					<div class="mt-4 overflow-x-auto">
						<table class="w-full text-left text-[18px]">
							<thead>
								<tr class="border-b-2 border-ink">
									{#if data.report.hasNames}
										<th class="py-3 pr-4 font-normal" scope="col">name</th>
									{/if}
									<th class="py-3 font-normal" scope="col">when</th>
								</tr>
							</thead>
							<tbody>
								{#each data.report.recent as row, index (`${row.at}-${index}`)}
									<tr class="border-b border-ink/25 last:border-0">
										{#if data.report.hasNames}
											<td class="py-3 pr-4">{row.name ?? ''}</td>
										{/if}
										<td class="py-3">{row.when}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="mt-4 text-[16px]">eastern time. newest first.</p>
				{/if}
			</section>
		{:else}
			<div class="mx-auto w-full max-w-[520px] border-2 border-ink bg-cream px-6 py-8 text-center">
				{#if data.view === 'denied'}
					<h1 class="text-[40px] leading-none">not authorised</h1>
				{:else if data.view === 'error'}
					<h1 class="text-[32px] leading-none text-rust">couldn't load sign-ups</h1>
				{:else}
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
				{/if}
			</div>
		{/if}
	</div>
</main>
