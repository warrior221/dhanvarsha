import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export type AdminSetupEmailProps = {
  name: string;
  setupUrl: string;
  /** How long the link stays valid, in hours. */
  expiryHours: number;
};

export function AdminSetupEmail({ name, setupUrl, expiryHours }: AdminSetupEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Set your Dhanvarsha admin password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>DHANVARSHA</Text>

          <Heading style={heading}>Set your admin password</Heading>

          <Text style={paragraph}>
            Hello {name}, an administrator account has been created for you on the
            Dhanvarsha store. Choose a password to finish setting it up.
          </Text>

          <Button style={button} href={setupUrl}>
            Set my password
          </Button>

          <Text style={paragraph}>
            This link works once and expires in {expiryHours} hours. If it has already
            expired, ask for a new one to be generated.
          </Text>

          <Text style={small}>
            If the button does not work, copy this address into your browser:
            <br />
            {setupUrl}
          </Text>

          <Hr style={rule} />

          <Text style={footer}>
            If you were not expecting this email, ignore it — the account cannot be used
            until a password is set through this link.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AdminSetupEmail;

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
  maxWidth: "465px",
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

const button = {
  backgroundColor: "#8c1d3f",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 16px",
  padding: "12px 20px",
  textDecoration: "none",
};

const small = {
  color: "#78716c",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "0 0 8px",
  wordBreak: "break-all" as const,
};

const rule = {
  borderColor: "#e7e3dd",
  margin: "24px 0 16px",
};

const footer = {
  color: "#78716c",
  fontSize: "12px",
  lineHeight: "20px",
  margin: 0,
};
