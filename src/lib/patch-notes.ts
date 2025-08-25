export interface PatchNote {
  version: string;
  content: string;
}

export const patchNotes: PatchNote[] = [
   {
      version: '1.0.4',
      content: `
### I have been informed that there were new Demo themebooks!

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