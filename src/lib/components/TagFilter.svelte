<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Tag as TagIcon, Check, ChevronDown, ChevronRight, Rows3, Paintbrush, Pencil, Settings2 } from 'lucide-svelte';
	import { TogglePill } from '$lib/components/ui/toggle-pill';
	import TagLucideIcon from '$lib/components/TagLucideIcon.svelte';
	import { tagHex } from '$lib/utils/tags-core';
	import { ToggleSwitch } from '$lib/components/ui/toggle-pill';
	import type { Tag, TagFilterMode } from '$lib/utils/tags-core';

	interface Props {
		tags: Tag[];              // catalog to choose from
		selected: number[];       // selected tag ids (bindable)
		mode: TagFilterMode;      // 'all' | 'any' (bindable)
		groupBy?: boolean;        // 'group rows by tag' toggle (bindable); omit to hide it
		showTags?: boolean;       // 'show tag chips on rows' toggle (bindable); omit to hide it
		showBands?: boolean;      // 'coloured group bands' toggle (bindable); shown only while groupBy is on
		inlineEditing?: boolean;  // 'show a tag button on each row' toggle (bindable); omit to hide it
		settingsExpanded?: boolean; // collapsed state of the settings section (bindable)
		width?: string;
	}
	let { tags, selected = $bindable([]), mode = $bindable('all'), groupBy = $bindable(undefined), showTags = $bindable(undefined), showBands = $bindable(undefined), inlineEditing = $bindable(undefined), settingsExpanded = $bindable(true), width = 'w-44' }: Props = $props();

	// Whether any of the settings toggles are present, so the section only renders when it has content.
	const hasSettings = $derived(groupBy !== undefined || showTags !== undefined || inlineEditing !== undefined);

	let open = $state(false);

	function toggle(id: number) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}
	const label = $derived(
		selected.length === 0 ? 'All tags' : selected.length === 1 ? (tags.find((t) => t.id === selected[0])?.name ?? '1 tag') : `${selected.length} tags`
	);
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="sm" class="{width} justify-between font-normal">
				<span class="flex items-center gap-1.5 truncate">
					<TagIcon class="h-3.5 w-3.5 text-muted-foreground" />
					<span class="truncate {selected.length === 0 ? 'text-muted-foreground' : ''}">{label}</span>
				</span>
				<ChevronDown class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-60 p-1" align="start">
		{#if hasSettings}
			<!-- Collapsible settings section, open by default. The header toggles it; the
			     state is persisted by the parent page (localStorage). -->
			<button
				type="button"
				class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
				onclick={() => (settingsExpanded = !settingsExpanded)}
			>
				<Settings2 class="h-3.5 w-3.5 shrink-0" />
				<span class="text-xs flex-1 text-left">Settings</span>
				{#if settingsExpanded}
					<ChevronDown class="h-3.5 w-3.5 shrink-0" />
				{:else}
					<ChevronRight class="h-3.5 w-3.5 shrink-0" />
				{/if}
			</button>
			{#if settingsExpanded}
				{#if groupBy !== undefined}
					<div class="flex items-center gap-2 px-2 py-1.5">
						<Rows3 class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span class="text-xs flex-1">Group by tag</span>
						<TogglePill bind:checked={groupBy} />
					</div>
					{#if showBands !== undefined && groupBy}
						<!-- Only meaningful while grouping is on. Same padding as the other rows so
						     the icon column lines up on the left and the toggle on the right. -->
						<div class="flex items-center gap-2 px-2 py-1.5">
							<Paintbrush class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span class="text-xs flex-1 whitespace-nowrap">Color group bands</span>
							<TogglePill bind:checked={showBands} />
						</div>
					{/if}
				{/if}
				{#if showTags !== undefined}
					<div class="flex items-center gap-2 px-2 py-1.5">
						<TagIcon class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span class="text-xs flex-1">Show tags</span>
						<TogglePill bind:checked={showTags} />
					</div>
				{/if}
				{#if inlineEditing !== undefined}
					<div class="flex items-center gap-2 px-2 py-1.5">
						<Pencil class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span class="text-xs flex-1 whitespace-nowrap">Inline tag editing</span>
						<TogglePill bind:checked={inlineEditing} />
					</div>
				{/if}
			{/if}
			<div class="my-1 h-px bg-border"></div>
		{/if}
		{#if tags.length === 0}
			<div class="px-2 py-3 text-center text-xs text-muted-foreground">No tags yet</div>
		{:else}
			<!-- ANY / ALL match mode (same pill as the dashboard env label filter) -->
			<div class="flex items-center gap-2 px-1 pb-1">
				<span class="text-2xs text-muted-foreground mr-auto">Match</span>
				<ToggleSwitch value={mode} leftValue="any" rightValue="all" onchange={(m) => (mode = m as TagFilterMode)} />
			</div>
			<div class="max-h-64 overflow-y-auto">
				{#each tags as tag (tag.id)}
					{@const isSel = selected.includes(tag.id)}
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
						onclick={() => toggle(tag.id)}
					>
						{#if tag.icon}
							<TagLucideIcon name={tag.icon} class="h-3.5 w-3.5 shrink-0" style="color: {tagHex(tag.color)};" />
						{:else}
							<TagIcon class="h-3.5 w-3.5 shrink-0" style="color: {tagHex(tag.color)};" />
						{/if}
						<span class="truncate">{tag.name}</span>
						{#if isSel}<Check class="ml-auto h-3.5 w-3.5 text-primary shrink-0" />{/if}
					</button>
				{/each}
			</div>
			{#if selected.length > 0}
				<button type="button" class="mt-1 w-full rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted" onclick={() => (selected = [])}>
					Clear
				</button>
			{/if}
		{/if}
	</Popover.Content>
</Popover.Root>
