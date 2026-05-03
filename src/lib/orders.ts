export interface OrderItemSummary {
  itemKey: string;
  title: string;
  variantTitle: string;
  quantity: number;
  price: { amount: string; currencyCode: string };
  imageUrl: string | null;
  selectedOptions: Array<{ name: string; value: string }>;
  tier: string;
}

export interface IntakeEntry {
  itemKey: string;
  targetUrl: string;
  destinationType: string;
  brief: string;
}

export interface OrderIntakeSummary {
  contactEmail: string;
  entries: IntakeEntry[];
  submittedAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  sessionId: string;
  shortOrderId: string;
  paymentStatus: string | null;
  customerEmail: string | null;
  items: OrderItemSummary[];
  intake: OrderIntakeSummary | null;
}

interface IntakeSubmissionPayload {
  contactEmail: string;
  entries: IntakeEntry[];
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data?.error === "string" ? data.error : "Request failed";
    throw new Error(message);
  }

  return data as T;
}

export async function fetchOrderSummary(sessionId: string) {
  const response = await fetch(`/api/orders/${encodeURIComponent(sessionId)}`);
  return handleJsonResponse<OrderSummary>(response);
}

export async function submitOrderIntake(
  sessionId: string,
  payload: IntakeSubmissionPayload
) {
  const response = await fetch(
    `/api/orders/${encodeURIComponent(sessionId)}/intake`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return handleJsonResponse<OrderSummary>(response);
}
