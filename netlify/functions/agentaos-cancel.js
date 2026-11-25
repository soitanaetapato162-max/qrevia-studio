
exports.handler = async (event) => {
  const reply = (statusCode, data) => ({
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apiKey = process.env.AGENTAOS_API_KEY;

    const auth = event.headers.authorization ||
      event.headers.Authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return reply(401, { error: "Please log in." });
    }

    const userResponse = await fetch(
      `${supabaseUrl}/auth/v1/user`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: auth
        }
      }
    );

    if (!userResponse.ok) {
      return reply(401, { error: "Invalid session." });
    }

    const user = await userResponse.json();

    const subResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=agentaos_subscription_id,subscription_status`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!subResponse.ok) {
      return reply(503, {
        error: "Unable to verify subscription."
      });
    }

    const rows = await subResponse.json();
    const sub = rows[0];

    if (!sub?.agentaos_subscription_id ||
        sub.subscription_status !== "active") {
      return reply(404, {
        error: "No active subscription found."
      });
    }

    const response = await fetch(
      `https://api.agentaos.ai/api/v1/gateway/subscriptions/${encodeURIComponent(sub.agentaos_subscription_id)}/cancel`,
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      }
    );

    if (!response.ok) {
      return reply(502, {
        error: "Unable to cancel subscription."
      });
    }

    const result = await response.json();

    if (result.cancelAtPeriodEnd !== true &&
        result.status !== "canceled") {
      return reply(502, {
        error: "Cancellation not confirmed."
      });
    }

    return reply(200, {
      success: true,
      currentPeriodEnd: result.currentPeriodEnd,
      cancelAtPeriodEnd: result.cancelAtPeriodEnd
    });

  } catch (error) {
    return reply(500, {
      error: "Subscription cancellation failed."
    });
  }
};
