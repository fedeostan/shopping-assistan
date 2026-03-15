# Fix #16: Chat disappears after sending a message

## Context

After sending a message, the chat content scrolls far off-viewport — users must scroll extensively to find it. The root cause is a **broken CSS height chain**: no ancestor has a definite height, so `flex-1` elements grow unbounded instead of constraining to the viewport, and the Thread viewport's `overflow-y-scroll` never activates.

**Height chain (current — broken):**
```
html          → no height
body          → no height, no overflow constraint
SidebarProvider wrapper → min-h-svh (minimum, can grow beyond viewport)
SidebarInset  → flex-1 (grows with content since parent has no definite height)
div           → flex-1 overflow-hidden (should constrain, but parent is unbounded)
Thread Root   → h-full (inherits unbounded height)
Viewport      → flex-1 overflow-y-scroll (scroll never activates — keeps growing)
```

## Fix (2 files, 2 lines changed)

### 1. `src/app/globals.css` (line 124)

Lock the body to viewport height:

```css
/* Before */
body {
  @apply bg-background text-foreground;
}

/* After */
body {
  @apply bg-background text-foreground h-svh overflow-hidden;
}
```

### 2. `src/components/ui/sidebar.tsx` (line 142)

Change SidebarProvider wrapper from minimum height to fixed height:

```tsx
// Before
"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full"

// After
"group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex h-svh w-full"
```

**Height chain (fixed):**
```
body          → h-svh overflow-hidden (locked to viewport)
wrapper       → h-svh (definite height)
SidebarInset  → flex-1 stretches to wrapper height (100svh)
div           → flex-1 overflow-hidden (gets remaining space: 100svh - 40px header)
Thread Root   → h-full (fills parent)
Viewport      → flex-1 overflow-y-scroll (NOW SCROLLS — parent has definite height)
```

## Why this is safe

- `h-svh` uses Small Viewport Height — works correctly with mobile browser chrome
- `overflow-hidden` on body won't affect modals/tooltips (they use `position: fixed` via portals)
- On mobile, Sidebar uses `position: fixed` overlay — not affected by wrapper height change
- The `div.flex-1.overflow-hidden` in page.tsx already has `overflow-hidden`, which per CSS spec sets flex item min-height to 0 (allows proper shrinking)

## Verification

1. `npm run build` — ensure no build errors
2. `npm run dev` — open in browser
3. Test: Send a message → chat should remain visible, viewport scrolls internally
4. Test: Send multiple messages → composer stays at bottom, messages scroll
5. Test: Resize browser window → layout adapts correctly
6. Test: Toggle sidebar open/closed → no layout breakage
7. Test: Mobile viewport (DevTools) → sidebar overlay still works
