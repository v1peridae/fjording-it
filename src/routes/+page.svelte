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

<main class="relative flex min-h-dvh justify-center overflow-x-clip px-3 py-6 md:px-6 md:py-8">
	<div class="stage relative w-full md:w-[min(1000px,100%)]">
	<a class="ferry paper" href="/hackathon?from=/">
		<img
			src="/tromso-aurora.webp"
			alt="northern lights over Tromsø, Norway"
			width="1800"
			height="1198"
		/>
		<span class="font-times">The Northern Challenge</span>
		<span class="font-pirate-3d">Win a $300 flight stipend NOW</span>
	</a>
	<div
		class="@container relative isolate flex w-full flex-col items-center px-5 py-14 before:absolute before:inset-y-0 before:inset-x-[1.1%] before:-z-1 before:opacity-90 before:paper md:p-8"
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
	</div>
</main>

<style>
	.ferry {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: min(86%, 280px);
		margin: 0 auto 10px;
		padding: 22px 16px 26px;
		color: #07160a;
		text-decoration: none;
		transform: rotate(-3deg);
	}

	.ferry img {
		width: 100%;
		height: 128px;
		object-fit: cover;
		object-position: center 40%;
	}

	.ferry .font-times {
		font-size: 16px;
		line-height: 1.15;
	}

	.ferry .font-pirate-3d {
		font-size: 28px;
		line-height: 1.05;
	}

	@media (min-width: 51.3125rem) {
		.ferry {
			position: absolute;
			width: 230px;
			margin: 0;
			top: 28px;
			right: calc(100% + 48px);
			transform: rotate(-8deg);
			transform-origin: right center;
		}

		.ferry img {
			height: 150px;
		}
	}
</style>
