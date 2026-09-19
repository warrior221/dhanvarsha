import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from "@react-email/components";

export type OrderEventKind = "CONFIRMED" | "SHIPPED" | "DELIVERED";

export type OrderEventEmailProps = {
  kind: OrderEventKind;
  customerName: string;
  orderNumber: string;
  orderUrl: string;
  totalFormatted: string;
  isCod: boolean;
  items: { name: string; size: string | null; quantity: number; lineTotal: string }[];
  courierName?: string | null;
  trackingNumber?: string | null;
};

const COPY: Record<
  OrderEventKind,
  { subjectLead: string; heading: string; body: (isCod: boolean, total: string) => string }
> = {
  CONFIRMED: {
    subjectLead: "confirmed",
    heading: "Your order is confirmed",
    body: (isCod, total) =>
      isCod
        ? `We have started preparing it. Please keep ${total} ready in cash for the courier.`
        : "We have started preparing it and will let you know as soon as it ships.",
  },
  SHIPPED: {
    subjectLead: "on its way",
    heading: "Your order is on its way",
    body: (isCod, total) =>
      isCod
        ? `It should reach you shortly. Please keep ${total} ready in cash for the courier.`
        : "It should reach you shortly.",
  },
  DELIVERED: {
    subjectLead: "delivered",
    heading: "Your order has been delivered",
    body: () =>
      "We hope you love it. If anything is not right, reply to this email and we will sort it out.",
  },
};

export function subjectFor(kind: OrderEventKind, orderNumber: string): string {
  return `Order ${orderNumber} is ${COPY[kind].subjectLead}`;
}

export function OrderEventEmail({
  kind,
  customerName,
  orderNumber,
  orderUrl,
  totalFormatted,
  isCod,
  items,
  courierName,
  trackingNumber,
}: OrderEventEmailProps) {
  const copy = COPY[kind];

  return (
    <Html lang="en">
      <Head />
      <Preview>{`${copy.heading} — ${orderNumber}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>DHANVARSHA</Text>

          <Heading style={heading}>{copy.heading}</Heading>

          <Text style={paragraph}>
            Hello {customerName}, {copy.body(isCod, totalFormatted)}
          </Text>

          {kind === "SHIPPED" && trackingNumber ? (
            <Section style={trackingBox}>
              <Text style={trackingLabel}>{courierName}</Text>
              <Text style={trackingCode}>{trackingNumber}</Text>
            </Section>
          ) : null}

          <Hr style={rule} />

          <Text style={sectionTitle}>Order {orderNumber}</Text>

          {items.map((item, index) => (
            <Row key={index} style={itemRow}>
              <Column>
                <Text style={itemName}>
                  {item.name}
                  {item.size ? ` · ${item.size}` : ""}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                </Text>
              </Column>
              <Column align="right">
                <Text style={itemPrice}>{item.lineTotal}</Text>
              </Column>
            </Row>
          ))}

          <Hr style={rule} />

          <Row>
            <Column>
              <Text style={totalLabel}>Total</Text>
            </Column>
            <Column align="right">
              <Text style={totalValue}>{totalFormatted}</Text>
            </Column>
          </Row>

          <Button style={button} href={orderUrl}>
            View your order
          </Button>

          <Hr style={rule} />

          <Text style={footer}>
            You are receiving this because you placed an order with Dhanvarsha.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OrderEventEmail;

const body = {
  backgroundColor: "#f6f5f3",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: "32px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7e3dd",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "520px",
  padding: "32px",
};

const brand = {
  color: "#8c1d3f",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.18em",
  margin: "0 0 24px",
};

const heading = {
  color: "#1c1917",
  fontSize: "20px",
  fontWeight: 600,
  lineHeight: "28px",
  margin: "0 0 12px",
};

const paragraph = {
  color: "#44403c",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 16px",
};

const trackingBox = {
  backgroundColor: "#faf8f5",
  border: "1px solid #e7e3dd",
  borderRadius: "6px",
  margin: "0 0 16px",
  padding: "12px 16px",
};

const trackingLabel = {
  color: "#78716c",
  fontSize: "12px",
  margin: "0 0 2px",
};

const trackingCode = {
  color: "#1c1917",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "0.05em",
  margin: 0,
};

const sectionTitle = {
  color: "#78716c",
  fontSize: "12px",
  letterSpacing: "0.08em",
  margin: "0 0 8px",
  textTransform: "uppercase" as const,
};

const itemRow = { margin: "0 0 4px" };

const itemName = {
  color: "#44403c",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
};

const itemPrice = {
  color: "#44403c",
  fontSize: "14px",
  lineHeight: "20px",
  margin: 0,
};

const totalLabel = {
  color: "#1c1917",
  fontSize: "15px",
  fontWeight: 600,
  margin: 0,
};

const totalValue = {
  color: "#1c1917",
  fontSize: "15px",
  fontWeight: 700,
  margin: 0,
};

const button = {
  backgroundColor: "#8c1d3f",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "20px 0 0",
  padding: "12px 20px",
  textDecoration: "none",
};

const rule = {
  borderColor: "#e7e3dd",
  margin: "20px 0 16px",
};

const footer = {
  color: "#78716c",
  fontSize: "12px",
  lineHeight: "20px",
  margin: 0,
};
