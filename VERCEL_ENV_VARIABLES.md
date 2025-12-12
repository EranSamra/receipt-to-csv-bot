# Vercel Environment Variables Guide

This document lists all environment variables that need to be configured in your Vercel project.

## 🔑 Required Environment Variables

### 1. Gemini AI API Key
**Variable Name:** `GEMINI_API_KEY`  
**Description:** API key for Google Gemini AI (used for receipt extraction)  
**Where to get it:** [Google AI Studio](https://makersuite.google.com/app/apikey)  
**Used in:**
- `api/extract-receipts.js`
- `supabase/functions/extract-receipts/index.ts`

**Example:**
```
GEMINI_API_KEY=AIzaSyAQrLDliNV3hdbYWYBxaESnv-HRinRFDUY
```

---

### 2. Email Service API Key (Resend - Recommended)
**Variable Name:** `RESEND_API_KEY`  
**Description:** API key for Resend email service (used for sending CSV files)  
**Where to get it:** [Resend.com](https://resend.com/api-keys)  
**Used in:**
- `api/send-csv.js`
- `api/notify-signup.js`
- `api/notify-signup-modal.js`

**Example:**
```
RESEND_API_KEY=re_your_api_key_here
```

**Alternative:** If you prefer SendGrid, use `SENDGRID_API_KEY` instead.

---

### 3. Email From Address
**Variable Name:** `EMAIL_FROM`  
**Description:** Email address to send emails from  
**Used in:**
- `api/send-csv.js`
- `api/notify-signup.js`
- `api/notify-signup-modal.js`

**Example:**
```
EMAIL_FROM=Mesh AI <onboarding@resend.dev>
```

**Note:** For Resend free tier, you can use `onboarding@resend.dev`. For your own domain, verify it in Resend first.

---

### 4. Supabase Project URL (Frontend)
**Variable Name:** `VITE_SUPABASE_URL`  
**Description:** Your Supabase project URL (for client-side usage)  
**Where to get it:** Supabase Dashboard → Settings → API  
**Used in:**
- `src/integrations/supabase/client.ts`

**Example:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
```

---

### 5. Supabase Anon/Public Key (Frontend)
**Variable Name:** `VITE_SUPABASE_PUBLISHABLE_KEY`  
**Description:** Your Supabase anon/public key (for client-side usage)  
**Where to get it:** Supabase Dashboard → Settings → API  
**Used in:**
- `src/integrations/supabase/client.ts`

**Example:**
```
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### 6. Supabase Project URL (Backend)
**Variable Name:** `SUPABASE_URL`  
**Description:** Your Supabase project URL (for serverless functions)  
**Where to get it:** Supabase Dashboard → Settings → API  
**Used in:**
- `api/cache-utils.js` (if using Supabase cache)

**Example:**
```
SUPABASE_URL=https://your-project.supabase.co
```

**Note:** Can be the same as `VITE_SUPABASE_URL`

---

### 7. Supabase Service Role Key (Backend)
**Variable Name:** `SUPABASE_SERVICE_ROLE_KEY`  
**Description:** Your Supabase service role key (for serverless functions with admin access)  
**Where to get it:** Supabase Dashboard → Settings → API  
**⚠️ Security Warning:** This key has admin access. Never expose it in client-side code.  
**Used in:**
- `api/cache-utils.js` (if using Supabase cache)

**Example:**
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Alternative:** Can use `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY` if service role is not needed.

---

### 8. PostHog API Key (Optional)
**Variable Name:** `VITE_POSTHOG_KEY`  
**Description:** PostHog API key for analytics  
**Where to get it:** [PostHog Dashboard](https://app.posthog.com/project/settings)  
**Used in:**
- `src/lib/posthog.ts` (currently hardcoded, should be moved to env var)

**Example:**
```
VITE_POSTHOG_KEY=phc_kSsmb6ik2SkurBjueH4AFYPK4D50w9yTPIwKdb0Xtc3
```

**Note:** Currently hardcoded in the code. Consider moving to environment variable.

---

## 📋 Quick Setup Checklist

### Step 1: Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable listed above
4. Select the appropriate environments (Production, Preview, Development)
5. Click **Save**

### Step 2: Required Variables (Minimum)

For basic functionality, you need at least:
- ✅ `GEMINI_API_KEY` - **Required** for receipt extraction
- ✅ `RESEND_API_KEY` or `SENDGRID_API_KEY` - **Required** for email features
- ✅ `EMAIL_FROM` - **Required** for email features
- ✅ `VITE_SUPABASE_URL` - **Required** if using Supabase auth
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` - **Required** if using Supabase auth

### Step 3: Optional Variables

- `SUPABASE_URL` - Only if using Supabase cache in serverless functions
- `SUPABASE_SERVICE_ROLE_KEY` - Only if using Supabase cache with admin access
- `VITE_POSTHOG_KEY` - Only if using PostHog analytics (currently hardcoded)

### Step 4: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Or trigger a new deployment by pushing to your repository

---

## 🔒 Security Best Practices

1. **Never commit API keys to git** - Always use environment variables
2. **Use different keys for different environments** - Production, Preview, Development
3. **Rotate keys regularly** - Especially if exposed or compromised
4. **Use service role keys only in serverless functions** - Never in client-side code
5. **Restrict API key permissions** - Only grant necessary permissions

---

## 🧪 Testing Environment Variables

### Check if variables are set (in Vercel Function):

```javascript
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Missing');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'Missing');
```

### Check if variables are set (in Frontend):

```javascript
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing');
console.log('VITE_POSTHOG_KEY:', import.meta.env.VITE_POSTHOG_KEY ? 'Set' : 'Missing');
```

**Note:** In Vite, only variables prefixed with `VITE_` are exposed to the client.

---

## 📝 Environment Variable Reference Table

| Variable Name | Required | Type | Used In | Environment |
|--------------|----------|------|---------|-------------|
| `GEMINI_API_KEY` | ✅ Yes | Server | API routes | All |
| `RESEND_API_KEY` | ✅ Yes* | Server | Email APIs | All |
| `SENDGRID_API_KEY` | ⚠️ Alternative | Server | Email APIs | All |
| `EMAIL_FROM` | ✅ Yes* | Server | Email APIs | All |
| `VITE_SUPABASE_URL` | ✅ Yes** | Client | Supabase client | All |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes** | Client | Supabase client | All |
| `SUPABASE_URL` | ⚠️ Optional | Server | Cache utils | All |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Optional | Server | Cache utils | All |
| `VITE_POSTHOG_KEY` | ⚠️ Optional | Client | Analytics | All |
| `NODE_ENV` | 🔄 Auto | Server | Various | Auto-set by Vercel |

\* Required only if using email features  
\** Required only if using Supabase authentication

---

## 🚨 Troubleshooting

### "API key not configured" error
- Check that the environment variable is set in Vercel
- Ensure you've redeployed after adding the variable
- Verify the variable name matches exactly (case-sensitive)

### "Email service not configured" error
- Make sure `RESEND_API_KEY` or `SENDGRID_API_KEY` is set
- Check that `EMAIL_FROM` is set
- Redeploy after adding variables

### Supabase connection errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set
- Check that the keys are correct in Supabase dashboard
- Ensure variables are prefixed with `VITE_` for client-side usage

### PostHog not working
- Currently hardcoded in `src/lib/posthog.ts`
- Consider moving to `VITE_POSTHOG_KEY` environment variable
- Check browser console for PostHog initialization messages

---

## 📚 Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Resend API Keys](https://resend.com/api-keys)
- [Supabase API Settings](https://supabase.com/dashboard/project/_/settings/api)
- [PostHog Project Settings](https://app.posthog.com/project/settings)

---

**Last Updated:** 2024

