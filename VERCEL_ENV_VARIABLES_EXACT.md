# 📋 Exact Vercel Environment Variables to Add

Copy and paste these **exact** values into your Vercel dashboard.

## 🔑 Step-by-Step: Add to Vercel

1. Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New**
3. For each variable below:
   - Paste the **Name** exactly as shown
   - Paste the **Value** exactly as shown
   - Select **all environments** (Production, Preview, Development)
   - Click **Save**

---

## ✅ REQUIRED Variables (Copy These)

### 1. Gemini API Key
```
Name: GEMINI_API_KEY
Value: AIzaSyDFPgjOr32jptNdfFjanuP2Qfy7b2vXBTU
```

### 2. PostHog Analytics Key
```
Name: VITE_POSTHOG_KEY
Value: phc_kSsmb6ik2SkurBjueH4AFYPK4D50w9yTPIwKdb0Xtc3
```

### 3. Supabase Project URL
```
Name: VITE_SUPABASE_URL
Value: https://cuqwxshipriohsmrymzy.supabase.co
```

---

## ⚠️ YOU NEED TO GET THESE VALUES

### 4. Resend API Key (for email features)
```
Name: RESEND_API_KEY
Value: [GET FROM: https://resend.com/api-keys]
```
**How to get:**
1. Go to https://resend.com
2. Sign up/login
3. Go to API Keys section
4. Create a new API key
5. Copy the key (starts with `re_`)
6. Paste it as the value above

### 5. Email From Address
```
Name: EMAIL_FROM
Value: Mesh AI <onboarding@resend.dev>
```
**Note:** You can use `onboarding@resend.dev` for free tier, or use your own verified domain.

### 6. Supabase Anon/Public Key
```
Name: VITE_SUPABASE_PUBLISHABLE_KEY
Value: [GET FROM: Supabase Dashboard → Settings → API]
```
**How to get:**
1. Go to https://supabase.com/dashboard
2. Select your project (ID: cuqwxshipriohsmrymzy)
3. Go to **Settings** → **API**
4. Copy the **anon/public** key
5. Paste it as the value above

---

## 🔒 OPTIONAL (Only if using Supabase cache in serverless functions)

### 7. Supabase Service Role Key (Backend Only)
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: [GET FROM: Supabase Dashboard → Settings → API]
```
**⚠️ WARNING:** This key has admin access. Only use in serverless functions, never in client code.

**How to get:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **service_role** key (keep it secret!)
5. Paste it as the value above

---

## 📝 Quick Copy-Paste Checklist

Copy each line and add to Vercel:

```
✅ GEMINI_API_KEY = AIzaSyDFPgjOr32jptNdfFjanuP2Qfy7b2vXBTU
✅ VITE_POSTHOG_KEY = phc_kSsmb6ik2SkurBjueH4AFYPK4D50w9yTPIwKdb0Xtc3
✅ VITE_SUPABASE_URL = https://cuqwxshipriohsmrymzy.supabase.co
⏳ RESEND_API_KEY = [GET FROM RESEND.COM]
⏳ EMAIL_FROM = Mesh AI <onboarding@resend.dev>
⏳ VITE_SUPABASE_PUBLISHABLE_KEY = [GET FROM SUPABASE DASHBOARD]
```

---

## 🚀 After Adding Variables

1. **Save all variables** in Vercel
2. Go to **Deployments** tab
3. Click **Redeploy** on the latest deployment
4. Wait for deployment to complete
5. Test your application!

---

## 🔍 Verify Variables Are Set

After redeploying, you can verify in Vercel:
1. Go to **Deployments** → Latest deployment
2. Click on the deployment
3. Check **Function Logs** for any "missing environment variable" errors

---

## 📞 Need Help?

- **Resend API Key:** https://resend.com/api-keys
- **Supabase Keys:** https://supabase.com/dashboard/project/cuqwxshipriohsmrymzy/settings/api
- **Gemini API Key:** Already provided above ✅
- **PostHog Key:** Already provided above ✅

---

**Last Updated:** Based on current codebase values

