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

  const data = payload.data || {};
  const metadata = data.metadata || {};

  if (data.livemode !== true) {
    return { statusCode: 200, body: "Test event ignored" };
  }

  const isCheckout =
    payload.type === "checkout.session.completed";

  const isSubscription =
    payload.type.startsWith("subscription.");

  if (!isCheckout && !isSubscription) {
    return { statusCode: 200, body: "Event ignored" };
  }

  const subscriptionId = isCheckout
    ? metadata.subscriptionId
    : data.id;

  if (!subscriptionId) {
    return { statusCode: 400, body: "Missing subscription ID" };
  }

  try {
    const apiKey = process.env.AGENTAOS_API_KEY;
    const productId = process.env.AGENTAOS_PRODUCT_ID;
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!apiKey || !productId || !supabaseUrl || !serviceKey) {
      throw new Error("Missing configuration");
    }

    let subscription;

    for (let offset = 0; ; offset += 100) {
      const response = await fetch(
        `https://api.agentaos.ai/api/v1/gateway/subscriptions?limit=100&offset=${offset}`,
        { headers: { "x-api-key": apiKey } }
      );

      if (!response.ok) {
        throw new Error("Subscription lookup failed");
      }

      const page = await response.json();

      subscription = page.items.find(
        item => item.id === subscriptionId
      );

      if (subscription || !page.hasMore) break;
    }

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.linkId !== productId) {
      return { statusCode: 200, body: "Different product" };
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json"
    };

    const table = `${supabaseUrl}/rest/v1/subscriptions`;

    const lookup = await fetch(
      `${table}?agentaos_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=user_id`,
      { headers }
    );

    if (!lookup.ok) {
      throw new Error("Database lookup failed");
    }

    const rows = await lookup.json();

    const userId = rows[0]?.user_id ||
      (isCheckout && !metadata.subscriptionCycle
        ? metadata.customerId
        : null);

    if (!userId) {
      return { statusCode: 503, body: "Awaiting checkout mapping" };
    }

    const active =
      subscription.status === "active" &&
      Date.parse(subscription.currentPeriodEnd) > Date.now();

    const result = await fetch(
      `${table}?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          ...headers,
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          user_id: userId,
          subscription_status: active ? "active" : "inactive",
          agentaos_subscription_id: subscriptionId,
          current_period_end: subscription.currentPeriodEnd
        })
      }
    );

    if (!result.ok) {
      throw new Error("Subscription update failed");
    }

    return { statusCode: 200, body: "Subscription synchronized" };

  } catch (error) {
    console.error(error.message);
    return { statusCode: 503, body: "Subscription synchronization failed" };
  }
};
