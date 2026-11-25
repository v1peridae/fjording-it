<script lang="ts">
	import type { PageProps } from './$types';
	import '../hackathon.css';

	let { data, form }: PageProps = $props();
	let picked = $state<string | undefined>(undefined);
	let shot = $state('');

	let choice = $derived.by(() => {
		if (picked) return picked;
		if (form?.hackatime) return form.hackatime;
		return data.projects.find((project) => project.eligible)?.name ?? '';
	});
	let chosen = $derived(data.projects.find((project) => project.name === choice));
	let shipAs = $derived(tagHandle(data.github) ?? data.handle);

	function tagHandle(value: string | null): string | null {
		if (!value) return null;
		const handle = value.startsWith('@') ? value : `@${value}`;
		return /^@[A-Za-z0-9._-]{1,31}$/.test(handle) ? handle : null;
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
			<nav>
				<a class="mini" href="/hackathon">fjording it</a>
				<div class="right">
					<ul>
						<li><a href="/hackathon#prizes">prizes</a></li>
						<li><a href="/hackathon#rules">rules</a></li>
					</ul>
					{#if shipAs}
						<span class="tagwrap">
							<img class="string" src="/hackathon/tag-string.svg" alt="" />
							<span class="tag"><span class="t">signed in as</span><b>{shipAs}</b></span>
						</span>
					{/if}
				</div>
			</nav>
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
					ship any software project, at least 5 hours long, with a playable url and a github link. closes sun dec 6,
					11:59pm ET.
				</p>
			</div>
		</div>
	</header>

	<main class="wrap formwrap">
		<form class="formcard paper" method="POST" enctype="multipart/form-data">
			{#if data.shipped}
				<p class="banner strip torn">shipped.</p>
			{/if}
			{#if form?.error || data.notice}
				<p class="banner strip torn">{form?.error ?? data.notice}</p>
			{/if}
			<div class="formhead">
				<h2>your project</h2>
				{#if shipAs}
					<span class="tagwrap ontag">
						<img class="string" src="/hackathon/tag-string.svg" alt="" />
						<span class="tag"><span class="t">shipping as</span><b>{shipAs}</b></span>
					</span>
				{/if}
			</div>
			<fieldset disabled={!data.allowed}>
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
							<em class="min">5h minimum</em>
						</p>
						<div class="pick" role="listbox" aria-labelledby="hk-l">
							<div class="cur">
								<span>
									{#if chosen}
										{chosen.name} · {chosen.hours}
									{:else if !data.configured}
										Hackatime not connected yet
									{:else if !data.connected}
										connect hackatime to choose a project
									{:else if data.projects.length === 0}
										no hackatime projects yet
									{:else}
										choose a project
									{/if}
								</span>
								<i>▾</i>
							</div>
							{#each data.projects as project (project.name)}
								<label class="opt" class:sel={choice === project.name} class:off={!project.eligible}>
									<input
										type="radio"
										name="hackatime"
										value={project.name}
										checked={choice === project.name}
										disabled={!project.eligible}
										required={project.eligible}
										onclick={() => (picked = project.name)}
									/>
									{#if project.eligible}
										{project.name} · {project.hours}
										{#if choice === project.name}<i>✓</i>{/if}
									{:else}
										<s>{project.name} · {project.hours}</s>
										<b class="ne">under 5h, not eligible yet</b>
									{/if}
								</label>
							{/each}
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
					<button class="btn stampbtn inkstamp stamp" type="submit" disabled={!data.allowed}>ship it</button>
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
		</form>
	</main>
	<div class="foot-space" aria-hidden="true"></div>
</div>
