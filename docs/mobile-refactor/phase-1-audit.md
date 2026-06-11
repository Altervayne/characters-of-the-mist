# Mobile Refactor — Phase 1 Audit

**Project:** Characters of the Mist
**Scope:** `src/components/mobile/` (recursively)
**Type:** Study / planning session — no code written
**Date:** 2026-06-11
**Status:** Decision-complete. Ready to begin Phase 2.

---

## Headline finding

**The "mobile reuses shared hooks/utils" assumption is FALSE for the stateful screens.**

The toolbelt, breadcrumbs, card previews-in-drawer, and the pure presentational sheets correctly consume shared code. But the **drawer, the menu, and the character sheet carry substantial inline reimplementations of logic that already lives in shared hooks/utils — and several have drifted behaviourally** (different toast keys, and most seriously **mobile exports produce completely different filenames than desktop**).

This is a real consolidation sub-project, not pure decomposition. Because it changes mobile behaviour, the consolidation work is gated into its own phases.

---

## Locked decisions (owner)

> Governing rule: **"Harmonize mobile with the general app."** Read as *align to the shared/desktop behaviour, don't preserve mobile's divergence.* This simplifies the consolidation phases — mobile consumes the shared code directly rather than parameterising it to keep divergent behaviour.

1. **Exports → align to desktop.** Replace mobile's ad-hoc `` `${name}.cotm` `` filenames (`MobileDrawerContextMenu.handleExport`, for both items and folders) with the shared `deriveExportHandle` + `generateExportFilename` pipeline. After this, a given item exports under the same `Handle_Game_Type_Date.cotm` filename on mobile and desktop. (Same wiring Phase 7 applied to `DrawerItemEntry`/`DrawerFolderEntry`.)
2. **Item icons → adopt shared.** Delete `MobileDrawerItem.getItemIcon` (the `User/Layers/Users/Package/…` set) in favour of `getItemTypeIcon` from `lib/utils/drawer-icons.tsx`. Mobile drawer rows then match the desktop drawer icons.
3. **All other Bucket 2 drift → align to shared.** Toast keys switch to the shared keys; navigation / CRUD / file-import / drawer→sheet import / save-to-drawer consolidate onto `useDrawerNavigation`, `useDrawerActionState`, `useDrawerFileImport`, and `useCharacterSheetDnD`'s mechanics; both mobile card renderers route through `resolveCardComponent` (which also resolves the City-LOADOUT inconsistency, since the shared resolver becomes the single source of truth).

**One nuance deferred to implementation:** `MobileMenu` has separate "Import (character)" and "Import drawer" buttons; its character-import handler currently accepts **only** `FULL_CHARACTER_SHEET`. The shared `useCharacterSheetFileImport` also routes loose cards/trackers. Harmonising filenames/toasts/mechanics is fine, but silently widening that *button's* accepted file types is a UX-scope change, not a consistency fix — to be confirmed at Phase 6 rather than auto-widened.

---

## Task 1 — Inventory

Current organisation: **flat dump** in `src/components/mobile/` (27 files at root) plus two existing domain subfolders — `onboarding/` (6) and `tutorial/` (3). **No atomic split, no character-sheet/drawer domain grouping.**

