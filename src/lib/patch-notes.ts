export interface PatchNote {
  version: string;
  content: string;
}

export const patchNotes: PatchNote[] = [
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
* Adjusted Legends in the Mist Light mode color palette for a more "Wood and Stone" feel.

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