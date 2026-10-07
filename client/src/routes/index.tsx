import { createFileRoute, redirect } from "@tanstack/react-router";
import { CloseCta } from "@/components/landing/close-cta";
import { FeaturesTeaser } from "@/components/landing/features-teaser";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNavbar } from "@/components/landing/site-navbar";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    // Signed-in visitors have no business on the marketing page.
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <SiteNavbar />
      <main>
        <Hero />
        <HowItWorks />
        <FeaturesTeaser />
        <PricingTeaser />
        <CloseCta />
      </main>
      <SiteFooter />
    </div>
  );
}