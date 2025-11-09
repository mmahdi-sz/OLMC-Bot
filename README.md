# OLMC Minecraft Telegram Bot

## 🤖 Overview
This repository contains the core logic for the OtherLand Minecraft (OLMC) server's Telegram Bot. It is built on Node.js and integrates deeply with the game server via RCON and MySQL databases (for LuckPerms and internal settings).

## ✨ Key Features
*   **Intelligent RCON Manager:** Maintains a stable RCON connection, with automatic reconnection and fatal error detection (e.g., wrong password).
*   **Secure Chat Bridge:** Bridges communication between a Telegram group topic and the Minecraft in-game chat using `tellraw` commands, with built-in RCON injection prevention and anti-spam measures.
*   **User Registration Wizard:** A multi-step wizard to register new players, collecting essential information (Edition, Username, Age) and linking their Telegram ID to their Minecraft account.
*   **Rank List Automation:** Scheduled updates for temporary ranks, fetching data from the LuckPerms database (MySQL) and sending a formatted list to a dedicated Telegram topic.
*   **Admin Tools:** Dedicated panels for Super Admins to manage servers, add new admins, and configure bot-wide settings.
*   **Verification System:** A two-way system (Bot-to-Game and Game-to-Bot) for verifying Telegram users with their in-game accounts.

## ⚙️ Setup and Configuration

### Prerequisites
*   Node.js (v18+)
*   MySQL/MariaDB Server (for both internal bot data and LuckPerms)
*   A Minecraft Server with RCON enabled.

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/OLMC-Bot/OLMC-Minecraft-Telegram-Bot.git
    cd OLMC-Minecraft-Telegram-Bot
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Environment Variables (.env)
You must create a file named `.env` in the root directory and populate it with your sensitive data:

```env
# --- Telegram Bot Credentials ---
BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
SUPER_ADMIN_ID=YOUR_TELEGRAM_USER_ID
SUPPORT_ADMIN_USERNAME=otherland_admin
MAIN_BOT_USERNAME=OLMCrobot
SUPPORT_BOT_USERNAME=YourSupportBotUsername

# --- Minecraft RCON Connection (Chat Bridge) ---
BRIDGE_RCON_HOST=YOUR_MINECRAFT_SERVER_IP
BRIDGE_RCON_PORT=25575
BRIDGE_RCON_PASSWORD=YOUR_RCON_PASSWORD

# --- Main Database (Bot Settings, Registrations) ---
DB_HOST=YOUR_DB_HOST
DB_USER=YOUR_DB_USER
DB_PASSWORD=YOUR_DB_PASSWORD
DB_DATABASE=YOUR_BOT_DATABASE_NAME

# --- LuckPerms Database (Rank List) ---
LP_DB_HOST=YOUR_LP_DB_HOST
LP_DB_USER=YOUR_LP_DB_USER
LP_DB_PASSWORD=YOUR_LP_DB_PASSWORD
LP_DB_DATABASE=YOUR_LUCKPERMS_DATABASE_NAME

# --- Log Reader Configuration ---
SERVER_LOG_FILE_PATH=C:/path/to/server/logs/latest.log
FILTERED_WORDS=badword1,badword2