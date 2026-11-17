
const crypto = require("node:crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = event.headers["paddle-signature"];

  if (!secret || !signature || !event.body) {
    return { statusCode: 400, body: "Missing webhook data" };
  }

  const parts = Object.fromEntries(
    signature.split(";").map((part) => part.split("=", 2))
  );

  const timestamp = parts.ts;
  const received = parts.h1;

  if (!timestamp || !received || !/^[a-f0-9]{64}$/i.test(received)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return { statusCode: 401, body: "Expired signature" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + ":" + event.body)
    .digest("hex");

  if (!crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(received, "hex")
  )) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const notification = JSON.parse(event.body);

  console.log("Verified Paddle event:", notification.event_type);

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};
