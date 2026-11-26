<script lang="ts">
	import { allHackatimeProjects } from '#lib/hackatime-projects.ts';
	import PublicNav from '../PublicNav.svelte';
	import type { PageProps } from './$types';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
	let picked = $state<string | undefined>(undefined);
	let query = $state('');
	let needle = $derived(query.trim().toLowerCase());
	let projects = $derived(
		allHackatimeProjects(data.projects).filter((project) => project.name.toLowerCase().includes(needle))
	);
	let choice = $derived(picked || form?.hackatime || projects[0]?.name || '');
</script>

<svelte:head>
	<title>start · fjording it</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="hackathon submit-page">
	<div class="topbar torn-bottom">
		<div class="wrap">
			<PublicNav home="/hackathon" links={[{ href: '/hackathon#rules', label: 'rules' }]} label={data.label} />
		</div>
	</div>
	<header class="submit-hero">
		<div class="wrap">
			<h1>name your project</h1>
			<p class="sub strip torn">one project, linked to Hackatime. you can do this later.</p>
		</div>
	</header>
	<main class="wrap formwrap">
		<form class="formcard paper" method="POST">
			{#if form?.error}<p class="banner strip torn">{form.error}</p>{/if}
			<div class="fields">
				<div class="f">
					<label for="pn">project name</label>
					<input id="pn" name="project" value={form?.project ?? ''} required placeholder="goose tracker" />
				</div>
				<div class="f full">
					<label for="bl">short description</label>
					<textarea id="bl" name="description" required placeholder="what are you making?">{form?.description ?? ''}</textarea>
				</div>
				<div class="f full">
					<p class="lab" id="hk-l">
						hackatime project
						{#if data.projectsFailed}
							<em>couldn't load projects</em>
						{:else if !data.connected && data.ticket}
							<em class="ok"><a href="/auth/hackatime?ticket={data.ticket}&from=start">connect hackatime</a></em>
						{:else if data.connected}
							<em class="ok">hackatime connected ✓</em>
							{#if data.projects.length === 0 && data.ticket}
								<em class="ok"><a href="/auth/hackatime?ticket={data.ticket}&from=start">reconnect hackatime</a></em>
							{/if}
						{:else}
							<em>Hackatime not connected yet</em>
						{/if}
					</p>
					{#if data.connected && data.projects.length > 0}
						<label class="hk-search" for="hk-q">filter projects</label>
						<input id="hk-q" class="hk-q" type="search" placeholder="filter projects" bind:value={query} />
					{/if}
					<div class="pick all" role="listbox" aria-labelledby="hk-l">
						<div class="cur">
							<span>{choice || (data.connected ? 'no hackatime projects yet' : 'connect hackatime to choose a project')}</span>
							<i>▾</i>
						</div>
						{#each projects as project (project.name)}
							<label class="opt" class:sel={choice === project.name}>
								<input type="radio" name="hackatime" value={project.name} checked={choice === project.name} required onclick={() => (picked = project.name)} />
								{project.name} · {project.hours}
							</label>
						{/each}
					</div>
				</div>
			</div>
			<div class="ship">
				<button class="btn stampbtn inkstamp stamp" type="submit">save project</button>
				<p><a href="/hackathon">do this later</a></p>
			</div>
		</form>
	</main>
</div>
