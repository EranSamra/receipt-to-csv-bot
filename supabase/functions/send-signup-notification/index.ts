import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SignupNotificationRequest {
  email: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, userId }: SignupNotificationRequest = await req.json();

    console.log(`[send-signup-notification] New user signup: ${email}`);

    const emailResponse = await resend.emails.send({
      from: "Mesh AI <onboarding@resend.dev>",
      to: ["Eran.samra@meshpayments.com"],
      subject: "New User Signup - Mesh Receipt Scanner",
      html: `
        <h1>New User Signup</h1>
        <p>A new user has signed up for the Mesh Receipt Scanner:</p>
        <ul>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>User ID:</strong> ${userId}</li>
          <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>Best regards,<br>Mesh Receipt Scanner</p>
      `,
    });

    console.log("Signup notification sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-signup-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
