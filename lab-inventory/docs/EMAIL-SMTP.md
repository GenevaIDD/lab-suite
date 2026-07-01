# Custom SMTP (reliable auth emails)

Supabase's **built-in** email sender is rate-limited (~2–4/hour) and meant only
for testing — that's the "email rate limit exceeded" you hit on invites, and why
invite/recovery links sometimes arrive late and expire. Pointing Supabase at your
own SMTP provider removes the limit and makes these work normally:

- **Invite** emails (the in-app "Invite user" button)
- **Password recovery** ("Forgot password?" on the login screen)
- Magic links / email confirmations

You don't need Supabase Pro for this.

> Until this is set up, keep using the admin **🔑 Set password** button on the
> Users page — it adds/resets people with no email at all.

---

## Prerequisite: a domain you control
Reputable SMTP providers only let you send to arbitrary recipients (e.g.
`@lshtm.ac.uk`, `@unige.ch`) from a **verified sending domain** — you prove
ownership by adding DNS records. So you need a domain whose DNS you can edit
(e.g. a `genevaidd.*` domain). You **can't** verify `lshtm.ac.uk` /
`unige.ch` yourself — those are controlled by their IT departments.

If you don't have a domain, register a cheap one (Cloudflare/Namecheap, ~$10/yr)
and use a sender like `noreply@yourdomain.org`.

---

## Setup with Resend (recommended — free tier: 3k emails/mo)

### 1. Verify your domain in Resend
1. Create an account at **resend.com**.
2. **Domains → Add Domain** → enter your domain.
3. Add the **DNS records** Resend shows (an SPF/`MX` record + a DKIM `TXT`
   record) at your DNS host. Wait for Resend to mark the domain **Verified**
   (minutes to a few hours).

### 2. Create an API key
- **API Keys → Create API Key** (Sending access is enough). Copy it — it starts
  with `re_…`. This is the SMTP password.

### 3. Enter SMTP settings in Supabase
Supabase dashboard → **Authentication → Emails → SMTP Settings** →
enable **Custom SMTP**:

| Field | Value |
|---|---|
| Sender email | `noreply@yourdomain.org` (must be on the verified domain) |
| Sender name | `Uvira Lab Management` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `re_…` API key |

Save.

### 4. Raise the email rate limit
Supabase → **Authentication → Rate Limits** → increase **"Rate limit for sending
emails"** (the built-in default is tiny). 30–100/hour is plenty.

### 5. Confirm the redirect URL is allowlisted
Already done earlier, but verify: **Authentication → URL Configuration → Redirect
URLs** contains `https://lab-inventory-steel.vercel.app/set-password`. Both invite
and password-recovery links land there.

---

## Test it
1. **Invite:** Users page → Invite a test address you control → it should arrive
   within seconds from your domain (check spam the first time).
2. **Reset:** Login screen → **Forgot password?** → enter that address → the reset
   email lands → clicking it opens `/set-password` to choose a new password.

## Notes
- Any SMTP provider works (SendGrid, Mailgun, Postmark, AWS SES, Brevo) — the
  Supabase fields are the same; only host/port/credentials differ. The
  verified-domain requirement applies to all of them.
- First emails sometimes land in spam until the domain builds reputation;
  a DMARC record helps.
