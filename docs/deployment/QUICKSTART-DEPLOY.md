# Cloud Deployment Quickstart Guide (Zero to Live on Render)

> **Who this guide is for**: You have just created free accounts on **MongoDB Atlas**, **Upstash**, and **Render**, but haven't configured anything yet. You want a live, working public URL on the internet with automated SSL, managed database, managed cache, and health monitoring in **under 15 minutes**.
>
> **No DevOps experience required**: Every step is explained with exact button names, settings, and verification checks.

---

## Architecture Overview

```
                        ┌─────────────────────────────────────────────────┐
                        │              Internet Users / Farmers           │
                        └───────────────────────┬─────────────────────────┘
                                                │ HTTPS (Automated SSL)
                                                ▼
                        ┌─────────────────────────────────────────────────┐
                        │             Render Web Service                  │
                        │   https://procurement-platform.onrender.com     │
                        │                                                 │
                        │  ┌──────────────────┐    ┌──────────────────┐   │
                        │  │ React SPA (Dist) │    │ NestJS REST API  │   │
                        │  │  (Static Web UI) │    │ & WebSockets WS  │   │
                        │  └──────────────────┘    └─────────┬────────┘   │
                        └────────────────────────────────────┼────────────┘
                                                             │
                                 ┌───────────────────────────┴───────────────────────────┐
                                 │                                                       │
                                 ▼ TLS (mongodb+srv://)                                  ▼ TLS (rediss://)
                  ┌──────────────────────────────┐                       ┌──────────────────────────────┐
                  │    MongoDB Atlas (M0 Free)   │                       │    Upstash Redis (Serverless)│
                  │   • Persistent database      │                       │   • Rate limiting & OTPs     │
                  │   • Automated daily backups  │                       │   • Realtime Pub/Sub cache   │
                  │   • Multi-region replica set │                       │   • Distributed locking      │
                  └──────────────────────────────┘                       └──────────────────────────────┘
```

---

## Part 1: Set Up Managed MongoDB (MongoDB Atlas)

Do not self-host MongoDB on a small cloud server. A single unmanaged database risks total data loss if the disk corrupts. We use **MongoDB Atlas Free M0 Sandbox** (512MB storage, automated backups, zero cost forever).

