<script lang="ts">
	import PublicNav from '../PublicNav.svelte';
	import type { PageProps } from './$types';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
	let picked = $state<string | undefined>(undefined);
	let query = $state('');
	let needle = $derived(query.trim().toLowerCase());
	let posted = $derived(
		(form ?? null) as {
			name?: string;
			nameError?: string;
			project?: string;
			description?: string;
			repo?: string;
			demo?: string;
			hackatime?: string;
			entryError?: string;
		} | null
	);
	let current = $derived(data.submission?.hackatimeProject || data.project?.hackatimeProject || '');
	let projects = $derived.by(() => {
		const list = data.projects.filter((project) => project.name.toLowerCase().includes(needle));
		if (current && !data.projects.some((project) => project.name === current)) {
			return [{ name: current, hours: 'your project' }, ...list];
		}
		return list;
	});
	let choice = $derived(picked || posted?.hackatime || current);
	let projectName = $derived(posted?.project ?? data.submission?.projectName ?? data.project?.name ?? '');
	let story = $derived(posted?.description ?? data.submission?.description ?? data.project?.description ?? '');
	let locked = $derived(Boolean(data.submission?.locked));
</script>

<svelte:head>
	<title>your details · fjording it</title>
	<meta name="robots" content="noindex" />
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
			<PublicNav home="/hackathon" links={[{ href: '/hackathon#rules', label: 'rules' }, { href: '/hackathon/you', label: 'your challenge' }]} label={data.label} />
		</div>
	</div>
	<header class="submit-hero">
		<div class="wrap">
			<h1 class="ask">your details</h1>
			<p class="sub strip torn">change your name, your project, or what you shipped. only yours.</p>
		</div>
	</header>
	<main class="wrap formwrap">
		{#if data.notice}<p class="banner strip torn">{data.notice}</p>{/if}

		<form class="formcard paper" method="POST" action="?/name">
			{#if posted?.nameError}<p class="banner strip torn">{posted.nameError}</p>{/if}
			<div class="fields">
				<div class="f">
					<label for="nm">your name</label>
					<input id="nm" name="name" value={posted?.name ?? data.name} placeholder="what should we call you?" />
				</div>
				<div class="f full">
					<p class="lab">email</p>
					<p class="fixed">{data.email}</p>
					<p class="hint">from your Hack Club account. address, birthday, and slack stay optional and aren't asked for here.</p>
				</div>
			</div>
			<div class="ship">
				<button class="btn stampbtn inkstamp stamp" type="submit">save name</button>
			</div>
		</form>

		{#if !data.project}
			<section class="formcard paper">
				<p>you haven't set up a project yet. <a href="/hackathon/start">name one and link Hackatime</a>.</p>
			</section>
		{:else}
			<form class="formcard paper" method="POST" action="?/entry" enctype="multipart/form-data">
				{#if posted?.entryError}<p class="banner strip torn">{posted.entryError}</p>{/if}
				{#if locked}<p class="banner strip torn">{data.submission?.lockReason}</p>{/if}
				<fieldset disabled={locked}>
					<div class="fields">
						<div class="f">
							<label for="pn">project name</label>
							<input id="pn" name="project" value={projectName} required />
						</div>
						<div class="f full">
							<label for="bl">description</label>
							<textarea id="bl" name="description" required>{story}</textarea>
						</div>
						<div class="f full">
							<p class="lab" id="hk-l">
								hackatime project
								{#if data.connected}
									<em class="ok">hackatime connected ✓</em>
								{:else if data.ticket}
									<em class="ok"><a href="/auth/hackatime?ticket={data.ticket}&from=details">connect hackatime</a></em>
								{/if}
							</p>
							{#if data.connected && data.projects.length > 0}
								<input id="hk-q" class="hk-q" type="search" placeholder="filter projects" bind:value={query} />
							{/if}
							<div class="pick all" role="listbox" aria-labelledby="hk-l">
								<div class="cur"><span>{choice || 'your linked project'}</span><i>▾</i></div>
								{#each projects as project (project.name)}
									<label class="opt" class:sel={choice === project.name}>
										<input type="radio" name="hackatime" value={project.name} checked={choice === project.name} onclick={() => (picked = project.name)} />
										{project.name}{#if project.hours !== 'your project'} · {project.hours}{/if}
									</label>
								{/each}
								{#if projects.length === 0}
									<input type="hidden" name="hackatime" value={current} />
									<p class="hint">{current}</p>
								{/if}
							</div>
						</div>
						{#if data.submission}
							<div class="f">
								<label for="gh">github repo</label>
								<input id="gh" name="repo" value={posted?.repo ?? data.submission.repoUrl} required />
							</div>
							<div class="f">
								<label for="dm">playable url</label>
								<input id="dm" name="demo" value={posted?.demo ?? data.submission.demoUrl} required />
							</div>
							<div class="f full">
								<p class="lab" id="shot-l">screenshot</p>
								{#if data.submission.hasScreenshot}
									<img class="shot" src="/hackathon/details/screenshot" alt="the screenshot you shipped" />
								{/if}
								<label class="drop" for="shot">
									<input id="shot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" />
									<b>{data.submission.hasScreenshot ? 'keep this screenshot' : 'add a screenshot'}</b>
									{data.submission.hasScreenshot ? 'leave it empty to keep the one you already sent.' : 'png or jpg.'}
								</label>
							</div>
						{:else}
							<div class="f full">
								<p class="hint">repo, demo, and screenshot show up here after you <a href="/hackathon/submit">ship</a>.</p>
							</div>
						{/if}
					</div>
					<div class="ship">
						<button class="btn stampbtn inkstamp stamp" type="submit">save details</button>
						<p><a href="/hackathon/you">back to your challenge</a></p>
					</div>
				</fieldset>
			</form>
		{/if}
	</main>
</div>

<style>
	.fixed,
	.hint {
		display: block;
		position: relative;
		font-family: var(--times);
		font-size: 22px;
		line-height: 1.45;
		margin: 0;
	}

	.fixed {
		padding-bottom: 8px;
	}

	.hint {
		margin-top: 28px;
		font-size: 18px;
	}

	.hint a,
	.formcard a {
		color: inherit;
	}

	.shot {
		display: block;
		width: min(100%, 420px);
		height: auto;
		margin: 0 0 12px;
		border: 1.5px solid var(--ink);
	}

	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		min-inline-size: 0;
	}

	form + form,
	form + section,
	.formcard + .formcard {
		margin-top: 22px;
	}
</style>
