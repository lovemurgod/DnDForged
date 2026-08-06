# ForgeDVTT — Tabletop Freedom

> **Plug & Play Virtual Tabletop (VTT) for Dungeons & Dragons 5e**
> A lightweight, self-hosted VTT application combining full 5e content lookup, interactive map canvas, token management, dynamic fog of war, 3D dice rolling, party combat tracking, and zero-config online tunneling.

---

## 🚀 Quickstart Guide (For Game Masters & Players)

ForgeDVTT is packaged as a **single-download desktop app**. No Node.js, terminal commands, or complicated network configuration required!

### Step 1: Download & Run
1. Download the latest **[ForgeDVTT Setup.exe](https://github.com/YOUR_USERNAME/DnDForged/releases)** (or the **Portable .exe**).
2. Double-click the file to launch the **ForgeDVTT Control Center**.

### Step 2: Choose Your Game Subdomain
1. In the Control Center, type your desired subdomain slug (e.g., `julz` or `cosmic`).
2. Click **🚀 Start Online Tunnel**.

### Step 3: Play & Share
- Click **⚔️ Open VTT Window** to play inside the desktop app.
- Click **📋 Copy Link** to share your secure online game URL (`https://julz.forgedvtt.com/vtt.html`) directly with your players!

---

## ✨ Desktop App Features

- **Zero Terminal Setup:** Click-to-start local Node server and online Cloudflare Tunnel.
- **Bundled Cloudflare Tunnel:** Expose your local game securely over HTTPS without port forwarding.
- **Embedded VTT Window:** Play directly inside the app or open in any external web browser.
- **Campaign Data Management:** 1-click **Open Data Folder** and **Backup Campaign** buttons to keep your maps, tokens, and character sheets safe.
- **System Tray Integration:** Minimize the control center to your system tray while keeping the game server active in the background.

---

## 🛠️ Developer & Source Build Instructions

If you wish to modify the source code or build the desktop app executables yourself:

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm**

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DnDForged.git
   cd DnDForged
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch Electron app in development mode:
   ```bash
   npm run app
   ```

4. Or run local headless server:
   ```bash
   npm start
   ```

### Building Executables & Installers
To generate the Windows NSIS Installer (`dist/ForgeDVTT Setup 1.0.0.exe`) and Portable binary:
```bash
npm run dist
```

---

## 📄 License & Legal Disclaimer

### Ownership & Copyright
Copyright (c) 2026. All Rights Reserved.

### Fan Content Disclaimer
ForgeDVTT is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Portions of the materials used are property of Wizards of the Coast. (c)Wizards of the Coast LLC.