### Step 1.1: Deploy the Free Database
1. Log in to [cloud.mongodb.com](https://cloud.mongodb.com).
2. On your Atlas home screen, click the green **+ Create** button (or **Build a Database**).
3. Under the plan options, select **M0 (Free)**.
4. Configure the cluster settings:
   * **Cloud Provider**: Select **AWS** (or Google Cloud).
   * **Region**: Select a region close to your users (e.g., `N. Virginia (us-east-1)` or `Mumbai (ap-south-1)`).
   * **Name**: Leave as `Cluster0` (or type `procure-cluster`).
5. Click **Create Deployment** (bottom of the page).

---

### Step 1.2: Create Database User Credentials
1. In the left sidebar under **Security**, click **Database Access**.
2. Click the green **+ Add New Database User** button.
3. Configure the user:
   * **Authentication Method**: Select **Password**.
   * **Username**: Type `procure_admin`.
   * **Password**: Click **Autogenerate Secure Password**.
   * Click **Copy** next to the generated password and **save it in a safe notepad immediately**. You will need this in Step 1.4!
   * **Database User Privileges**: Choose **Read and write to any database** (or `Built-in Role: Atlas admin`).
4. Click **Add User** (bottom right).

---

### Step 1.3: Configure Network Access (Allow Render to Connect)
*(This is the #1 mistake people make when deploying to the cloud. Do not skip!)*

1. In the left sidebar under **Security**, click **Network Access**.
2. Click the green **+ Add IP Address** button.
3. Click the button labeled **ALLOW ACCESS FROM ANYWHERE**.
   * This will automatically fill the IP address field with `0.0.0.0/0`.
   * *Why?* Cloud PaaS platforms like Render use dynamic IP addresses that change on each deploy.
4. **Comment**: Type `Render Cloud Access`.
5. Click **Confirm**.
6. Wait 30 seconds until the status badge turns green saying **Active**.

---

### Step 1.4: Get Your Exact Connection String
1. In the left sidebar under **Deployment**, click **Database**.
2. Find your cluster (`Cluster0`) and click the **Connect** button.
3. Under **Connect to your application**, select **Drivers**.
4. Settings:
   * **Driver**: `Node.js`
   * **Version**: `5.5 or later` (or default)
5. Look at the connection string displayed. It will look like this:
   ```
   mongodb+srv://procure_admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
6. **Format your final string**:
   * Replace `<password>` with the password you copied in Step 1.2 (do **not** keep the `< >` angle brackets!).
   * Insert the database name `procurement_prod` right before the `?retryWrites=true`:
   ```
   mongodb+srv://procure_admin:YOUR_COPIED_PASSWORD@cluster0.abcde.mongodb.net/procurement_prod?retryWrites=true&w=majority
   ```
   > [!WARNING]
   > If your generated password contains special characters like `@`, `:`, `/`, or `%`, you must URL-encode them (e.g., `@` becomes `%40`), or generate an alphanumeric password without special symbols to avoid connection syntax errors.

7. Save this complete string in your notepad under `MONGODB_URI`.

---

## Part 2: Set Up Managed Redis (Upstash Serverless)

Upstash provides a fully managed Redis instance that requires zero configuration, has native TLS encryption, and handles automatic failover.

### Step 2.1: Create Redis Database
1. Log in to [console.upstash.com](https://console.upstash.com) (you can click **Continue with GitHub**).
2. Click the green **Create Database** button.
3. Fill in the database details:
   * **Name**: `procurement-cache`
   * **Type**: Select **Regional**.
   * **Region**: Select the region matching or nearest to your MongoDB/Render region (e.g., `AWS - us-east-1` or `AWS - ap-south-1`).
   * **Read/Write Capacity**: Keep default **Pay as you go (Free tier: 10,000 commands/day)**.
   * **TLS (SSL)**: Ensure it is **Enabled** (checked).
4. Click **Create** (bottom right).

---

### Step 2.2: Copy the `rediss://` Connection URL
1. In your newly created database dashboard, scroll down to the **Connect to your database** section.
2. In the tab list (`redis-cli`, `ioredis`, `Node.js`, `Python`, etc.), click the **ioredis** tab (or check the Node.js connection string).
3. Look for the URL starting with `rediss://`:
   ```
   rediss://default:AbCdEf1234567890@us1-tender-anteater-31234.upstash.io:6379
   ```
   > [!IMPORTANT]
   > Notice the **two 's' letters** in `rediss://`. The second 's' enforces SSL/TLS encryption in transit over public cloud networks.

4. Click the **Copy** button.
5. Save this complete string in your notepad under `REDIS_URL`.

---

## Part 3: Deploy to Render Using `render.yaml` (Blueprint)

Render is a modern cloud hosting platform with native support for Node.js, WebSockets, and continuous deployment from GitHub.

### Step 3.1: Push Your Code to GitHub
Ensure all recent changes in this workspace are pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: prepare cloud deployment configs"
git push origin main
```

---

### Step 3.2: Connect GitHub to Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. In the top navigation bar, click the blue **+ New** button.
3. In the dropdown menu, select **Blueprint**.
   *(A Blueprint reads the `render.yaml` file in your repository to automatically configure the service, build commands, and health checks.)*
4. If this is your first time using Render:
   * Click **Connect GitHub**.
   * Choose your GitHub account and select your repository (e.g., `FIreBaseAntigravityProject`).
5. Click **Connect** next to your repository.

---

### Step 3.3: Configure the Blueprint
Render will scan your repository, detect `render.yaml`, and display the plan:
* **Service Name**: `procurement-coordination-platform`
* **Runtime**: `Node`
* **Build Command**: `npm --prefix frontend install && npm --prefix frontend run build && npm --prefix backend install && npm --prefix backend run build`
* **Start Command**: `node backend/dist/main.js`
* **Health Check Path**: `/health`
* **Plan**: `Starter ($7/mo)` or `Free`.
  * *Tip*: For testing, you can use the **Free** plan. For production pilot demonstrations with farmers, the **Starter ($7/mo)** plan keeps the server awake 24/7 without idle sleeps.

---

### Step 3.4: Enter Your Secrets
Render will ask you to supply the values for the two variables marked with `sync: false` in `render.yaml`:
1. **`MONGODB_URI`**: Paste the string from Part 1, Step 1.4:
   ```
   mongodb+srv://procure_admin:YOUR_PASSWORD@cluster0.abcde.mongodb.net/procurement_prod?retryWrites=true&w=majority
   ```
2. **`REDIS_URL`**: Paste the string from Part 2, Step 2.2:
   ```
   rediss://default:YOUR_TOKEN@us1-tender-anteater-31234.upstash.io:6379
   ```

*(All JWT secrets like `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` will be automatically generated by Render using high-entropy random keys!)*

---

### Step 3.5: Click Apply & Deploy
1. Click the green **Apply** button.
2. Render will begin building your service.
3. Click into the build logs to watch the progress:
   * It installs frontend dependencies and runs Vite build (outputs to `frontend/dist`).
   * It installs backend dependencies and compiles NestJS (outputs to `backend/dist`).
   * It launches the server on port 3000.
   * It verifies `/health`.
4. Once you see **"Your service is live 🎉"**, copy your public URL from the top of the dashboard:
   ```
   https://procurement-coordination-platform.onrender.com
   ```

---

## Part 4: Complete Environment Variables Reference

If you need to view or adjust variables later in **Render Dashboard $\rightarrow$ Your Service $\rightarrow$ Environment**:

| Variable Name | Type | Recommended Value / Format | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Public** | `production` | Enables production optimizations, hides debug stack traces |
| `PORT` | **Public** | `3000` | Internal port where NestJS listens |
| `API_PREFIX` | **Public** | `api/v1` | Prefix for all REST endpoints |
| `APP_NAME` | **Public** | `ProcurementCoordinationPlatform` | System identifier in logs |
| `CORS_ORIGIN` | **Public** | `https://<your-app>.onrender.com` | Allowed browser origins (comma-separated). Set to your Render URL |
| `MONGODB_URI` | 🔒 **Secret** | `mongodb+srv://...` | Connection to MongoDB Atlas cluster |
| `REDIS_URL` | 🔒 **Secret** | `rediss://...` | Connection to Upstash Redis with TLS |
| `JWT_SECRET` | 🔒 **Secret** | Auto-generated by Render (or 64-char hex) | Master encryption secret |
| `JWT_ACCESS_SECRET`| 🔒 **Secret** | Auto-generated by Render (or 64-char hex) | Signs short-lived (15m) access tokens |
| `JWT_ACCESS_EXPIRES_IN`| **Public**| `15m` | Lifetime of access tokens |
| `JWT_REFRESH_SECRET`| 🔒 **Secret**| Auto-generated by Render (or 64-char hex) | Signs 7-day refresh tokens |
| `JWT_REFRESH_EXPIRES_IN`| **Public**| `7d` | Lifetime of refresh tokens |
| `GOVERNMENT_PROVIDER`| **Public**| `MOCK` (or `ESAMRIDHI`) | `MOCK` for pilot/demonstrations, `ESAMRIDHI` for live national portal |
| `MOCK_GOV_LATENCY_MS`| **Public**| `150` | Realistic latency simulation for mock calls |
| `OTP_TTL_SECONDS` | **Public** | `300` | OTP expiration window (5 minutes) |
| `OTP_MAX_ATTEMPTS` | **Public** | `3` | Max verification attempts before invalidation |
| `OTP_THROTTLE_WINDOW_SECONDS`| **Public**| `600` | Rate limit window for OTP requests |
| `RATE_LIMIT_TTL` | **Public** | `60` | Global API rate limiting window (seconds) |
| `RATE_LIMIT_MAX` | **Public** | `100` | Max requests per IP per minute |
| `ESAMRIDHI_API_BASE_URL`| **Public**| `https://api.esamridhi.gov.in/v1` | Base URL for live national pilot |
| `ESAMRIDHI_CLIENT_ID`| 🔒 **Secret**| Leave blank until live pilot onboarding | Government OAuth Client ID |
| `ESAMRIDHI_CLIENT_SECRET`| 🔒 **Secret**| Leave blank until live pilot onboarding | Government OAuth Client Secret |
| `ESAMRIDHI_API_KEY`| 🔒 **Secret**| Leave blank until live pilot onboarding | Government API Gateway Key |

> [!TIP]
> If you ever need to manually generate a strong 256-bit secret key on your local machine, run:
> ```bash
> openssl rand -hex 32
> ```

---

## Part 5: How to Verify the Deployment Succeeded

Run these 5 simple verification steps to confirm everything is operating normally.

### 1. Check the System Health Endpoint (`/health`)
In your browser or terminal, navigate to:
```
https://<your-app-name>.onrender.com/health
```
**Expected Response (HTTP 200 OK)**:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-14T10:00:00.000Z",
  "uptimeSeconds": 45,
  "services": {
    "database": {
      "status": "connected",
      "readyState": 1
    },
    "cache": {
      "status": "connected"
    },
    "governmentIntegration": {
      "provider": "MOCK_GOVERNMENT_PROVIDER",
      "status": "connected"
    }
  }
}
```
* If `database.status` is `"connected"`, MongoDB Atlas is working!
* If `cache.status` is `"connected"`, Upstash Redis is working!

---

### 2. Verify the Frontend Web Interface
Open `https://<your-app-name>.onrender.com` in your browser.
* The National MSP Procurement Coordination Platform portal will appear.
* You should see the login interface with three role tabs: **Farmer Portal**, **Centre Operations**, and **Government Authority**.
* Open browser Developer Tools (Press F12 $\rightarrow$ Console tab):
  * You should see: `[Realtime] No auth token available; skipping WebSocket connection until authenticated.` (This is normal before logging in).
  * There should be zero 404 or missing asset errors.

---

### 3. Test Farmer Authentication (OTP Flow)
In the browser:
1. Select the **Farmer Portal** tab.
2. Enter mobile number: `9876543210`.
3. Click **Send Verification Code**.
4. In demo/mock mode, the OTP code is automatically displayed in the UI banner (e.g. `123456` or generated 6-digit code).
5. Enter the OTP and click **Verify & Enter Portal**.
6. You will be logged in to the Farmer Dashboard showing wheat bookings and Sanwer Mandi quota!

---

### 4. Test Centre Operator & Admin Portals
The system automatically bootstraps initial operational accounts upon first deployment:

| Portal | Username / Identifier | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Centre Operations** | `operator` | `Operator@123` | Sanwer Krishi Upaj Mandi (`CENTRE-MP-IND-01`), Weighbridge, Quality Testing |
| **Government Authority**| `admin` | `Admin@123` | National Command Dashboard, Regional Analytics, State Aggregation |

1. Switch to the **Centre Operations** tab.
2. Enter `operator` and `Operator@123`. Click **Sign In**.
3. You will enter the live Mandi Operations Console showing Check-In, Weighment, Quality Testing, and Procurement counters!

---

### 5. Verify the WebSocket Realtime Gateway
Once logged into the Centre Operations or Government Command Dashboard:
* Check the header status badge in the top right.
* It will display a green indicator: **"Realtime Gateway Connected"**.
* In Developer Tools Console, you will see:
  ```
  [Realtime] WebSocket connected! Socket ID: xxxxxxxx
  ```

---

## Part 6: Set Up Free 24/7 Uptime Monitoring (UptimeRobot)

Render free tier web services spin down after 15 minutes of inactivity. Setting up a free monitor on **UptimeRobot** pings `/health` every 5 minutes, keeping your service warm and immediately notifying you if anything breaks.

1. Go to [uptimerobot.com](https://uptimerobot.com) and create a free account.
2. Click **+ Add New Monitor** (top left).
3. Configure the monitor:
   * **Monitor Type**: `HTTP(s)`
   * **Friendly Name**: `Procurement Coordination Platform`
   * **URL (or IP)**: `https://<your-app-name>.onrender.com/health`
   * **Monitoring Interval**: `5 minutes`
   * **Monitor Timeout**: `30 seconds`
4. Under **Alert Contacts To Notify**, check the box next to your email address.
5. Click **Create Monitor**.
* That's it! You now have 24/7 automated uptime monitoring at zero cost.

---

## Part 7: Common Failure Points & How to Fix Them

### ❌ Issue 1: MongoDB Connection Error (`MongoServerSelectionError` / Connection Timeout)
* **What you see in Render logs**:
  ```
  MongoServerSelectionError: connection timed out or querySrv ETIMEOUT
  ```
* **Root Cause**: MongoDB Atlas is blocking incoming connections from Render.
* **Fix**:
  1. Open [cloud.mongodb.com](https://cloud.mongodb.com).
  2. Go to **Security** $\rightarrow$ **Network Access**.
  3. Ensure there is an entry with IP Address `0.0.0.0/0` (Allow Access from Anywhere).
  4. If your password has special characters (`@`, `/`, `#`), ensure you URL-encoded them or generate an alphanumeric password in **Database Access**.

---

### ❌ Issue 2: Redis Connection Warning (`Using resilient in-memory store`)
* **What you see in Render logs**:
  ```
  Could not connect to Redis (...). Using resilient in-memory store.
  ```
* **Root Cause**: `REDIS_URL` was entered with `redis://` instead of `rediss://`, or the password was truncated.
* **Fix**:
  1. Open [console.upstash.com](https://console.upstash.com).
  2. In your database dashboard, go to the **ioredis** tab.
  3. Copy the URL starting with `rediss://` (with two 's' letters).
  4. In Render Dashboard $\rightarrow$ Your Service $\rightarrow$ **Environment**, update `REDIS_URL` and click **Save Changes**.

---

### ❌ Issue 3: Build Fails with `Out of Memory` or Exit Code 137
* **What you see in Render logs**:
  ```
  Killed
  npm ERR! code 137
  ```
* **Root Cause**: Building both frontend and backend in parallel on a low-memory free builder ran out of memory.
* **Fix**:
  * Our `render.yaml` uses sequential build commands (`npm --prefix frontend run build && npm --prefix backend run build`) which consumes less than 300MB RAM.
  * If this occurs, clear build cache: In Render Dashboard, click **Manual Deploy** $\rightarrow$ **Clear build cache & deploy**.

---

### ❌ Issue 4: WebSocket Shows "Disconnected" on the Live URL
* **What you see in the browser**:
  * Dashboard header says "Disconnected" or WebSocket connection fails.
* **Root Cause**: `CORS_ORIGIN` does not match the exact deployed Render URL.
* **Fix**:
  1. Check your browser URL bar (e.g. `https://procurement-platform.onrender.com`).
  2. Go to Render Dashboard $\rightarrow$ **Environment**.
  3. Set `CORS_ORIGIN` to:
     ```
     https://procurement-platform.onrender.com
     ```
     *(Include `https://`, do not add a trailing slash).*
  4. Click **Save Changes** (Render will redeploy in 30 seconds).

---

### ❌ Issue 5: App Takes 40 Seconds to Open After Inactivity
* **Root Cause**: You are on Render's **Free Plan**, which puts services to sleep after 15 minutes of zero traffic.
* **Fix**:
  * Option 1 (Free): Ensure UptimeRobot (Part 6) is active. Pinging every 5 minutes prevents the instance from sleeping.
  * Option 2 (Production): In Render Dashboard $\rightarrow$ **Settings** $\rightarrow$ Change plan to **Starter ($7/month)** for dedicated always-on operation.

---

## Congratulations! 🎉

Your National MSP Procurement Coordination Platform is now live on the internet, secured with TLS certificates, connected to managed cloud databases, and monitored 24/7.
