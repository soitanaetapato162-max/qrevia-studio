
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const apiKey = process.env.PADDLE_API_KEY;

    if (!apiKey) {
      throw new Error("Paddle API key is missing");
    }

    const response = await fetch(
      "https://api.paddle.com/transactions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          items: [
            {
              price_id: "pri_01m7k64vp950gxhxnf6nr4df0a",
              quantity: 1
            }
          ],
          collection_mode: "automatic"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
error: "Paddle checkout failed",
details: data.error?.detail || data.error?.code || "Unknown Paddle error"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        checkoutUrl: data.data?.checkout?.url || null
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
