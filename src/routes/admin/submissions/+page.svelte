<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>northern challenge · admin</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div
	class="pointer-events-none fixed inset-0 -z-10 bg-[#f5f0e8] bg-[url(/fjord.png)] bg-cover bg-center bg-no-repeat"
	aria-hidden="true"
></div>

<main class="relative min-h-dvh px-4 py-8 text-[18px] text-ink md:px-6 md:py-12">
	<div class="mx-auto flex w-full max-w-[960px] flex-col gap-5">
		<header class="border-2 border-ink bg-cream px-5 py-6 text-center md:px-8">
			<h1 class="text-[40px] leading-none md:text-[52px]">northern challenge</h1>
			<p class="mt-3 text-[18px]"><a class="underline decoration-from-font" href="/admin/stats">back to sign-ups</a></p>
		</header>

		{#if data.view === 'error'}
			<p class="border-2 border-ink bg-cream px-5 py-6 text-center text-[18px]">couldn't load submissions</p>
		{:else if data.rows.length === 0}
			<p class="border-2 border-ink bg-cream px-5 py-6 text-center text-[18px]">no submissions yet</p>
		{:else}
			<section class="border-2 border-ink bg-cream p-5 md:p-6">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-[18px]">
						<thead>
							<tr class="border-b-2 border-ink">
								<th class="py-3 pr-4 font-normal" scope="col">when</th>
								<th class="py-3 pr-4 font-normal" scope="col">who</th>
								<th class="py-3 pr-4 font-normal" scope="col">project</th>
								<th class="py-3 pr-4 font-normal" scope="col">hackatime</th>
								<th class="py-3 font-normal" scope="col">links</th>
							</tr>
						</thead>
						<tbody>
							{#each data.rows as row (row.id)}
								<tr class="border-b border-ink/25 align-top last:border-0">
									<td class="py-3 pr-4">{row.when}</td>
									<td class="py-3 pr-4">{row.email}</td>
									<td class="py-3 pr-4">
										<p>{row.projectName}</p>
										<p class="mt-1">{row.description}</p>
									</td>
									<td class="py-3 pr-4">{row.hackatimeProject} · {row.hours}</td>
									<td class="py-3">
										<p><a class="underline decoration-from-font" href={row.repoUrl}>repo</a></p>
										<p><a class="underline decoration-from-font" href={row.demoUrl}>demo</a></p>
										{#if row.screenshotName}
											<p><a class="underline decoration-from-font" href="/admin/submissions/{row.id}/screenshot">screenshot</a></p>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	</div>
</main>
