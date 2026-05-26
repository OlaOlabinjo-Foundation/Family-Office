# Go live without paying for Render

Vercel (frontend) stays **free**. You only need a **public HTTPS URL** for the API so sign-in works. These options cost **$0**.

---

## Option A — Cloudflare Tunnel + your PC (recommended, $0)

Run the API on the same Windows machine you already use for development. Cloudflare gives you a free HTTPS link. No Render, no credit card.

### 1. Build and configure (once)

```powershell
cd "C:\Users\Yomi\Desktop\OLA OLABINJO FAMILY OFFICE\Family office portal"
npm run build
npm run seed-user -w server -- lead "Family Office Lead" lead "YourSecurePassword"
```

Create `server/.env` (do not commit) with at least:

```
NODE_ENV=production
FAMILY_OFFICE_AUTH=sqlite
FAMILY_OFFICE_SQLITE=server/data/family-office.sqlite
JWT_SECRET=use-a-long-random-string-at-least-32-characters
FAMILY_OFFICE_MFA_KEY=another-long-random-string
FAMILY_OFFICE_CORS_ORIGINS=https://YOUR-PROJECT.vercel.app
```

### 2. Install Cloudflare Tunnel

Download **cloudflared** from [developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation)  
Or: `winget install Cloudflare.cloudflared`

### 3. Start the API, then the tunnel

**Terminal 1** — API (serves UI + API on port 8787):

```powershell
npm start
```

Wait until you see: `Command centre API listening on http://0.0.0.0:8787`

**Terminal 2** — public HTTPS URL:

```powershell
cloudflared tunnel --url http://localhost:8787
```

Copy the `https://….trycloudflare.com` URL (shown in the terminal).

### 4. Connect Vercel

Vercel → **Environment variables**:

| Name | Value |
|------|--------|
| `COMMAND_CENTRE_API_URL` | `https://xxxx.trycloudflare.com` (from step 3) |

**Redeploy** Vercel.

### Notes

- Your PC must stay on and both terminals running while others use the portal.
- Quick Tunnel URLs can change when you restart cloudflared. For a **fixed** URL, create a free Cloudflare account and a [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/).
- Run `npm run backup` regularly; data lives on your machine under `server/data/`.

---

## Option B — Fly.io (free allowance, small VM)

Fly.io includes a free tier (credit card may be required for verification; stay within free limits).

1. Install [flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. From the repo root: `fly launch` (use existing [`fly.toml`](../fly.toml)).
3. Create a volume: `fly volumes create fo_data --size 1 --region lhr`
4. Set secrets: `fly secrets set JWT_SECRET=... FAMILY_OFFICE_MFA_KEY=... FAMILY_OFFICE_CORS_ORIGINS=https://your.vercel.app`
5. `fly deploy`
6. Use `https://YOUR-APP.fly.dev` as `COMMAND_CENTRE_API_URL` on Vercel.

See [`fly.toml`](../fly.toml) and [`Dockerfile`](../Dockerfile).

---

## Option C — Oracle Cloud “Always Free” VM ($0)

A small Linux VM that runs 24/7 without Render:

1. Create an **Always Free** Ampere VM on [Oracle Cloud](https://www.oracle.com/cloud/free/).
2. Install Node 22, clone the repo, `npm ci && npm run build`.
3. Run with `pm2` or systemd: `npm start` on port 8787.
4. Point a domain or use Cloudflare Tunnel on the VM for HTTPS.
5. Set `COMMAND_CENTRE_API_URL` on Vercel to that HTTPS URL.

More setup, but no monthly fee and data stays on your VM.

---

## Option D — Render free tier (limited)

[`render.free.yaml`](../render.free.yaml) uses Render’s **free** web plan (no paid disk).

**Warning:** without a persistent disk, the SQLite database **resets** when the service redeploys or sleeps. Only use for testing, not real family office data.

---

## Skip Vercel entirely (office network only)

On one machine in the office:

```powershell
npm start
```

Open **http://localhost:8787** — UI and API together. No Vercel, no tunnel. Only works on that network unless you add Option A’s tunnel.

---

## Summary

| Option | Cost | Data safe? | 24/7? |
|--------|------|------------|-------|
| **A — Cloudflare + your PC** | $0 | Yes (on your disk) | While PC is on |
| **B — Fly.io** | $0* | Yes (volume) | Yes |
| **C — Oracle Free VM** | $0 | Yes | Yes |
| **D — Render free** | $0 | No (resets) | Spins down |
| **Render starter + disk** | Paid | Yes | Yes |

For most family offices starting out: **Option A** is the fastest and costs nothing.