| File | Lines | What it is |
|---|---|---|
| `MobileCharacterSheetPage.tsx` | 305 | **Top-level mobile shell.** Tab router (sheet/drawer/menu/settings/about/patchNotes/addCard) with browser-history back-button nav; owns card-creation + drawer→character import dispatch. |
| `MobileCharacterSheet.tsx` | 985 | **Monolith.** The sheet: trackers section, card carousel + nav bar, card-reorder view, tracker-reorder controls, swipe gestures, save-to-drawer, card-title + card-preview rendering, toolbelt wiring. |
| `MobileCardCarousel.tsx` | 86 | Renders the current card; inline card-type→component routing. |
| `MobileToolbelt.tsx` | 63 | Thin shell: calls `useToolbeltActions`, renders side-panel or FAB. |
| `ToolbeltSidePanel.tsx` | 162 | Presentational slide-in action list (consumes `ToolbeltAction[]`). |
| `ToolbeltFAB.tsx` | 256 | Mobile-only thumb-zone-scaled FAB action ring (viewport math). |
| `SelectableTracker.tsx` | 112 | Long-press-to-select wrapper around a tracker (haptics). |
| `MobileDrawer.tsx` | 266 | **Drawer shell.** Folder/item list, navigation, file import, add-folder, view toggle. |
| `MobileDrawerItem.tsx` | 183 | Drawer item row (compact icon row / rich `DrawerItemPreview`); long-press. |
| `MobileFolderItem.tsx` | 117 | Drawer folder row; tap-navigate + long-press. |
| `MobileBreadcrumbs.tsx` | 86 | Horizontal breadcrumb trail (auto-scroll). |
| `MobileDrawerContextMenu.tsx` | 385 | **Monolith.** Long-press context menu + inline rename/delete bottom sheets; rename/move/delete/export/add-to-character. |
| `MobileFolderPicker.tsx` | 204 | Bottom-sheet folder navigator for "move to" (excludes self/descendants). |
| `MobileAddFolderSheet.tsx` | 113 | Bottom sheet: new-folder name input. |
| `MobileSaveToDrawerSheet.tsx` | 114 | Bottom sheet: save-item name input. |
| `MobileAddCard.tsx` | 350 | **Card-creation form** (parallel to `CreateCardDialog`). |
| `MobileMenu.tsx` | 269 | App menu (settings/about/save/export/import/unload) + import/export handlers. |
| `MobileMainMenu.tsx` | 198 | No-character landing: game selection + create; inline `GameCard`. |
| `MobileSettings.tsx` | 435 | **Monolith.** Settings screen (parallel to `SettingsDialog`) + inline `ConfirmationDialog`. |
| `MobileAbout.tsx` | 128 | Info screen (parallel to `InfoDialog`); tabs via `MarkdownContent`. |
| `MobilePatchNotes.tsx` | 116 | Patch-notes screen (parallel to `PatchNotesDialog`). |
| `MobileBottomTabs.tsx` | 94 | Bottom tab bar (sheet/drawer/menu + edit toggle). |
| `MobileFAB.tsx` | 183 | Expanding nav FAB (alternative to bottom tabs). |
| `onboarding/MobileOnboarding.tsx` | 157 | Onboarding flow orchestrator (5 steps, slide transitions). |
| `onboarding/OnboardingWelcome.tsx` | 57 | Mobile-only onboarding step. |
| `onboarding/OnboardingLanguage.tsx` | 101 | Mobile-only onboarding step (writes shared settings). |
| `onboarding/OnboardingAppearance.tsx` | 146 | Mobile-only onboarding step (writes shared settings). |
| `onboarding/OnboardingInterface.tsx` | 159 | Mobile-only onboarding step (writes shared settings). |
| `onboarding/OnboardingReady.tsx` | 77 | Mobile-only onboarding step. |
| `tutorial/MobileTutorial.tsx` | 148 | Mobile coach-mark tutorial driver (uses `lib/mobile-tutorial-steps`). |
| `tutorial/TutorialOverlay.tsx` | 109 | Spotlight overlay around a target rect. |
| `tutorial/TutorialTooltip.tsx` | 202 | Positioned tutorial tooltip (viewport-aware). |

**Total:** 31 files, ~6366 lines.

---

## Task 2 — Shared-logic verification (priority)

### Bucket 1 — Clean (correctly consume shared logic)

`MobileToolbelt` → `useToolbeltActions` · `ToolbeltSidePanel`, `ToolbeltFAB` → presentational over `ToolbeltAction[]` · `MobileBreadcrumbs` → `buildBreadcrumb` · `MobileFolderPicker` → `findFolder`/`buildBreadcrumb` · `MobileDrawerItem` (rich view) → `DrawerItemPreview` · `MobileMainMenu` → `createCharacter`/`setContextualGame` · `MobileAbout` → `MarkdownContent` · `MobilePatchNotes` → `patchNotes`/`MarkdownContent` · `MobileSettings` → `MigrationDialog` + shared settings actions · `MobileBottomTabs`/`MobileFAB` → shared store + presentational · `MobileAddFolderSheet`/`MobileSaveToDrawerSheet` → presentational · `MobileTutorial` + overlay/tooltip → `mobile-tutorial-steps` · onboarding screens → shared settings actions.

### Bucket 2 — Divergent copies (critical findings)

Ordered by severity. **⚠️ = behavioural drift.**

1. **Item/folder EXPORT — ⚠️⚠️ filename drift (most severe).** `MobileDrawerContextMenu.handleExport` builds the filename as `` `${item.name}.cotm` `` / `` `${folder.name}.cotm` `` and calls `exportToFile` directly. The shared path (`deriveExportHandle` + `generateExportFilename`, used by `DrawerItemEntry`/`DrawerFolderEntry`/`useCharacterSheetExport`) produces `Handle_Game_Type_Date.cotm`. Mobile and desktop currently export the same item under **different filenames**. → **Decision: align to desktop.**

