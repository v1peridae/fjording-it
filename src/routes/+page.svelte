<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head>
	<title>fjording it</title>
	<meta name="description" content="40 teens will be in a fjord in norway this april" />
</svelte:head>

<main class="flex min-h-dvh p-4">
	<div
		class="@container relative isolate m-auto flex w-full flex-col items-center px-5 py-14 before:absolute before:inset-y-0 before:inset-x-[1.1%] before:-z-1 before:opacity-90 before:paper md:aspect-[1000/720] md:w-[min(1000px,100%,max(680px,(100dvh_-_64px)*1000/720))] md:p-0"
	>
		<div class="relative flex items-center md:mt-[5cqw] md:h-[13cqw]">
			<h1
				class="font-pirate-3d text-[16cqw] underline decoration-from-font [text-decoration-skip-ink:none] [text-underline-position:from-font] md:text-[9.2cqw]"
			>
				fjording it
			</h1>
			<span
				class="absolute top-[15.5cqw] right-[0.9cqw] font-times text-[3.1cqw] tracking-[-0.05em] whitespace-nowrap md:top-[10cqw] md:right-[0.5cqw] md:text-[max(1.8cqw,12px)]"
			>hack club</span>
		</div>
		<p class="mt-3 text-center text-[24px] text-balance md:mt-[1.1cqw] md:h-[3cqw] md:text-[4cqw]">
			40 teens will be in a
			<a
				href="https://en.wikipedia.org/wiki/Fjord"
				target="_blank"
				rel="noreferrer"
				class="cursor-help">fjord</a
			>
			in norway this april
		</p>
		<div
			class="mt-6 h-[24cqw] w-[84cqw] flex-none bg-[url(/fjord.png)] bg-cover bg-fixed bg-center mask-[url(/birds.png)] mask-size-[100cqw_100cqw] mask-position-[-8cqw_-38cqw] mask-no-repeat md:mt-[2.7cqw]"
			role="img"
			aria-label="three birds flying over a fjord"
		></div>

		<section class="mt-7 w-full text-center md:mt-[3.5cqw] md:w-[58cqw]">
			<h2 class="mb-3.5 text-[26px] md:mb-[2cqw] md:text-[3.6cqw]">do you wanna join them?</h2>
			{#if form?.success}
				<p class="grid h-12 place-items-center text-[16px] md:h-[5cqw] md:text-[max(1.8cqw,14px)]">
					you're in! keep an eye on your inbox
				</p>
			{:else}
				<form
					class="flex flex-col gap-2 md:flex-row md:gap-[1.2cqw]"
					method="POST"
					use:enhance={() => {
						sending = true;
						return async ({ update }) => {
							await update();
							sending = false;
						};
					}}
				>
					<input
						type="email"
						name="email"
						placeholder="awesomesauce@hackclub.com"
						aria-label="your email"
						autocomplete="email"
						maxlength="254"
						value={form?.email ?? ''}
						required
						class="h-12 w-full min-w-0 flex-none rounded-none border border-ink bg-cream px-3.5 font-pirate-3d text-[18px] text-ink placeholder:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:h-[5cqw] md:w-auto md:flex-1 md:px-[1.6cqw] md:text-[max(2.4cqw,16px)]"
					/>
					<div class="absolute -left-[9999px]" aria-hidden="true">
						<input type="text" name="website" tabindex="-1" autocomplete="off" />
					</div>
					<button
						disabled={sending}
						class="h-12 w-full cursor-pointer bg-ink font-pirate-3d text-[20px] text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-wait disabled:opacity-60 md:h-[5cqw] md:w-[14cqw] md:text-[max(2cqw,14px)]"
					>
						i'm in
					</button>
				</form>
				{#if form?.error}
					<p class="mt-2.5 text-[14px] text-rust md:mt-[1cqw] md:text-[max(1.4cqw,13px)]">
						{form.error}
					</p>
				{/if}
			{/if}
		</section>

		<p
			class="mt-7 text-center font-literatura text-[12px] font-bold tracking-[0.03em] text-balance italic md:absolute md:inset-x-0 md:top-[64.7cqw] md:mt-0 md:text-[max(1.2cqw,11px)] md:whitespace-nowrap"
		>made with love by @guac, @johnny and @lou from hack club</p>
	</div>
</main>
