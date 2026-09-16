import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type OtpCodeEmailProps = {
  code: string;
  /** How long the code stays valid, in minutes. */
  expiryMinutes: number;
  purpose: "EMAIL_VERIFICATION" | "PHONE_VERIFICATION" | "COD_CONFIRMATION" | "PASSWORD_RESET";
};

const HEADLINE: Record<OtpCodeEmailProps["purpose"], string> = {
  EMAIL_VERIFICATION: "Confirm your email address",
  PHONE_VERIFICATION: "Confirm your phone number",
  COD_CONFIRMATION: "Confirm your cash-on-delivery order",
  PASSWORD_RESET: "Reset your password",
};

export function OtpCodeEmail({ code, expiryMinutes, purpose }: OtpCodeEmailProps) {
  const headline = HEADLINE[purpose];

  return (
    <Html lang="en">
      <Head />
      <Preview>{`${code} is your Dhanvarsha verification code`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={brand}>DHANVARSHA</Text>

          <Heading style={heading}>{headline}</Heading>

          <Text style={paragraph}>Enter this code to continue:</Text>

          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>

          <Text style={paragraph}>
            The code expires in {expiryMinutes} minutes and can only be used once.
          </Text>

          <Hr style={rule} />

          <Text style={footer}>
            If you did not request this, you can safely ignore this email — nobody can
            access your account without the code above. Never share it with anyone,
            including someone claiming to be from Dhanvarsha.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default OtpCodeEmail;

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

const codeBox = {
  backgroundColor: "#faf8f5",
  border: "1px solid #e7e3dd",
  borderRadius: "6px",
  margin: "0 0 16px",
  padding: "16px",
  textAlign: "center" as const,
};

const codeText = {
  color: "#1c1917",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "30px",
  fontWeight: 700,
  letterSpacing: "0.3em",
  lineHeight: "36px",
  margin: 0,
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
