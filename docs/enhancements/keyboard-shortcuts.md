# Keyboard Shortcuts

Global keyboard shortcuts for the eCraft Zap web app. Shortcut definitions live in one registry so the in-app guide, command palette, and listeners stay in sync.

## Shortcut reference

| Shortcut | Action | Category |
|---|---|---|
| `Cmd/Ctrl + K` | Open command palette (search & jump to any page) | Navigation |
| `Cmd/Ctrl + B` | Toggle sidebar (desktop only) | Shell |
| `Shift + ?` or `Shift + /` | Open keyboard shortcuts guide | Help |
| `Esc` | Close open dialog (palette, guide, modals) | General |

**Note:** Global shortcuts do not fire while focus is in an `input`, `textarea`, `select`, or `[contenteditable]` field.

## In-app entry points

- **Command palette:** `Cmd/Ctrl + K`
- **Shortcuts guide:** `Shift + ?` (or `Shift + /`), or the keyboard icon in the top header
- **Sidebar toggle:** `Cmd/Ctrl + B` (desktop) or the panel icon in the header

## Architecture

```
nav-groups.ts          keyboard-shortcuts.ts
     │                          │
     ├─ flattenNavItems ────────┤──► CommandPalette
     └─ filterNavSections       │
                                ├──► KeyboardShortcutsGuide
                                └──► GlobalKeyboardShortcuts
                                          │
                                     useKeyboardShortcuts
                                          │
                                     ShellUiProvider (state)
```

### Key files

| File | Purpose |
|---|---|
| [`src/lib/keyboard-shortcuts.ts`](../src/lib/keyboard-shortcuts.ts) | Registry, formatting, nav flattening, input guard |
| [`src/hooks/use-keyboard-shortcuts.ts`](../src/hooks/use-keyboard-shortcuts.ts) | Document-level shortcut listener |
| [`src/contexts/shell-ui-context.tsx`](../src/contexts/shell-ui-context.tsx) | Sidebar, palette, and guide open state |
| [`src/components/layout/command-palette.tsx`](../src/components/layout/command-palette.tsx) | Searchable page jumper |
| [`src/components/layout/keyboard-shortcuts-guide.tsx`](../src/components/layout/keyboard-shortcuts-guide.tsx) | In-app shortcut reference dialog |
| [`src/components/layout/global-keyboard-shortcuts.tsx`](../src/components/layout/global-keyboard-shortcuts.tsx) | Wires registry shortcuts to shell actions |

## Adding a new global shortcut

1. Add a `ShortcutDefinition` to `GLOBAL_SHORTCUTS` in [`keyboard-shortcuts.ts`](../src/lib/keyboard-shortcuts.ts).
2. Register the handler in [`global-keyboard-shortcuts.tsx`](../src/components/layout/global-keyboard-shortcuts.tsx) via `useKeyboardShortcuts`.
3. The guide dialog reads from `GLOBAL_SHORTCUTS` automatically — no separate UI update needed unless you want custom copy.

Example:

```ts
// keyboard-shortcuts.ts
{
  id: "go-home",
  label: "Go to dashboard",
  category: "navigation",
  keys: { key: "h", metaOrCtrl: true, shift: true },
}

// global-keyboard-shortcuts.tsx
{
  keys: { key: "h", metaOrCtrl: true, shift: true },
  handler: () => router.push("/"),
},
```

## Command palette pages

Palette rows are built from [`nav-groups.ts`](../src/lib/nav-groups.ts):

- Each `NavItem` becomes a searchable row with group, section, label, icon, and href.
- `adminOnly` items are filtered using the signed-in user's admin status (same as the sidebar).

Adding a page to the sidebar automatically adds it to the command palette.

## Testing

Unit tests: [`tests/unit/keyboard-shortcuts.test.ts`](../tests/unit/keyboard-shortcuts.test.ts)

```bash
cd web && npm run test -- tests/unit/keyboard-shortcuts.test.ts
```

Manual smoke checklist:

1. `Cmd/Ctrl + K` opens palette; typing "Bins" and pressing Enter navigates to `/bins`.
2. `Cmd/Ctrl + B` toggles sidebar on desktop.
3. `Shift + ?` opens the shortcuts guide.
4. Typing in a form field does not trigger global shortcuts.
5. Admin-only pages appear in palette only for admin users.

## Future enhancements (out of scope for v1)

- Page-specific shortcuts (GRN save, table navigation)
- User-customizable bindings
- Shortcut hints on sidebar links
