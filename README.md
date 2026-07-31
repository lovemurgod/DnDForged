# ForgeDVTT — Tabletop Freedom

> A lightweight, self-hosted Virtual Tabletop (VTT) server-side integration powered by Express, Socket.IO, and 5etools.

ForgeDVTT combines rich 5e content lookup with interactive VTT capabilities: real-time map canvas, interactive token management, dynamic fog of war, lighting, integrated 3D dice rolling, party combat tracking, and live DM tools.

---

## Key Features

- **Self-Hosted & Private:** All campaign state, maps, fog of war, tokens, and logs remain 100% local on your machine.
- **Real-Time Multiplayer Sync:** Socket.IO handles synchronized token movement, map switching, dice rolls, and chat logs between DM and players.
- **Interactive Online Launcher:** Dynamic subdomain routing allowing games to be hosted on custom subdomains (e.g., `https://dm-alice.forgedvtt.com`).
- **5etools Integration:** Built-in proxy and renderer support for 5e rules, spell cards, creature stat blocks, and official assets.
- **Zero Database Setup:** Automatically initializes a lightweight, file-backed local data store (`.dndforged-data/`).

---

## Quickstart Guide

### Prerequisites

- **Node.js** (v18.0.0 or higher recommended)
- **npm** (comes bundled with Node.js)

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/DnDForged.git
   cd DnDForged
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start local server:**
   ```bash
   npm start
   ```

4. **Access the VTT:**
   Open your browser and navigate to:
   ```
   http://localhost:5050
   ```

---

## Remote Play & Online Hosting Options

### 1. Dedicated Subdomain Launcher (Recommended)
To host online for remote players with a custom subdomain under `forgedvtt.com`:

```bash
npm run online
```
*(Or double-click `start-online.bat` on Windows)*

The launcher will prompt for your desired subdomain name (e.g. `cosmic` or `dm-alice`), start your local server, and launch the tunnel.

### 2. Local Play (LAN)
Players on your local Wi-Fi network can join directly by opening your computer's local IP address (e.g., `http://192.168.1.X:5050`).

### 3. Instant Localtunnel (Zero Config)
```bash
npx localtunnel --port 5050
```
Share the generated public HTTPS URL with your players.

---

## Data & Privacy Architecture

When you start the server for the first time, DnDForged creates a hidden local directory `.dndforged-data/` on your host machine to store:
- Active campaign states (`campaigns.json`)
- Game chat history (`chat-log.json`)
- Custom uploaded map images & tokens (`uploads/` & `assets/`)

This directory is excluded from version control (`.gitignore`) to ensure your campaign content, player details, and GM notes remain entirely private to your local system.

---

## License & Legal Disclaimer

### Ownership & Copyright
Copyright (c) 2026. All Rights Reserved.

### Fan Content Disclaimer
DnDForged is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Portions of the materials used are property of Wizards of the Coast. (c)Wizards of the Coast LLC.
