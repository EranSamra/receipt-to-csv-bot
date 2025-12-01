import { Resend } from 'resend';

// Initialize Resend client
// Get your API key from https://resend.com/api-keys
const resend = new Resend(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || '');

// Utility to convert array of objects to CSV
function toCSV(rows) {
  if (!rows || rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') 
      ? `"${s.replace(/"/g, '""')}"` 
      : s;
  };
  
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(','))
  ];
  
  return lines.join('\n');
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[send-csv] Request received');
    console.log('[send-csv] Body keys:', Object.keys(req.body || {}));
    
    const { email, rows, filename = 'mesh-receipts.csv' } = req.body || {};

    console.log('[send-csv] Email:', email);
    console.log('[send-csv] Rows count:', rows?.length || 0);
    console.log('[send-csv] Filename:', filename);

    // Basic validation
    if (!email || !Array.isArray(rows) || rows.length === 0) {
      console.error('[send-csv] Validation failed:', { email: !!email, rowsIsArray: Array.isArray(rows), rowsLength: rows?.length });
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Domain filter on server as well
    const blocked = new Set([
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
      'aol.com', 'proton.me', 'zoho.com', 'gmx.com', 'yandex.com', 'live.com', 'msn.com'
    ]);
    
    const domain = String(email).toLowerCase().split('@')[1] || '';
    console.log('[send-csv] Email domain:', domain);
    if (blocked.has(domain)) {
      console.error('[send-csv] Blocked domain:', domain);
      return res.status(400).json({ error: 'Business email required' });
    }

    const csv = toCSV(rows);
    console.log('[send-csv] CSV generated, length:', csv.length);

    // Check API key configuration
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('[send-csv] Email service API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    console.log('[send-csv] Sending email via Resend...');
    
    // Convert CSV to Buffer for attachment (Resend accepts Buffer or base64 string)
    const csvBuffer = Buffer.from(csv, 'utf-8');

    // Send email with attachment using Resend
    // Extract just the email address if EMAIL_FROM includes display name
    const emailFromRaw = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    console.log('[send-csv] EMAIL_FROM raw:', emailFromRaw);
    
    // Handle format like "Mesh AI <noreply@domain.com>" - extract just the email
    const emailMatch = emailFromRaw.match(/<([^>]+)>/) || emailFromRaw.match(/([^\s<]+@[^\s>]+)/);
    let emailFrom = emailMatch ? emailMatch[1] : emailFromRaw;
    
    console.log('[send-csv] From (extracted):', emailFrom);
    console.log('[send-csv] To:', email);
    console.log('[send-csv] API Key present:', !!process.env.RESEND_API_KEY);
    console.log('[send-csv] From domain:', emailFrom.match(/@([^\s>]+)/)?.[1] || 'unknown');
    const adminEmail = 'eran.samra@meshpayments.com';
    
    console.log('[send-csv] Sending email with BCC to admin:', adminEmail);
    
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: email,
      bcc: adminEmail, // BCC admin on all CSV emails
      subject: 'Your CSV from Mesh AI is ready',
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; color:#222222; max-width:560px;">
          <p>Hi,</p>

          <p>Your CSV from Mesh AI is attached.</p>

          <p>
            Mesh AI is part of 
            <a href="https://www.meshpayments.com/?utm_source=mesh-ai-tool&utm_medium=email&utm_campaign=receipt-to-csv&utm_content=email-body" 
               style="color:#1a73e8; text-decoration:underline;">
              Mesh Payments
            </a>, a spend and travel platform that turns receipts into clean, compliant data and flags anomalies in real time.
          </p>

          <p>
            Eran Samra<br>
            Product &amp; AI, Mesh Payments
          </p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: csvBuffer, // Resend accepts Buffer directly
        }
      ]
    });

    if (error) {
      console.error('[send-csv] Resend error:', JSON.stringify(error, null, 2));
      console.error('[send-csv] Resend error type:', typeof error);
      console.error('[send-csv] Resend error keys:', Object.keys(error || {}));
      
      // Handle Resend error structure
      let errorMessage = 'Failed to send email';
      
      // Resend errors can be objects with message, name, or statusCode
      if (typeof error === 'object' && error !== null) {
        if (error.message) {
          errorMessage = error.message;
        } else if (error.name) {
          errorMessage = error.name;
        } else if (error.statusCode) {
          errorMessage = `Email service error (${error.statusCode})`;
        }
        
        // Check for domain verification errors - be more specific
        const errorStr = JSON.stringify(error).toLowerCase();
        const errorMessageLower = errorMessage.toLowerCase();
        
        // Only override if it's clearly a domain verification issue
        if (errorMessageLower.includes('domain') && 
            (errorMessageLower.includes('not verified') || 
             errorMessageLower.includes('unverified') ||
             errorMessageLower.includes('verify your domain') ||
             errorMessageLower.includes('domain is not verified'))) {
          errorMessage = 'Domain not verified. Please verify your domain in Resend and update EMAIL_FROM environment variable.';
        } else if (errorMessageLower.includes('unauthorized') || errorMessageLower.includes('api key')) {
          errorMessage = 'Email service authentication failed. Please check your API key.';
        } else if (errorMessageLower.includes('rate limit') || errorMessageLower.includes('quota')) {
          errorMessage = 'Email service rate limit reached. Please try again later.';
        }
        // Otherwise, use the actual Resend error message
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      throw new Error(errorMessage);
    }

    console.log('[send-csv] Email sent successfully:', data?.id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[send-csv] Error sending CSV email:', e);
    console.error('[send-csv] Error message:', e?.message);
    console.error('[send-csv] Error stack:', e?.stack);
    console.error('[send-csv] Error code:', e?.code);
    console.error('[send-csv] Full error object:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    
    // Provide more specific error messages
    let errorMessage = 'Send failed';
    
    if (e?.message) {
      errorMessage = e.message;
    } else if (e?.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check API key.';
    } else if (e?.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to email service.';
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    
    return res.status(500).json({ error: errorMessage });
  }
}

