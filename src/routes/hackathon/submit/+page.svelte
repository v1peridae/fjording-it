<script lang="ts">
	import { arrangeHackatimeProjects } from '#lib/hackatime-projects.ts';
	import { displayName } from '#lib/participant-identity.ts';
	import type { PageProps } from './$types';
	import PublicNav from '../PublicNav.svelte';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
	let picked = $state<string | undefined>(undefined);
	let shot = $state('');
	let query = $state('');

	const links = [
		{ href: '/hackathon#prizes', label: 'prizes' },
		{ href: '/hackathon#rules', label: 'rules' }
	];
	let arranged = $derived(arrangeHackatimeProjects(data.projects));
	let needle = $derived(query.trim().toLowerCase());
	let eligible = $derived(arranged.eligible.filter((project) => project.name.toLowerCase().includes(needle)));
	let later = $derived(arranged.later.filter((project) => project.name.toLowerCase().includes(needle)));
	let choice = $derived.by(() => {
		if (picked) return picked;
		if (form?.hackatime) return form.hackatime;
		return arranged.eligible[0]?.name ?? '';
	});
	let chosen = $derived(data.projects.find((project) => project.name === choice));
	let shipAs = $derived(displayName(data.participant?.name) ?? data.participant?.email ?? null);

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
					ship any software project, at least 5 hours long, with a playable url and a github link. opens fri nov 27,
					12:00am ET. closes sun dec 6, 11:59pm ET.
				</p>
			</div>
		</div>
	</header>

	<main class="wrap formwrap">
		<form class="formcard paper" method="POST" enctype="multipart/form-data">
			{#if data.phase === 'early'}
				<p class="banner strip torn">submissions open Nov 27</p>
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
			{#if !data.participant}
				<p class="sub">sign in with hack club, then connect hackatime and pick a project.</p>
				<p class="ship"><a class="btn stampbtn inkstamp stamp" href="/hackathon/auth/login">sign in</a></p>
			{:else}
			{#if data.needsDemographics}
				<p class="banner strip torn">
					we need your birthday and address from hack club before this can ship.
					<a href="/hackathon/auth/login?reauth=1">sign in again</a>
				</p>
			{/if}
			<fieldset disabled={!data.allowed || data.needsDemographics}>
				<div class="fields">
					<div class="f">
						<label for="pn">project name</label>
						<input id="pn" name="project" value={form?.project ?? ''} placeholder="goose tracker 3000" required />
					</div>
					<div class="f">
						<p class="lab" id="hk-l">
							hackatime project
							{#if !data.configured}
								<em>Hackatime not connected yet</em>
							{:else if data.projectsFailed}
								<em>couldn't load projects</em>
							{:else if !data.connected && data.ticket}
								<em class="ok"><a href="/auth/hackatime?ticket={data.ticket}">connect hackatime</a></em>
							{:else if !data.connected}
								<em>Hackatime not connected yet</em>
							{:else}
								<em class="ok">hackatime connected ✓</em>
							{/if}
							{#if !data.relaxHours}<em class="min">5h minimum</em>{/if}
						</p>
						{#if data.connected && data.projects.length > 0}
							<label class="hk-search" for="hk-q">filter projects</label>
							<input id="hk-q" class="hk-q" type="search" placeholder="filter projects" bind:value={query} />
						{/if}
						<div class="pick" role="listbox" aria-labelledby="hk-l">
							<div class="cur">
								<span>
									{#if chosen}
										{chosen.name} · {chosen.hours}
									{:else if !data.configured}
										Hackatime not connected yet
									{:else if !data.connected}
										connect hackatime to choose a project
									{:else if eligible.length === 0 && later.length === 0}
										no hackatime projects yet
									{:else}
										choose a project
									{/if}
								</span>
								<i>▾</i>
							</div>
							{#each eligible as project (project.name)}
								<label class="opt" class:sel={choice === project.name}>
									<input
										type="radio"
										name="hackatime"
										value={project.name}
										checked={choice === project.name}
										required
										onclick={() => (picked = project.name)}
									/>
									{project.name} · {project.hours}
									{#if choice === project.name}<i>✓</i>{/if}
								</label>
							{/each}
							{#if later.length > 0}
								<details class="later">
									<summary>not eligible yet ({later.length})</summary>
									{#each later as project (project.name)}
										<label class="opt off">
											<input type="radio" name="hackatime" value={project.name} disabled />
											<s>{project.name} · {project.hours}</s>
											<b class="ne">under 5h, not eligible yet</b>
										</label>
									{/each}
								</details>
							{/if}
						</div>
					</div>
					<div class="f">
						<label for="gh">github repo <em class="req">required</em></label>
						<input id="gh" name="repo" value={form?.repo ?? ''} required placeholder="github.com/you/goose" />
					</div>
					<div class="f">
						<label for="dm">playable url <em class="req">required</em></label>
						<input
							id="dm"
							name="demo"
							type="url"
							value={form?.demo ?? ''}
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
							required>{form?.description ?? ''}</textarea
						>
					</div>
				</div>
				<div class="ship">
					<button class="btn stampbtn inkstamp stamp" type="submit" disabled={!data.allowed || data.needsDemographics}>ship it</button>
					<p>
						{#if !data.allowed && data.phase === 'closed'}
							that's a wrap
						{:else if !data.allowed}
							opens nov 27
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
