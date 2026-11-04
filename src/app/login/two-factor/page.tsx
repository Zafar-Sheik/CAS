import type { Metadata } from "next";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Verify it's you" };

export default function TwoFactorPage() {
  return <TwoFactorForm />;
}
