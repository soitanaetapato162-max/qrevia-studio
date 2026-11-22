
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { to, subject, message } = JSON.parse(event.body || "{}");

    if (!to || !subject || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing email details" })
      };
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Email service not configured" })
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "QREVIA Studio <noreply@qreviastudio.com>",
        to: [to],
        subject,
        text: message
      })
    });

    const data = await response.json();

    return {
      statusCode: response.ok ? 200 : 502,
      body: JSON.stringify(
        response.ok
          ? { success: true, id: data.id }
          : { error: "Email delivery failed" }
      )
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unable to send email" })
    };
  }
};
