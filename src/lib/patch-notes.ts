import { gt as isVersionGreaterThan } from 'semver';

export interface PatchNote {
  version: string;
  content: string;
}

export const patchNotes: PatchNote[] = [
   {
      version: '2.0.0',
      content: `
### 🎉 2.0.0 — Say hello to Campaigns of the Mist!
Okay. Deep breath. This is the big one.

**Characters of the Mist is now Campaigns of the Mist.**

When I started this, it was a character sheet app. That was the whole idea, a nice home for your themes, your tags, your trackers. But over the past months it quietly grew into something bigger than I planned for, and honestly, calling it a "characters" app started to feel like selling it short.

You can now run a whole table in here. Multiple characters side by side. Freeform boards for your maps and your mysteries. Notes for all your worldbuilding. Challenges for your players to throw themselves at. It stopped being just about *who your character is*, and became about *the whole campaign around them*.

So it gets a name that fits. Same **CotM**, same logo, same \`.cotm\` files, just a bigger promise. I'm a little emotional about this one, not going to lie. Thank you for being here for it.

### 📱 One thing first, about Mobile
Almost everything below is **desktop-first, for now**. Mobile still does everything it did before, but Boards, Workspaces, the Notes editor and a good chunk of the rest didn't make the jump *yet*. I didn't want to cram features this big onto a small screen just to tick a box, that never ends well. They're coming to mobile, properly, but they'll take the time they need. Thank you for your patience.

### 🎨 Custom Themes
Make it *yours*. There's now a full theme creator built into the app: pick your colors and the entire interface recolors itself around your palette. Everything is built on adaptive tokens, so no matter what you throw at it, the app stays readable in every corner. Light, dark, and anything in between is now up to you.

### 🗂️ Workspaces
The app is no longer a one-thing-at-a-time affair. **Workspaces** bring a tab system: open several characters, boards and notes at once, each in its own tab, and switch between them instantly. I also snuck in per-workspace zoom, so you can pull a character sheet in close or push it back to see the whole thing. (Desktop for now.)

### 🗺️ Boards
This is the big one *inside* the big one. A **Board** is a freeform canvas where you can drop... well, almost anything. Live card and tracker embeds, references to your characters, notes, post-its, journals, images, dice trays, zones to group things together, portals to jump around, freehand drawings, connections drawn between items, and Challenge Cards. Maps, relationship webs, clue boards, session prep, your table finally has a shared space to live on.

### 📝 Notes
A proper writing space. **Notes** are full markdown documents with a live-preview editor that formats as you type, no clunky edit-then-preview dance. You can link notes to each other, and to other places in the app, with portals. Drop your statuses and tags right into the text with a quick mention and they become clickable pills. Great for lore, session recaps, NPC dossiers, or just thinking out loud.

### 🧭 The Navigator
Once your campaign starts spreading across a handful of boards and notes, keeping track of what connects to what gets... interesting. The **Navigator** traces every portal across the whole app into one hierarchical map, following each connection both ways, forward and backward, so you can see exactly how your project hangs together. Every board, note and portal between them, laid out as a single tree you can walk and jump straight through. Drop a portal on a board or a link in a note and it slots right into the graph. Scope it to just the workspace you're in, or open it up to the whole project at once.

### ⚔️ Challenge Cards
Give your players something to fight. **Challenge Cards** let you build the threats, obstacles and dangers of your world, complete with limits, statuses, tags, and their threats & consequences. And they're game-aware: Legend in the Mist gets its Specials and Mighty tags, while Metro: Otherscape and City of Mist each get their own tailored variant. Put them on a sheet or scatter them across a board.

### 🖼️ Images on Character Sheets
Give your character a face! You can now add image cards to a sheet, crop them right inside the app (non-destructively, so you can re-crop any time), and pick the aspect that frames them best. Portraits, tokens, reference art, whatever helps the character feel real at the table.

### 🎲 The Dice Tray
And of course, dice. The **Dice Tray** slides open right from the sidebar: add as many dice as you want, mix in custom-sided ones, tack on modifiers and penalty dice, or just type a formula like \`2d6+3\` and let it build the pool for you. It keeps a history of your rolls, so if you liked a particular setup you can bring it right back. It also lives as a Board element, for when you'd rather leave it out on the table for the whole group to see.

### 🎓 A Brand New Tutorial
The entire onboarding and tutorial system was rebuilt from the ground up. It now runs on its own seeded demo content in an isolated space, so it will **never touch your real characters** while it walks you through things. And it lives in a new Learn section, so you can go back and replay any lesson whenever you like, not just once on your first visit.

### 🧰 Also in the box
* **One unified Settings menu**: App Settings, About, and Patch Notes all live under one roof now, with the tutorials tucked into that Learn section.
* **Full backups**: you can now export a single file with *all* your data (characters, boards, notes, drawer, settings) and restore it anywhere. Your safety net.
* **In-app announcements**: I can now surface important news right at the top of the app when something needs saying.
* **Under the hood**: your data moved to a sturdier storage engine to carry everything above without breaking a sweat.

### 💬 So what's next?
Mobile, mostly. Bringing all of this to phones and tablets in a way that actually feels *good* to use, not just possible. And beyond that, whatever you ask for. The Tools of the Mist Discord is still the place, I still read every message, and I still build slowly but surely.

Thank you, genuinely, for sticking around long enough to watch a character sheet grow into a whole campaign. Now go make something.
`
   },
   {
      version: '1.3.1',
      content: `
### 🐛 Bugfixes
* Added missing localization keys for update prompt in French.
* Allowed scroll in onboarding screen on mobile for smaller screens.
* Fixed Edit Theme action in mobile toolbelt not working.
* Fixed custom themebooks not working on mobile.
`
   },
   {
      version: '1.3.0',
      content: `
### ✨ The Mobile Update!
As per requested, Mobile compatibility is here! Characters of the Mist can now be opened on a mobile device with a specially made mobile UI!
Please keep in mind I am absolutely not used to mobile UIs. I tried my best to make something intuitive and pleasant to use, but feeback is always welcome.
There may be unexpected bugs, I didn't get the opportunity to test this on a lot of screen sizes. Don't hesitate to hit up the Tools of the Mist discord !
For the best experience, please install Characters of the Mist as a Progressive Web App on your device using a browser that supports this feature.

**Here's what's in it:**
* **Two navigation modes**: pick what feels best in Settings. Bottom tabs gives you a familiar Sheet / Drawer / Menu bar at the bottom. FAB mode replaces it with a single corner button that expands into the same options, leaving more room for content.
* **Handedness setting**: also in Settings. Choose left or right, and every floating control (the navigation button, the toolbelt, the row grips, the card reorder button) mirrors itself to your thumb side.
* **The Toolbelt**: a thumb-zone action ring summoned by a wrench button. It collects every contextual action: undo/redo, edit mode, save, add cards or trackers, and per-item actions once you select something (delete, flip, export, save to drawer...). The button closest to your thumb is slightly larger as you scroll, so the action you're aiming at is easier to hit.
* **Cards on mobile**: swipe left or right anywhere on a card to flip between them. A navigation bar below has prev/next, flip and reorder buttons, plus dots to show where you are in the stack.
* **Drag to reorder**: drag the grip handle on a drawer item or on a tracker (in edit mode) to move it. For cards, there's a dedicated reorder view (the reorder button in the card navigation bar, or in the Toolbelt) where each card gets a grip handle on the side.
* **Long-press menus**: long-press a drawer item or folder to bring up rename / move / duplicate / delete (the overflow button on each row is always there as a fallback). Long-press a tracker on the sheet to "select" it, and the Toolbelt's actions will then target it specifically.
* **Mobile drawer**: the full drawer with its own undo/redo, view-mode toggle, file import and folder organization, all sized for touch.
* **Gesture tips and haptics**: little one-time hints show up the first time you can use a gesture (can be toggled off in Settings). On supported devices, short vibration cues confirm long-presses, mode changes and so on.

### 🔧 Changes
* "Unload Character" button is now at the bottom of the sidebar, and is called "Return to Menu". The effect is the same, it will completely unload your character from memory. Make sure you saved your character to the drawer beforehand! Hopefully this makes it less ambiguous.
* Tags on the back of character cards (Merc Card (Special) / Hero Card (Backpack) / Rift Card (Nemesis)) are now selectable/burnable.

### 🐛 Bugfixes
* "Save Character As" now properly saves to currently open Drawer folder instead of root.

### Other fixes
As reported, it's LEGEND in the Mist, and not LEGENDS in the Mist. Sorry about that! The text has been adjusted across the app.

`
   },
   {
      version: '1.2.1',
      content: `
### 🔧 Changes
The drop zone for items in the drawer has now been expanded to always take, at minimum, the full available height. It expands with items as they're added. No longer will you have to look for the drop zone before letting go of an item.
\nThe drawer's drop zone will now also look much more vibrant and distinct from the background, instead of the very light color used before.

### 🐛 Bugfixes
Found and fixed a few missing localized strings across the app.
Fixed Character Name inputs in Character Card and Page Header not updating each other.
`
   },
   {
      version: '1.2.0',
      content: `
### Another big one, back to back!
Not as long awaited, but a big milestone for me and for any future adjustment or addition.

### ✨ **New !**
**PWA support**: Characters of the Mist can now be installed as a PWA on compatible browser. PWAs (Progressive Web Apps) are web application that behave almost like native applications. You can now have a shortcut for Characters of the Mist on your computer, it can run in its own window, and... it can work offline!

### 🔧 Changes
Completely migrated Characters of the Mist to a new framework to facilitate offline capabilities. This means there could be a few issues I missed. Don't hesitate to report them on the discord!

### What's next ?
The migration was quite intense, but it was worth it. I took that opportunity to refactor quite a lot of things and make the code easier to maintain. Since Otherscape and City of Mist are integrated, Offline works, and some of the requested features have been implemented, I will now seriously look into mobile compatibility.
\nPlease keep in mind that I make no promises. I will seriously look into it, and how I can make it happen. But I greatly value user experience. If I can't find a user friendly way to do it, it'll have to wait.
\nAs usual, please ask for features you'd like to see in the app on the discord! I listen, even though I can be quiet at times.
`
   },
   {
      version: '1.1.0',
      content: `
### A Big One !
This is THE long awaited update.

### **⚠️ Important!**
* App's version of NextJS updated to get the latest security fixes which properly patches a serious security problem found in React Server Components.

### ✨ **The Long Awaited...**
* **City of Mist support !!!**: City of Mist support has been added to Characters of the Mist, along with all the themes available within the free demo!
* **Metro:Otherscape support !!!**: Metro:Otherscape support has been added to Characters of the Mist, along with all the themes available within the free demo!
* *Note for users of the legacy version*: The migration tool available in Settings can be used to migrate your legacy character sheets to the new app effortlessly.
* The app now features a **Main Menu**, which allows you to pick a game system to create a new character in. You can still drop character files from your file explorer or from the drawer to load them!

### 🐛 Bugfixes
* Fixed some stutterings and inconsistencies with card hitboxes.

### 🔧 Changes
* Characters now have persistence in the Drawer. There are now two buttons to save, "Save Character" and "Save Character As...". The "Save As" feature prompts you for a new file name within the drawer, while the "Save" overwrites the original drawer file.
* As requested, the Drawer now has a button in its header to close it.
* Adjusted Legend in the Mist Light mode color palette for a more "Wood and Stone" feel.

### So what's next ?
As always, please do not hesitate to send feature requests and bug reports on the Tools of the Mist server, even if I work slowly due to lack of time, I read them, and I try my best to implement them!
The next feature that will come to Characters of the Mist is offline app capabilities. You will be able to install Characters of the Mist as a PWA (Progressive Web App), which will act like a regular app and will keep working even if you're not online.
`
   },
   {
      version: '1.0.4',
      content: `
### I have been informed that there were new Demo themebooks!
So I made sure they were in the app.

### 🐛 Bugfixes
* Theme **type** translations wouldn't show up in card creation window and command palette.

### 🔧 Changes
* Default available themebooks have been changed to match the latest demo content.
`
   },
   {
      version: '1.0.3',
      content: `
### This one is a very small bugfix!
Small, but necessary.

### 🐛 Bugfixes
* Card creation window wouldn't always allow for a custom themebook.
`
   },
   {
      version: '1.0.2',
      content: `
### Small patch with a few features
This patch adds a couple of suggested features.

### **⚠️ Important!**
**This patch is the first that requires data harmonization**.

To make story themes possible, a slight modification to the data structure of characters was necessary. This is **a breaking change**, however, I set up a data harmonization system that will check if your data is in need of an update, and do it automatically.

This is the first opportunity I have to test this utility. If the app crashes for you, **DO NOT PANIC**, your data is safe as long as you don't clear your browser data or cache. Simply shoot me a message on Discord and we'll fix it together.

Everything should work fine, as far as I've tested before deploying this change. But since it's the first time this utility is used in the full, public app, unexpected things can happen.

### ✨ Features
* **Negative Story Tags**: You can now mark a story tag as *negative*, it will visually render like a weakness tag, serving as a visual indicator.
* **Story Themes**: You can now *evolve* a story tag into a story theme, and you can add any number of power or weakness tags to that story theme. You can, of course, *devolve* a story theme into a tag, as well.

### 🔧 Changes
* **Adjusted Themes**: There is now a very slight luminance difference on some of the background colors to add a bit more depth to the general UI. This change was brought to both the neutral and LitM palettes.
* **Updated Tutorial**: The tutorial now mentions Story Themes and how to create them.

`
   },
   {
      version: '1.0.1',
      content: `
### Nothing too exciting here
This is mainly a patch adding a small requested feature I found particularly interesting, and fixing a few UI bugs I dug up.

### ✨ Features
* **Card-specific view-mode**: You can now change a card's view mode from Side-by-Side, Flip, or having it follow your global preferences.
* **Theme Types now display as icons**: Because honestly, it's cute, and I think it looks nicer. They have a tooltip now so you know exactly what the icon means.
* **Localized themebook names**: Because our non-english peers deserve to know what those themebooks mean, too.
* **Trackers can now be locked in edit mode**: Following another request, you can now globally lock trackers in edit mode from your app settings. (This means the "Add" button for statuses and story tags will always be visible, they will always be deletable, and their name will always be editable.)

### 🐛 Bugfixes
* Command Palette's Create Card action did not properly assign chosen Main Tag name. Whoops.
* Incorrect colors on the tracking button for a card's main tag.
* The tracking button on tags was hard to notice when enabled, fixed with a new icon, and with tag underlining for good measure.
* Some texts weren't properly aligned in the French locale, because of erroneously set alignment properties.
`
   },
   {
      version: '1.0.0',
      content: `
### 🎉 Version 1.0.0 - The Proper Release!
This is the official launch of the new **Characters of the Mist** application! This version is a complete rewrite of the legacy alpha, built from the ground up with a modern, scalable, and privacy-first architecture. All your data is saved directly in your browser, ensuring complete privacy and offline capability.

### ✨ Key Features & Additions
* **The Drawer**: A complete file system for your characters and components. It features full CRUD functionality, nested folders, and robust drag-and-drop for organization.
* **Full Drag & Drop**: A highly requested feature is here! Reorder cards and trackers on your sheet, move items in the Drawer, or load a character by dragging their sheet from the Drawer onto the main play area.
* **Command Palette**: For the power users, press \`Ctrl+K\` to summon a powerful command palette that lets you do almost anything without touching your mouse.
* **Localization**: The application is now available in English and French from day one, with a system in place for community contributions. The entire tutorial is also fully localized.
* **Data Migration Tool**: A built-in tool helps you seamlessly migrate character sheets from the old alpha version of the app to the new format.
* **Interactive Guided Tutorial**: A new guided tour explains all the major features of the application to new users.

### 🔧 Architectural & Quality of Life Improvements
* **Modern Tech Stack**: The app is built with Next.js (App Router), TypeScript, Tailwind CSS, and Shadcn/UI for a fast, reliable, and maintainable codebase.
* **Robust State Management**: State is managed with Zustand, featuring automatic persistence to local storage and a powerful, context-aware Undo/Redo system (\`Ctrl+Z\`) for both the character sheet and the Drawer.
* **Polymorphic Card System**: The data structure is now more flexible, allowing for different types of cards (like Theme Cards and Character Cards) to coexist in a single, reorderable list.
* **Dynamic Layout**: The character sheet is no longer fixed. You can add as many cards and trackers as you need.
* **New UI & Theming**: The interface has been completely redesigned with multiple color themes and a light/dark mode toggle.
`
   }
];

/** The newest release with patch notes. The array is authored newest-first, but resolve by semver so order can't betray us. */
export const latestPatchNotesVersion: string = patchNotes.reduce(
   (newest, note) => (isVersionGreaterThan(note.version, newest) ? note.version : newest),
   patchNotes[0]?.version ?? '0.0.0',
);

/** Whether a genuinely newer release exists than the one the user last opened What's-new for (drives the New! dot). */
export function hasUnreadPatchNotes(lastReadVersion: string): boolean {
   return isVersionGreaterThan(latestPatchNotesVersion, lastReadVersion);
}