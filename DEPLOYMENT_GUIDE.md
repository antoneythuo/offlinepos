# Sequence Lounge POS — Deployment Guide

This guide covers everything needed to set up the POS system on a new computer and build it into a standalone `.exe` installer that launches like any normal Windows application.

---

## Part 1 — Prerequisites (install once per machine)

### 1. Node.js 20 LTS

Download and install from: https://nodejs.org/en/download

- Choose **Windows Installer (.msi) — LTS**
- Accept all defaults during installation
- Verify after install — open Command Prompt and run:

```cmd
node -v
npm -v
```

Both should print version numbers.

---

### 2. MySQL 8.x

Download from: https://dev.mysql.com/downloads/mysql/

**Recommended option:** Use **MySQL Installer for Windows** (the full installer).

During setup:
- Choose **Developer Default** or **Server Only**
- Set a root password — write it down
- Leave port as **3306**

After installation, open **MySQL Command Line Client** and run:

```sql
CREATE DATABASE pos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pos_user'@'localhost' IDENTIFIED BY 'pos_password';
GRANT ALL PRIVILEGES ON pos_db.* TO 'pos_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> If you want a different username or password, use them here and update `config.json` in Step 3.

---

### 3. Git (optional, only needed if copying from source)

Download from: https://git-scm.com/download/win

---

## Part 2 — First-time project setup

### Step 1 — Copy the project files

Copy the entire `offline-pos-system` folder to the target machine, for example to:

```
C:\POS\offline-pos-system\
```

### Step 2 — Configure the database connection

Inside `C:\POS\offline-pos-system\`, copy the example config:

```cmd
cd C:\POS\offline-pos-system
copy config.example.json config.json
```

Open `config.json` and verify the values match your MySQL setup:

```json
{
  "database": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "pos_user",
    "password": "pos_password",
    "database": "pos_db"
  }
}
```

Change `user` and `password` if you used different values in Step 2 above.

### Step 3 — Install dependencies

```cmd
cd C:\POS\offline-pos-system
npm install
```

This downloads all required packages. It may take 3–5 minutes on first run.

### Step 4 — Run database migrations and seed

```cmd
npx knex migrate:latest --knexfile knexfile.ts
npx knex seed:run --knexfile knexfile.ts
```

This creates all database tables and inserts:
- Default roles (Administrator, Manager, Cashier, Stock Controller)
- Default admin user
- Default "General" category and "Piece" unit
- Default settings including business name

**Default login credentials:**
- Username: `admin`
- PIN: `1234`

> Change the admin PIN immediately after first login via Settings → Users & Roles.

---

## Part 3 — Build the standalone installer (.exe)

This creates a proper Windows installer that puts the app in your Start Menu and creates a desktop shortcut — no Command Prompt needed to run it.

### Step 1 — Add an app icon (optional but recommended)

Create a folder called `build` inside the project:

```cmd
mkdir C:\POS\offline-pos-system\build
```

Place a `icon.ico` file (256×256 px) inside `C:\POS\offline-pos-system\build\`.

If you don't have an icon, skip this — the build will use a default Electron icon.

### Step 2 — Build the application

```cmd
cd C:\POS\offline-pos-system
npm run dist
```

This runs two things automatically:
1. Compiles all TypeScript and React code
2. Packages everything into a Windows NSIS installer

The process takes 5–15 minutes depending on your machine. When complete, you will find the installer at:

```
C:\POS\offline-pos-system\dist\Offline POS System Setup 1.0.0.exe
```

### Step 3 — Install the application

Double-click `Offline POS System Setup 1.0.0.exe`.

The installer will:
- Ask where to install (default: `C:\Program Files\Offline POS System\`)
- Create a **Desktop shortcut**
- Create a **Start Menu entry**
- Allow uninstall via Windows Settings → Apps

After installation, launch the app from the desktop shortcut or Start Menu — no Command Prompt required.

---

## Part 4 — Important: database must be running

The POS app connects to MySQL on startup. MySQL must be running before you open the app.

**MySQL starts automatically on Windows boot by default.** To verify:

1. Press `Win + R`, type `services.msc`, press Enter
2. Find **MySQL80** in the list
3. Confirm its status is **Running**
4. If not, right-click → Start

To make MySQL start automatically on boot (if not already):
- Right-click MySQL80 → Properties → Startup type → **Automatic**

---

## Part 5 — Updating the app

When you receive an updated version of the source code:

1. Replace the project files in `C:\POS\offline-pos-system\`
2. Run:

```cmd
cd C:\POS\offline-pos-system
npm install
npx knex migrate:latest --knexfile knexfile.ts
npm run dist
```

3. Run the new installer from `dist\` — it will update the existing installation.

> Migrations are safe to run multiple times. They only apply changes that haven't been applied yet.

---

## Part 6 — Troubleshooting

| Problem | Solution |
|---|---|
| App opens but shows "Unable to connect" | MySQL is not running. Start it via services.msc |
| "Access denied for user" error | Check `config.json` credentials match your MySQL user |
| Blank white screen on launch | Open DevTools (Ctrl+Shift+I) and check the Console tab for errors |
| Build fails with "icon not found" | Remove the `icon:` lines from `electron-builder.yml` or add a valid icon file |
| `npm install` fails | Make sure Node.js 20 is installed and you have internet access |
| Port 3306 already in use | Another MySQL instance is running. Stop it or change the port in `config.json` |

---

## Quick Reference

| Task | Command |
|---|---|
| Start in development mode | `npm run dev` |
| Build installer | `npm run dist` |
| Run database migrations | `npx knex migrate:latest --knexfile knexfile.ts` |
| Run database seed | `npx knex seed:run --knexfile knexfile.ts` |
| Run tests | `npm test` |

---

## Default credentials

| Field | Value |
|---|---|
| Username | `admin` |
| PIN | `1234` |
| Business name | Sequence Lounge |
| Database | pos_db |
| DB user | pos_user |
| DB password | pos_password |

**Change the admin PIN after first login.**
