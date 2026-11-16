
const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return { statusCode: 500, body: "Webhook not configured" };
  }

  const signature = event.headers["x-signature"];
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64")
    : Buffer.from(event.body || "", "utf8");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  const received = Buffer.from(signature || "", "hex");
  const valid =
    received.length === expected.length / 2 &&
    crypto.timingSafeEqual(received, Buffer.from(expected, "hex"));

  if (!valid) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const data = JSON.parse(body.toString("utf8"));

  console.log("Verified Lemon Squeezy event:", data.meta?.event_name);
  console.log("Subscription ID:", data.data?.id);

  return { statusCode: 200, body: "Webhook received" };
};
