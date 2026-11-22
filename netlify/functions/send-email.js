
const crypto = require("node:crypto");

const reply = (statusCode, data) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  const expected = process.env.EMAIL_INTERNAL_SECRET;
  const provided = event.headers?.["x-email-secret"];

  if (!expected || !provided ||
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(expected)
      )) {
    return reply(401, { error: "Unauthorized" });
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return reply(500, { error: "Email not configured" });
  }

  try {
    const { to, subject, message } =
      JSON.parse(event.body || "{}");

    if (
      typeof to !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.length > 200 ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 10000
    ) {
      return reply(400, { error: "Invalid email details" });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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

    if (!response.ok) {
      console.error("Resend error:", response.status, data);
      return reply(502, { error: "Email delivery failed" });
    }

    return reply(200, { success: true, id: data.id });
  } catch (error) {
    console.error("Email function error:", error);
    return reply(500, { error: "Email request failed" });
  }
};
