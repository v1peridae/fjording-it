<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let sending = $state(false);
</script>

<svelte:head>
	<title>fjording it</title>
	<meta name="description" content="40 teens will be in a fjord in norway this april" />
</svelte:head>

<main class="flex min-h-dvh p-4">
	<div
		class="@container relative isolate m-auto flex w-full flex-col items-center px-5 py-14 before:absolute before:inset-y-0 before:inset-x-[1.1%] before:-z-1 before:opacity-90 before:paper md:w-[min(1000px,100%)] md:p-8"
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
		<a
			href="/hackathon"
			class="mt-5 flex w-[min(100%,520px)] flex-col border-2 border-ink bg-ink px-4 py-3 text-cream no-underline md:mt-[1.4cqw] md:w-[62cqw]"
		>
			<span class="font-times text-[15px] md:text-[max(1.4cqw,13px)]">The Northern Challenge</span>
			<span class="font-pirate-3d text-[26px] leading-tight md:text-[max(2.6cqw,20px)]">Win a $300 flight stipend NOW</span>
		</a>
		<img
			src="/tromso-aurora.webp"
			alt="northern lights over Tromsø, Norway"
			width="1280"
			height="852"
			class="mt-2 h-44 w-[min(100%,520px)] object-cover md:mt-[0.6cqw] md:h-[16cqw] md:w-[62cqw]"
		/>
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

		<section class="mt-7 w-full text-center md:mt-[2.5cqw] md:w-[58cqw]">
			<h2 class="mb-3.5 -translate-y-3 text-[26px] md:mb-[1cqw] md:-translate-y-[1cqw] md:text-[3.6cqw]">do you wanna join them?</h2>
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
			{/if}
			{#if form?.error}
				<p class="mt-2.5 text-[14px] text-rust md:mt-[0.8cqw] md:text-[max(1.4cqw,13px)]">
					{form.error}
				</p>
			{:else if data.signups !== null}
				<p class="mt-3 text-[22px] text-balance md:mt-[0.8cqw] md:text-[max(2.2cqw,17px)]">
					{data.signups}/2000 <span class="whitespace-nowrap">sign ups</span> to launch
				</p>
			{/if}
		</section>

		<p class="mt-10 text-center font-literatura text-[12px] font-bold tracking-[0.03em] text-balance italic md:text-[max(1.2cqw,11px)]"
		>made with love by @guac, @johnny and @lou from hack club</p>
	</div>
</main>