2. **Drawer item/folder CRUD dispatch.** `MobileDrawerContextMenu` (rename/move/delete) reimplements `useDrawerActionState.handleConfirmAction`. ⚠️ Toast drift: items use `Notifications.general.renamed/moved/deleted`; desktop uses `Notifications.drawer.itemRenamed/itemMoved/itemDeleted`. → **align.**

3. **Drawer file import.** `MobileDrawer.handleFileImport` reimplements `useDrawerFileImport.processFile` (FULL_DRAWER/FOLDER/default switch). ⚠️ Drift: different toast keys (`drawer.imported` / `drawer.importSuccess` / `general.imported` vs desktop's single `drawer.importSuccess`); mobile passes `currentFolderId` into `importFullDrawer` where desktop passes nothing. → **align.**

4. **Character + drawer import in the menu.** `MobileMenu.handleCharacterImport` reimplements the `FULL_CHARACTER_SHEET` branch of `useCharacterSheetFileImport.processFile`; `MobileMenu.handleFileImport` reimplements the `FULL_DRAWER` branch of `useDrawerFileImport`. ⚠️ Drift: mobile handles only those file types (errors otherwise); different toast keys. → **align mechanics/toasts; confirm the import-button file-type scope (see deferred nuance).**

5. **Drawer→sheet component import.** `MobileCharacterSheetPage.handleAddDrawerItemToCharacter` reimplements Scenario 1.3 of `useCharacterSheetDnD.handleDragEnd` (game-match check + cardTypes/trackerTypes + `addImportedCard`/`addImportedTracker`). ⚠️ Drift: mobile toasts on wrong-game error but not on success; desktop toasts `character.componentImported` on success. → **align.**

6. **Item-type icon mapping.** `MobileDrawerItem.getItemIcon` parallels `getItemTypeIcon` (`lib/utils/drawer-icons.tsx`) keyed on the same `GeneralItemType`. ⚠️ Drift: a completely different icon set (`User/Layers/Users/Package/Heart/Tag/Sparkles` vs `FileUser/IdCard/FileText/FileHeart/CreditCard/RectangleEllipsis/WalletCards`). → **Decision: adopt shared icons.**

7. **Card-type → component routing — duplicated TWICE, and the two mobile copies disagree.**
   - `MobileCardCarousel.renderCard` = the *old* static `CardRenderer` branches (cardType-first; LOADOUT grouped for all games) + mobile-only `useVerticalStack: true` + no-op `onEditCard`/`onExport`.
   - `MobileCharacterSheet.renderCardPreview` = a *different* shape (game-first), forces `viewMode: 'SIDE_BY_SIDE'` + `isFlipped: false`, passes `isDrawerPreview`, and ⚠️ **omits the City-of-Mist `LOADOUT_THEME` case** that the carousel copy includes. (The omission happens to match the shared `resolveCardComponent`'s Otherscape-only LOADOUT rule, but the carousel copy does not — the two mobile copies are inconsistent with each other.)
   - → **align: both route through `resolveCardComponent`.**

8. **Save-to-drawer mechanics.** `MobileCharacterSheet.handleConfirmSaveToDrawer` inlines `mapItemToStorableInfo` + deep-copy + `isFlipped` reset + `addItem` — the same mechanics as `useCharacterSheetDnD.handleSheetToDrawerDrop`. → **consolidate onto shared mechanics.**

9. **Drawer navigation + add-folder.** `MobileDrawer.handleNavigate` (+ `findFolder`-based current-folder derivation) duplicates `useDrawerNavigation`; `handleAddFolderConfirm` duplicates the add-folder dispatch in `useDrawerActionState`. Low drift; clear missed reuse. → **consolidate onto the shared drawer hooks.**

### Bucket 3 — Genuinely mobile-only (legitimate; keep)

Touch **long-press** detection · **swipe gestures** (card flip/navigate, edge-swipe toolbelt) · **button-based reorder** UIs (wrap the shared `reorder*` store actions — only the interaction is mobile) · tap-select tracker state · **handedness** layout · **haptics** · FAB thumb-zone scaling + viewport math · **browser-history back-button** tab nav · onboarding flow · mobile coach-mark tutorial (overlay/tooltip positioning).

### Internal mobile-only duplication (mobile ↔ mobile)

Not desktop-shared, but worth consolidating into mobile primitives during the structural pass:

- **Long-press** — 3 copies: `SelectableTracker`, `MobileDrawerItem`, `MobileFolderItem` → candidate `useLongPress`.
- **Window-height hook** — `ToolbeltFAB`, `TutorialTooltip` → candidate `useWindowHeight`.
- **Bottom-sheet scaffold** (backdrop + spring slide-up) — `MobileAddFolderSheet`, `MobileSaveToDrawerSheet`, `MobileFolderPicker`, and twice inside `MobileDrawerContextMenu` → candidate `MobileBottomSheet`.
- **Breadcrumb rendering** — `MobileBreadcrumbs` vs the inline one in `MobileFolderPicker`.
- **Folder-count label** — `MobileFolderItem` vs `MobileFolderPicker`.
- **Card routing** — the two copies in #7.

**Conclusion:** Bucket 2 is large. The mobile pass is not pure decomposition — there is a behaviour-touching consolidation sub-project, now gated and directionally settled (align to shared).

---

## Task 3 — Monoliths

- **`MobileCharacterSheet.tsx` (985) — primary monolith.** Responsibilities: name header · trackers section (3 groups + add buttons + `SelectableTracker`) · card carousel area + nav bar (dots/title) · card-reorder list view · tracker-reorder floating controls · save-to-drawer flow · toolbelt wiring · 4 swipe-gesture handlers · `getCardTitle` · `renderCardPreview`.
  - **Component candidates:** `MobileTrackersSection` (organism), `MobileCardArea` / `MobileCardNavBar` (organisms), `MobileCardReorderView` (organism), `MobileTrackerReorderControls` (molecule), `MobileCharacterNameHeader` (molecule).
  - **Hook candidates:** `useMobileSheetGestures` (swipe), `useMobileTrackerReorder`, `useMobileCardReorder`, `useMobileSaveToDrawer` (or reuse shared save mechanics).
  - **Shared-logic targets:** `renderCardPreview` → `resolveCardComponent`; `handleConfirmSaveToDrawer` → shared save; `getCardTitle` → candidate shared `deriveCardTitle` util (no desktop equivalent yet).
- **`MobileSettings.tsx` (435).** Inline `ConfirmationDialog` → own file (`MobileConfirmationDialog`); repeated label+button-pair blocks → a `MobileSettingToggleGroup` molecule; danger-zone reset handlers parallel `SettingsDialog`'s inline ones (no shared hook exists).
- **`MobileDrawerContextMenu.tsx` (385).** Extract the two inline bottom sheets (rename, delete), reuse a `MobileBottomSheet` primitive; CRUD/export dispatch → consolidate onto the shared drawer hooks (Bucket 2 #1, #2).
- **`MobileAddCard.tsx` (350).** Parallel to `CreateCardDialog`; candidate **new** shared `useCreateCardForm` hook used by both (desktop doesn't have one yet — bigger cross-cutting decision).
- **`MobileCharacterSheetPage.tsx` (305).** Mostly orchestration; extract `useMobileTabNavigation` (history/popstate); move `handleAddDrawerItemToCharacter` onto shared import logic.
- **`MobileMenu.tsx` (269), `MobileDrawer.tsx` (266), `MobileMainMenu.tsx` (198).** Each holds extractable inline logic (import/export handlers; `GameCard` molecule).

**Fine as-is:** `MobileBreadcrumbs`, `MobileBottomTabs`, `MobileFAB`, `MobileSaveToDrawerSheet`, `MobileAddFolderSheet`, `SelectableTracker`, `MobileFolderItem`, `MobileAbout`, `MobilePatchNotes`, `ToolbeltSidePanel`, `MobileToolbelt`, the onboarding steps, the tutorial pieces (apart from sharing primitives). `ToolbeltFAB` is dense but cohesive and mobile-only — leave unless its viewport math is extracted.

---

## Task 4 — Structure recommendation

**Recommend domain/screen grouping, not an atomic split** (with a small shared-primitives folder).

Reasoning: mobile is screen-centric and already partly domain-grouped (`onboarding/`, `tutorial/`); the desktop pass itself used domain folders (`command-palette/`, `drawer/`, `cards/`) for cohesive subsystems and reserved atomic folders for genuinely reusable primitives. Mobile's components are nearly all screen-specific, so molecules/organisms atomic buckets would mostly be near-empty noise.

```
src/components/mobile/
  character-sheet/     (sheet, trackers section, card area, reorder views, selectable tracker)
  drawer/              (drawer shell, item/folder rows, context menu, folder picker, breadcrumbs, sheets)
  toolbelt/            (MobileToolbelt, ToolbeltSidePanel, ToolbeltFAB)
  menu/                (MobileMenu, MobileMainMenu, bottom tabs, FAB, settings, about, patch-notes, add-card)
  onboarding/          [EXISTS]
  tutorial/            [EXISTS]
  shared/              (MobileBottomSheet, and other cross-screen mobile primitives)
src/hooks/mobile/      (useLongPress, useWindowHeight, useMobileTabNavigation, useMobileSheetGestures, …)
```

**Promotion out of `mobile/`:** none of the *components* are responsive-shared — they are all mobile-specific UIs. The right sharing move is the opposite direction: mobile should consume the existing shared hooks/utils (`resolveCardComponent`, `getItemTypeIcon`, the drawer/sheet hooks). The only genuinely cross-cutting *new* shared item is a possible `useCreateCardForm` hook (used by both `CreateCardDialog` and `MobileAddCard`) — a desktop+mobile decision, flagged for the owner.

---

## Task 5 — Mobile/desktop boundary

**Mechanism:** `useDeviceType()` (`src/hooks/useDeviceType.ts`) returns `isMobile` from user-agent + touch capability + a `deviceTypeOverride` setting. Branch points:

- `src/pages/CharacterSheetPage.tsx` default export: `if (isMobile) return <MobileCharacterSheetPage/>` else `<DesktopCharacterSheetPage/>` — the main split.
- `src/components/providers/AppStartManager.tsx`: renders `<MobileOnboarding>` (gated on `isMobile` + `isMobileOnboardingOpen`); mobile tutorial via `isMobileTutorialOpen`.
- `src/App.tsx` and `SettingsDialog.tsx` also read `isMobile` for layout/options.

**Desktop ↔ mobile pairs** (highest-value consolidation targets):

| Desktop | Mobile |
|---|---|
| `DesktopCharacterSheetPage` | `MobileCharacterSheetPage` + `MobileCharacterSheet` |
| `resolveCardComponent` / `CardRenderer` | `MobileCardCarousel.renderCard` **and** `MobileCharacterSheet.renderCardPreview` |
| `TrackersSection` | `MobileCharacterSheet` trackers section |
| `Drawer` | `MobileDrawer` |
| `DrawerItemPreview` + `getItemTypeIcon` | `MobileDrawerItem` (rich + compact) |
| `Breadcrumb` | `MobileBreadcrumbs` |
| `DrawerMoveItemNavigator` | `MobileFolderPicker` |
| `DrawerModificationWindow` + item dropdown | `MobileDrawerContextMenu` |
| `CreateCardDialog` | `MobileAddCard` |
| `SettingsDialog` | `MobileSettings` |
| `InfoDialog` | `MobileAbout` |
| `PatchNotesDialog` | `MobilePatchNotes` |
| `MainMenu` | `MobileMainMenu` |
| `SidebarMenu` | `MobileMenu` (+ `MobileBottomTabs`/`MobileFAB`) |
| Toolbelt (via `useToolbeltActions`) | `MobileToolbelt`/`ToolbeltSidePanel`/`ToolbeltFAB` ✅ already shares the hook |
| `useCharacterSheetFileImport` / `useDrawerFileImport` | inline copies in `MobileMenu`/`MobileDrawer` ⚠️ |
| `useDrawerNavigation` / `useDrawerActionState` | inline copies in `MobileDrawer`/`MobileDrawerContextMenu` ⚠️ |

---

## Task 6 — Target structure & phase plan

### 6a. Target tree (markers; unchanged files omitted)

```
src/components/mobile/
  character-sheet/
    MobileCharacterSheet.tsx                 [MOVE] (then [EXTRACT] in Phase 7)
    MobileCharacterSheetPage.tsx             [MOVE]
    MobileTrackersSection.tsx                [EXTRACT from MobileCharacterSheet]
    MobileCardArea.tsx                       [EXTRACT]
    MobileCardNavBar.tsx                     [EXTRACT]
    MobileCardReorderView.tsx                [EXTRACT]
    MobileTrackerReorderControls.tsx         [EXTRACT]
    MobileCharacterNameHeader.tsx            [EXTRACT]
    MobileCardCarousel.tsx                   [MOVE] (-> resolveCardComponent)
    SelectableTracker.tsx                    [MOVE] (-> useLongPress)
    MobileSaveToDrawerSheet.tsx              [MOVE]
  drawer/
    MobileDrawer.tsx                         [MOVE] (-> shared drawer hooks)
    MobileDrawerItem.tsx                     [MOVE] (-> getItemTypeIcon, useLongPress)
    MobileFolderItem.tsx                     [MOVE] (-> useLongPress)
    MobileBreadcrumbs.tsx                    [MOVE]
    MobileDrawerContextMenu.tsx              [MOVE] (then [EXTRACT]; -> shared CRUD/export)
    MobileFolderPicker.tsx                   [MOVE]
    MobileAddFolderSheet.tsx                 [MOVE]
  toolbelt/
    MobileToolbelt.tsx / ToolbeltSidePanel.tsx / ToolbeltFAB.tsx   [MOVE]
  menu/
    MobileMenu.tsx                           [MOVE] (-> shared import/export)
    MobileMainMenu.tsx                       [MOVE]
    GameCard.tsx                             [EXTRACT]
    MobileBottomTabs.tsx / MobileFAB.tsx     [MOVE]
    MobileSettings.tsx                       [MOVE] + [EXTRACT]
    MobileConfirmationDialog.tsx             [EXTRACT]
    MobileSettingToggleGroup.tsx             [EXTRACT]
    MobileAbout.tsx / MobilePatchNotes.tsx   [MOVE]
    MobileAddCard.tsx                        [MOVE]
  shared/
    MobileBottomSheet.tsx                    [NEW]
  onboarding/                                [EXISTS]
  tutorial/                                  [EXISTS]

src/hooks/mobile/
  useLongPress.ts                            [NEW]
  useWindowHeight.ts                         [NEW]
  useMobileTabNavigation.ts                  [EXTRACT]
  useMobileSheetGestures.ts                  [EXTRACT]
  useMobileTrackerReorder.ts                 [EXTRACT]
  useMobileCardReorder.ts                    [EXTRACT]

src/lib/utils/
  character.ts -> deriveCardTitle            [NEW, optional]
src/hooks/
  useCreateCardForm.ts                       [NEW, optional — desktop+mobile, gated]
```

### 6b. Phasing (easiest → hardest)

| Phase | Work | Risk / gating |
|---|---|---|
| **2** | Folders & moves — create domain folders, `[MOVE]` files, fix imports. | Behaviour-preserving. Mirrors desktop Phase 4. |
| **3** | Mobile-internal primitives — `useLongPress`, `useWindowHeight`, `MobileBottomSheet`; dedup breadcrumb/folder-count. | Low risk, mobile-only. |
| **4** | **Card-routing consolidation** — both mobile renderers → `resolveCardComponent`. | Review gate (correctness/scope). Direction settled: align. Resolves City-LOADOUT inconsistency. |
| **5** | **Drawer-logic consolidation** — `MobileDrawer`/`MobileDrawerContextMenu`/`MobileFolderPicker` reuse `useDrawerNavigation`/`useDrawerActionState`/`useDrawerFileImport`. | Review gate. Biggest behaviour surface: export filenames + toast keys (decided: align). |
| **6** | **Sheet/menu import-export-save consolidation** — `handleAddDrawerItemToCharacter`, `MobileMenu` import/export, `handleConfirmSaveToDrawer` → shared hooks. | Review gate. Confirm `MobileMenu` character-import file-type scope here. |
| **7** | `MobileCharacterSheet` decomposition — hooks first (`useMobileSheetGestures`, reorder hooks), then component extraction into `character-sheet/`. | Behaviour-preserving. Mirrors desktop 6a/6b. |
| **8** | Remaining monolith decomposition — `MobileSettings`, `MobileDrawerContextMenu`, `MobileAddCard`, `MobileMenu`, `MobileMainMenu`. | Behaviour-preserving. |

**Gating note:** Phases 4–6 are the consolidation sub-project — the only phases that change mobile behaviour (filenames, toasts, icons, import routing). The align-vs-preserve question is now closed (align). They still take a normal review gate for correctness and scope. Phases 2, 3, 7, 8 are behaviour-preserving decomposition mirroring the desktop pass.

---

## Hard rules carried into the implementation phases

- Mobile-only logic (touch, gestures, viewport, handedness, haptics) is legitimate and stays.
- `src/components/ui/` is out of scope.
- Proposed names use no abbreviations.
- Mobile mirrors the already-refactored desktop conventions unless there is a stated mobile-specific reason to diverge.
- Behaviour changes ship only as the explicit, approved outcome of a gated phase (the two export/icon decisions and the general "harmonize" rule are that approval).
- Build clean (`tsc -b` + `vite build`) after every task; lint against the established baseline.
