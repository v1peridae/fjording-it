<script lang="ts">
	import { displayName } from '#lib/participant-identity.ts';
	import type { PageProps } from './$types';
	import PublicNav from '../PublicNav.svelte';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
	let shot = $state('');

	const links = [
		{ href: '/hackathon#prizes', label: 'prizes' },
		{ href: '/hackathon#rules', label: 'rules' }
	];
	let shipAs = $derived(displayName(data.participant?.name) ?? data.participant?.email ?? null);
	let draftTimer: ReturnType<typeof setTimeout> | undefined;

	function kept(posted: string | undefined, saved: string | undefined) {
		return posted ?? saved ?? '';
	}

	function sendDraft(form: HTMLFormElement) {
		const body = new FormData(form);
		body.delete('screenshot');
		fetch('?/draft', { method: 'POST', body });
	}

	function keepDraft(event: Event) {
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement) || !data.participant) return;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => sendDraft(form), 400);
	}

	function flushDraft(event: Event) {
		const form = event.currentTarget;
		if (!(form instanceof HTMLFormElement) || !data.participant) return;
		clearTimeout(draftTimer);
		sendDraft(form);
	}

	function onfile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		shot = input.files?.[0]?.name ?? '';
	}

	function ondrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		const target = event.currentTarget;
		const input = target instanceof HTMLElement ? target.querySelector('input') : null;
		if (!file || !(input instanceof HTMLInputElement)) return;
		const list = new DataTransfer();
		list.items.add(file);
		input.files = list.files;
		shot = file.name;
	}
</script>

<svelte:head>
	<title>submit · fjording it: The Northern Challenge</title>
	<meta name="robots" content="noindex, nofollow" />
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
			<PublicNav home="/hackathon" {links} label={shipAs} />
		</div>
	</div>

	<header class="submit-hero">
		<div class="wrap">
			<div class="geese" aria-hidden="true">
				<img class="g1" src="/hackathon/goose-1.png" alt="" />
				<img class="g2" src="/hackathon/goose-2.png" alt="" />
				<img class="g3" src="/hackathon/goose-3.png" alt="" />
			</div>
			<div><a class="back strip torn" href="/hackathon">← back to the hackathon</a></div>
			<h1>ship your project</h1>
			<div>
				<p class="sub strip torn">
					ship any software project, at least 5 hours long, with a playable url and a github link. Nov 27 to Dec 6.
					closes Sun Dec 6 at 11:59pm ET.
				</p>
			</div>
		</div>
	</header>

	<main class="wrap formwrap">
		<form class="formcard paper" method="POST" enctype="multipart/form-data" oninput={keepDraft} onchange={keepDraft} onfocusout={flushDraft}>
			{#if data.phase === 'early'}
				<p class="banner strip torn">Nov 27 to Dec 6 <span class="close">closes Sun Dec 6 at 11:59pm ET</span></p>
			{/if}
			{#if data.shipped}
				<p class="banner strip torn">shipped.</p>
			{/if}
			{#if form?.error || data.notice}
				<p class="banner strip torn">{form?.error ?? data.notice}</p>
			{/if}
			<div class="formhead">
				<h2>{data.participant ? 'your project' : 'sign in'}</h2>
			</div>
			{#if data.tracker}
				<p class="tracker">
					{#if data.tracker.unknown}
						couldn't check Hackatime hours yet
					{:else}
						{data.tracker.hours} of 5h{data.tracker.eligible ? ' · eligible' : ''}
					{/if}
				</p>
			{/if}
			{#if !data.participant}
				<p class="sub">sign in with hack club, then connect hackatime and pick a project.</p>
				<p class="ship"><a class="btn stampbtn inkstamp stamp" href="/hackathon/auth/login?from=/hackathon/submit">sign in</a></p>
			{:else}
			<fieldset disabled={!data.allowed}>
				<div class="fields">
					<div class="f">
						<label for="pn">project name</label>
						<input id="pn" name="project" value={kept(form?.project, data.draft?.project)} placeholder="goose tracker 3000" required />
					</div>
					<div class="f">
						<p class="lab" id="hk-l">fjording project</p>
						{#if !data.owned}
							<p><a href="/hackathon/start">create a project and link Hackatime</a></p>
						{:else}
							<div class="pick" role="listbox" aria-labelledby="hk-l">
								<label class="opt sel">
									<input type="radio" name="hackatime" value={data.owned.hackatimeProject} checked required />
									{data.owned.name} · {data.owned.hackatimeProject}
								</label>
							</div>
						{/if}
					</div>
					<div class="f">
						<label for="gh">github repo <em class="req">required</em></label>
						<input id="gh" name="repo" value={kept(form?.repo, data.draft?.repo)} required placeholder="github.com/you/goose" />
					</div>
					<div class="f">
						<label for="dm">playable url <em class="req">required</em></label>
						<input
							id="dm"
							name="demo"
							type="url"
							value={kept(form?.demo, data.draft?.demo)}
							required
							placeholder="goose.you.dev"
						/>
					</div>
					<div class="f full">
						<label for="shot">screenshot</label>
						<label
							class="drop"
							ondragover={(event) => event.preventDefault()}
							ondrop={ondrop}
						>
							<input id="shot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" onchange={onfile} />
							<b>drop a screenshot here</b>
							{shot || 'or tap to pick one. png or jpg.'}
						</label>
					</div>
					<div class="f full">
						<label for="bl">what did you build and learn?</label>
						<textarea
							id="bl"
							name="description"
							placeholder="tell us what it does, what broke, and what you figured out."
							required>{kept(form?.description, data.draft?.description)}</textarea
						>
					</div>
				</div>
				<div class="ship">
					<button class="btn stampbtn inkstamp stamp" type="submit" disabled={!data.allowed}>ship it</button>
					<p>
						{#if !data.allowed && data.phase === 'closed'}
							that's a wrap
						{:else if !data.allowed}
							Nov 27 to Dec 6
						{:else}
							double-check both links work before you ship.
						{/if}
					</p>
				</div>
			</fieldset>
			{/if}
		</form>
	</main>
	<div class="foot-space" aria-hidden="true"></div>
</div>
