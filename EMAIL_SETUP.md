# Email Setup Guide - CSV Sending Feature

## Quick Setup with Resend (Recommended)

Resend is the easiest email service to set up and works great with Vercel.

### Step 1: Get Resend API Key

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account (100 emails/day free)
3. Go to [API Keys](https://resend.com/api-keys)
4. Click "Create API Key"
5. Copy your API key (starts with `re_`)

### Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

   **For Production:**
   - `RESEND_API_KEY` = `your_resend_api_key_here`
   - `EMAIL_FROM` = `Mesh AI <onboarding@resend.dev>` (or your verified domain)

   **Note:** For the free tier, you can use `onboarding@resend.dev` as the sender email. To use your own domain, verify it in Resend first.

### Step 3: Redeploy

After adding environment variables, redeploy your project:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment

### Step 4: Test

Try sending a CSV to a business email address. It should work!

## Alternative: SendGrid Setup

If you prefer SendGrid:

1. Sign up at [https://sendgrid.com](https://sendgrid.com)
2. Create an API key
3. Add to Vercel:
   - `SENDGRID_API_KEY` = `your_sendgrid_api_key`
   - `EMAIL_FROM` = `Mesh AI <no-reply@yourdomain.com>`

The code will automatically use SendGrid if `RESEND_API_KEY` is not set.

## Local Development

For local testing, create a `.env` file in the project root:

```env
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM=Mesh AI <onboarding@resend.dev>
```

Then restart your local server.

## Troubleshooting

- **"Email service not configured"**: Make sure `RESEND_API_KEY` is set in Vercel environment variables
- **"Business email required"**: The email domain is blocked (Gmail, Yahoo, etc.)
- **Email not received**: Check spam folder, verify sender email is correct

