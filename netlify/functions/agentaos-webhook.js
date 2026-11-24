const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const secret = process.env.AGENTAOS_WEBHOOK_SECRET;

  if (!secret) {
    return { statusCode: 500, body: "Missing configuration" };
  }

  const signature = event.headers["x-agentaos-signature"] || "";
  const parts = Object.fromEntries(
    signature.split(",").map(part => part.trim().split("="))
  );

  const timestamp = Number(parts.t);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isSafeInteger(timestamp) ||
      timestamp > now ||
      now - timestamp > 300 ||
      !/^[a-fA-F0-9]{64}$/.test(parts.v1 || "")) {
    return { statusCode: 400, body: "Invalid signature" };
  }

  const rawBody = Buffer.from(
    event.body || "",
    event.isBase64Encoded ? "base64" : "utf8"
  );

  const expected = crypto
    .createHmac("sha256", secret)
    .update(parts.t + ".")
    .update(rawBody)
    .digest();

  const received = Buffer.from(parts.v1, "hex");

  if (!crypto.timingSafeEqual(expected, received)) {
    return { statusCode: 400, body: "Invalid signature" };
  }

  let payload;

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (payload.type === "webhook.test") {
    return { statusCode: 200, body: "Webhook verified" };
  }

  return {
    statusCode: 503,
    body: "Payment processing not enabled yet"
  };
};
