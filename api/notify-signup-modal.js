import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || '');

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
    const { countryCode, countryName, trigger, fileCount } = req.body;

    if (!countryCode) {
      return res.status(400).json({ error: 'Country code is required' });
    }

    // Check API key configuration
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('[notify-signup-modal] Email service API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    const adminEmail = 'eran.samra@meshpayments.com';
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    console.log('[notify-signup-modal] Sending signup modal notification...');
    console.log('[notify-signup-modal] Country:', countryCode, countryName);
    console.log('[notify-signup-modal] Notifying:', adminEmail);

    // Send notification email to admin
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: `Non-Israel User Opened Signup Modal - ${countryName || countryCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Signup Modal Opened - Non-Israel User</h2>
          <p>A user from outside Israel has opened the signup modal:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Country:</strong> ${countryName || 'Unknown'} (${countryCode})</p>
            <p style="margin: 5px 0;"><strong>Trigger:</strong> ${trigger || 'unknown'}</p>
            ${fileCount ? `<p style="margin: 5px 0;"><strong>Files Selected:</strong> ${fileCount}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This is an automated notification from the Receipt to CSV Bot.</p>
        </div>
      `,
    });

    if (error) {
      console.error('[notify-signup-modal] Resend error:', error);
      throw new Error(error.message || 'Failed to send notification email');
    }

    console.log('[notify-signup-modal] Notification email sent successfully:', data?.id);
    return res.status(200).json({ ok: true, messageId: data?.id });
  } catch (e) {
    console.error('[notify-signup-modal] Error sending notification email:', e);
    return res.status(500).json({ 
      error: e.message || 'Failed to send notification email',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}

