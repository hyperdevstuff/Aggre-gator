import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms govern your use of Aggregator. They cover what you may store, what happens when you publish a collection, and how the paid plans are billed."
    >
      <LegalSection id="agreement" title="1. The agreement">
        <p>
          Aggregator (the &ldquo;service&rdquo;) is operated by{" "}
          {LEGAL.operator} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an
          account or using the service you agree to these terms. If you do not
          agree, do not use the service.
        </p>
        <p>
          Where you buy a paid plan, the transaction is also subject to the
          terms of our Merchant of Record, Dodo Payments, who acts as the
          seller of record for that purchase.
        </p>
      </LegalSection>

      <LegalSection id="the-service" title="2. What the service is">
        <p>
          Aggregator is a bookmark manager. You save links, organise them into
          collections, and may publish a collection as a page other people can
          visit. We host the software and your data; we do not review, endorse
          or moderate what you save before you save it.
        </p>
        <p>
          The service is provided as-is. Features may be added, changed or
          removed, and we will give reasonable notice of any change that
          materially reduces what a paid plan includes.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="3. Your account">
        <LegalList>
          <li>
            You must be at least 16 years old to create an account.
          </li>
          <li>
            You are responsible for keeping your credentials secure, and for
            everything done through your account.
          </li>
          <li>
            Give us accurate information. One person, one account: do not share
            an account to avoid a plan limit.
          </li>
          <li>
            Tell us promptly at {LEGAL.supportEmail} if you believe your account
            has been compromised.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="your-content" title="4. The content you save">
        <p>
          You keep ownership of everything you save &mdash; links, titles,
          notes, tags and collections. We claim no ownership over it.
        </p>
        <p>
          To run the service we need a limited licence to store your content,
          produce the metadata we display (such as a page title and cover
          image), and serve it back to you and to anyone you have made it
          visible to. That licence exists only to operate the service, and ends
          when the content is deleted.
        </p>
        <p>
          You are responsible for what you save. Do not save content you have no
          right to store, and do not use the service to keep a copy of material
          you are not licensed to keep.
        </p>
      </LegalSection>

      <LegalSection id="public-collections" title="5. Published collections are public">
        <p>
          A collection you publish is readable by anyone with the link, and
          appears in the public directory unless you choose otherwise. Search
          engines and link-preview crawlers may index it. Treat publication as
          permanent disclosure: removing the collection stops future visitors,
          but cannot recall what someone already copied, archived or indexed.
        </p>
        <p>
          Publishing does not transfer ownership, and it does not make us the
          publisher of your content. It remains yours and remains your
          responsibility.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>You may not use the service to:</p>
        <LegalList>
          <li>
            store or publish content that is unlawful, infringing, defamatory,
            harassing, hateful, or that sexualises minors;
          </li>
          <li>
            distribute malware, phishing pages, or links whose purpose is to
            deceive the person opening them;
          </li>
          <li>
            publish collections whose purpose is search-engine manipulation,
            affiliate spam or bulk link farming;
          </li>
          <li>
            scrape, crawl or automate requests against the service beyond
            ordinary use, or attempt to bypass its rate limits;
          </li>
          <li>
            probe, scan or test the security of the service without our written
            permission;
          </li>
          <li>
            impersonate another person, or misrepresent an affiliation you do
            not have.
          </li>
        </LegalList>
        <p>
          We may remove content or suspend an account that breaches these rules.
          Where it is reasonable to do so we will tell you why.
        </p>
      </LegalSection>

      <LegalSection id="plans" title="7. Free and paid plans">
        <p>
          The free plan includes unlimited private collections and{" "}
          {LEGAL.freePublicCollections} published collections. Paid plans
          include unlimited published collections and the share features
          described on the{" "}
          <Link
            to="/"
            hash="pricing"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            pricing section
          </Link>
          . Private collections are not limited on any plan.
        </p>
        <p>
          Limits apply to the account, not to the number of devices or browsers
          you sign in from. If a plan change lowers a limit, we will not delete
          anything: you keep the content, and the collections over the limit
          become private until you are back under it.
        </p>
      </LegalSection>

      <LegalSection id="payments" title="8. Payment, renewal and taxes">
        <p>
          Paid plans are billed in advance, monthly, at {LEGAL.proPrice} per
          month unless a different price is shown at checkout. Prices are in US
          dollars.
        </p>
        <p>
          Dodo Payments is the Merchant of Record for every purchase. Dodo
          processes your payment, calculates and remits applicable sales tax or
          VAT, and appears on your statement. We never receive or store your
          card details &mdash; we receive a customer identifier and the status
          of your subscription.
        </p>
        <p>
          Subscriptions renew automatically until cancelled. Cancelling stops
          the next renewal; access continues until the end of the period you
          have already paid for. If a renewal payment fails we may retry it, and
          may suspend the paid features until it succeeds. Your content is not
          deleted if a payment fails.
        </p>
      </LegalSection>

      <LegalSection id="refunds" title="9. Cancellation and refunds">
        <p>
          You can cancel at any time from the customer portal, or by writing to{" "}
          {LEGAL.supportEmail}. Refunds are governed by our{" "}
          <Link
            to="/refunds"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Refund Policy
          </Link>
          , which gives you {LEGAL.refundDays} days from a charge to ask for your
          money back.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="10. Availability">
        <p>
          We aim to keep the service available, but we do not promise
          uninterrupted access. Maintenance, a hosting or database provider
          outage, or a security response may interrupt it. Do not treat
          Aggregator as the only copy of anything you cannot afford to lose.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="11. Suspension and termination">
        <p>
          You may stop using the service at any time and ask us to delete your
          account. We may suspend or terminate an account that materially
          breaches these terms, that we are required to act against by law, or
          that exposes the service or other users to harm.
        </p>
        <p>
          If we terminate your account for a reason other than your breach, we
          will refund the unused portion of any prepaid period.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="12. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo;, without warranties of any kind to the extent
          permitted by law. We do not warrant that metadata we fetch from a
          saved link is accurate, that a saved link will still resolve, or that
          the service will meet a particular requirement.
        </p>
        <p>
          Nothing in these terms excludes a warranty or right that cannot be
          excluded under the law that applies to you.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="13. Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or
          consequential loss, loss of profit, or loss of data that you did not
          keep another copy of. Our total liability for any claim relating to
          the service is limited to the greater of the amount you paid us in the
          twelve months before the claim, or USD 50.
        </p>
      </LegalSection>

      <LegalSection id="law" title="14. Governing law">
        <p>
          These terms are governed by the laws of {LEGAL.jurisdiction}, and the
          courts of that jurisdiction have exclusive jurisdiction over any
          dispute, without affecting any right you have to bring a claim in your
          own country of residence as a consumer.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="15. Changes to these terms">
        <p>
          We may update these terms. If a change materially affects your rights
          or a paid plan, we will tell you by email or in the app before it
          takes effect. Continuing to use the service after that date means you
          accept the updated terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
