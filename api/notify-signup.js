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
    const { userEmail, userId } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Check API key configuration
    const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('[notify-signup] Email service API key not configured');
      return res.status(500).json({ error: 'Email service not configured. Please contact support.' });
    }

    const adminEmail = 'eran.samra@meshpayments.com';
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    console.log('[notify-signup] Sending signup notification...');
    console.log('[notify-signup] New user:', userEmail);
    console.log('[notify-signup] Notifying:', adminEmail);

    // Send notification email to admin
    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: adminEmail,
      subject: 'New User Signup - Receipt to CSV Bot',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New User Signup Notification</h2>
          <p>A new user has signed up for the Receipt to CSV Bot:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
            ${userId ? `<p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>` : ''}
            <p style="margin: 5px 0;"><strong>Signup Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This is an automated notification from the Receipt to CSV Bot.</p>
        </div>
      `,
    });

    if (error) {
      console.error('[notify-signup] Resend error:', error);
      throw new Error(error.message || 'Failed to send notification email');
    }

    console.log('[notify-signup] Notification email sent successfully:', data?.id);
    return res.status(200).json({ ok: true, messageId: data?.id });
  } catch (e) {
    console.error('[notify-signup] Error sending notification email:', e);
    return res.status(500).json({ 
      error: e.message || 'Failed to send notification email',
      details: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}

