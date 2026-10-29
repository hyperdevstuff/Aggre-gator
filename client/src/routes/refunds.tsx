import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalContact,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      summary={`If a paid plan is not what you expected, ask within ${LEGAL.refundDays} days of the charge and we will refund it. You do not need to justify it.`}
    >
      <LegalSection id="window" title="1. The window">
        <p>
          You have {LEGAL.refundDays} days from the date of a charge to request a
          full refund of that charge. This applies to the first payment and to
          any renewal &mdash; if a renewal charges you after you meant to cancel,
          tell us and we will refund it.
        </p>
        <p>
          We do not ask why. A refund does not require a support conversation, a
          form, or a reason, and asking for one will not affect your account.
        </p>
      </LegalSection>

      <LegalSection id="how" title="2. How to request one">
        <p>
          Email {LEGAL.supportEmail} from the address on your account, with
          either the payment reference from your receipt or the email address the
          subscription is under. If you cannot find either, say so &mdash; we can
          locate the payment from your account.
        </p>
        <p>
          We reply within two business days. You do not need to cancel first, and
          requesting a refund does not require deleting your account.
        </p>
      </LegalSection>

      <LegalSection id="processing" title="3. How it is processed">
        <LegalList>
          <li>
            Dodo Payments is the Merchant of Record, so the refund is issued by
            Dodo against the original payment.
          </li>
          <li>
            It returns to the payment method you paid with. Cards typically show
            it within 5&ndash;10 business days, depending on your bank.
          </li>
          <li>
            Refunds are issued in the same currency as the charge. If your bank
            converts currencies, the amount you receive back may differ slightly
            because of exchange rates and bank fees outside our control.
          </li>
          <li>
            Once refunded, the paid features on the account end at the point of
            refund. Your content is not deleted &mdash; collections above the free
            plan limit become private rather than being removed.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="after" title="4. After the window">
        <p>
          Past {LEGAL.refundDays} days you can still cancel at any time, which
          stops the next charge. Access continues until the end of the period you
          have already paid for. We do not pro-rate a period that has already
          started, except where the law requires it or where we ended the service
          for a reason other than your breach of the{" "}
          <Link
            to="/terms"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="chargebacks" title="5. Please contact us before a chargeback">
        <p>
          A chargeback takes longer than a refund, costs both of us money in fees,
          and is harder to resolve once the card network is involved. If a charge
          looks wrong, email us first &mdash; in practice every case within the
          window is refunded the same day.
        </p>
      </LegalSection>

      <LegalSection id="statutory" title="6. Your statutory rights">
        <p>
          This policy is in addition to, and does not replace, any right you have
          under the consumer law of your country of residence &mdash; including
          any right to withdraw from a digital purchase within a statutory period
          and any right to a remedy for a service that was not provided. Where
          those rights are stronger than this policy, they apply.
        </p>
      </LegalSection>

      <LegalSection id="pricing" title="7. What you are charged">
        <p>
          Paid plans are {LEGAL.proPrice} per month, billed in advance and
          renewing monthly until cancelled. Prices are shown in US dollars, and
          any applicable sales tax or VAT is added by the Merchant of Record at
          checkout. The free plan costs nothing and never requires a card.
        </p>
      </LegalSection>

      <LegalContact />
    </LegalPage>
  );
}
