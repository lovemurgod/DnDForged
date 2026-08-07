# ForgeDVTT — Tabletop Freedom

> **Plug & Play Virtual Tabletop (VTT) for Dungeons & Dragons 5e**
> A lightweight, self-hosted VTT application combining full 5e content lookup, interactive map canvas, token management, dynamic fog of war, 3D dice rolling, party combat tracking, and zero-config online tunneling.

[![Version](https://img.shields.io/badge/version-1.0.0-gold.svg)](https://github.com/lovemurgod/DnDForged)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](https://github.com/lovemurgod/DnDForged)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/electron-30.0.0-blue.svg)](https://www.electronjs.org/)

---

## 🚀 Quickstart Guide

### Option 1: Desktop App (Recommended for GMs)
ForgeDVTT is packaged as a **single-download Windows desktop app**. No Node.js installation or terminal commands required!

1. **Download & Run**: Get the latest `ForgeDVTT Setup 1.0.0.exe` or portable binary from **[ForgeDVTT Releases](https://github.com/lovemurgod/DnDForged/releases)**.
2. **Choose Subdomain**: Launch the app, enter your desired game subdomain slug (e.g. `julz` or `cosmic`), and click **🚀 Start Online Tunnel**.
3. **Play & Share**: 
   - Click **⚔️ Open VTT Window** to play directly inside the desktop app.
   - Click **📋 Copy Link** to share your secure game URL (`https://<subdomain>.forgedvtt.com/vtt.html`) with your players.

---

### Option 2: Self-Hosted Node.js Server (CLI)
For hosting on a dedicated home server, Linux VM, or command-line environment:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lovemurgod/DnDForged.git
   cd DnDForged
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run local server:**
   ```bash
   npm start
   # Local access: http://localhost:5050
   ```
4. **Launch zero-config online tunnel:**
   ```bash
   npm run online
   # Prompted for custom subdomain (e.g. julz.forgedvtt.com)
   ```

---

## ✨ Feature Highlights

### 💻 Desktop Control Center & Cloudflare Tunneling
- **Zero-Terminal Launcher**: Single-click local Node server initialization with integrated system tray background execution.
- **Built-in Cloudflare Tunnel**: Expose your game securely over HTTPS without port forwarding or router modifications.
- **Subdomain Campaign Isolation**: Host multiple independent campaigns (`julz.forgedvtt.com`, `cosmic.forgedvtt.com`) running seamlessly off your local server.
- **1-Click Data Management**: Direct buttons to open local data folders and create instant campaign zip backups.

### 🎨 Interactive Canvas & Token Controls
- **Grid & Free-Form Movement**: Drag-and-drop token manipulation with cell snapping, measurement rulers, and scale controls.
- **Dynamic Fog of War**: Reveal or obscure map areas on the fly for your players.
- **3D Dice Roller**: Integrated 3D dice simulation for attacks, checks, and damage calculations.
- **Initiative & Combat Tracker**: Synchronized turn order tracking for party members, companions, and monsters.

### 📜 Creature, Companion & Player Character Sheets
- **Integrated Monster Statblocks**: Full 5e SRD bestiary lookup with clickable attacks, saving throws, and skill checks.
- **Companion & Custom NPC Sheets**: Manage party companions and homebrew creatures with full HP, AC, inventory, and spell management.
- **Critical Hit Automation**: Automated double-damage dice calculations for critical hits across player and monster sheets.
- **Item & Spell Reordering**: Drag-and-drop spell and item organization on active character sheets.

### 📚 Integrated 5e Database & Spell Manager
- **Complete 5e Lookup**: Instant search across spells, items, rules, classes, backgrounds, and bestiary data.
- **Cleaned Spell Render Engine**: Formatted spell descriptions with cleaned markup, scaling upcast indicators, and level filters.

---

## 🔒 Data & Privacy Architecture

When you start ForgeDVTT, campaign data is stored locally in the `.dndforged-data/` directory:
- Active campaign states (`campaigns.json`)
- Game chat logs (`chat-log.json`)
- Custom uploaded battlemaps, tokens, and assets (`uploads/` & `assets/`)

This directory is strictly excluded from version control (`.gitignore`) to ensure your campaign secrets, player sheets, and GM notes remain private on your machine.

---

## 🛠️ Developer & Source Build Instructions

To build the desktop app executables or contribute to development:

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (bundled with Node.js)

### Launch Desktop App in Dev Mode
```bash
npm run app
```

### Build Executables & Installers
To build the Windows NSIS Installer (`dist/ForgeDVTT Setup 1.0.0.exe`) and Portable binary:
```bash
npm run dist
```

---

## 📄 License & Legal Disclaimer

### Ownership & Copyright
Copyright (c) 2026. All Rights Reserved.

### Fan Content Disclaimer
ForgeDVTT is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Portions of the materials used are property of Wizards of the Coast. (c)Wizards of the Coast LLC.
