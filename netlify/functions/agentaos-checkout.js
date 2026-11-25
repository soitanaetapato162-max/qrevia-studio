exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  try {
    const token = event.headers.authorization ||
      event.headers.Authorization;

    if (!token || !token.startsWith("Bearer ")) {
      return reply(401, { error: "Please log in first" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.AGENTAOS_API_KEY;
    const productId = process.env.AGENTAOS_PRODUCT_ID;

    if (!supabaseUrl || !serviceKey || !apiKey || !productId) {
      throw new Error("Missing configuration");
    }

    const auth = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: token
        }
      }
    );

    if (!auth.ok) {
      return reply(401, { error: "Invalid login" });
    }

    const user = await auth.json();

    if (!user.id || !user.email) {
      return reply(401, { error: "Invalid user" });
    }

    if (process.env.AGENTAOS_CHECKOUT_ENABLED !== "true") {
      return reply(503, {
        error: "Checkout is not enabled yet"
      });
    }

    const response = await fetch(
      "https://api.agentaos.ai/api/v1/gateway/sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },
        body: JSON.stringify({
          linkId: productId,
          buyerEmail: user.email,
          metadata: {
            customerId: user.id
          },
          successUrl: "https://qreviastudio.com/",
          cancelUrl: "https://qreviastudio.com/",
          webhookUrl: "https://qreviastudio.com/.netlify/functions/agentaos-webhook"
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.checkoutUrl) {
      throw new Error("Checkout creation failed");
    }

    return reply(200, {
      checkoutUrl: data.checkoutUrl
    });

  } catch (error) {
    console.error(error.message);
    return reply(500, {
      error: "Unable to create checkout"
    });
  }
};
