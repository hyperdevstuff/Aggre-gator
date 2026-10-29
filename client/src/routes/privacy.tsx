import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="What we collect, why we need it, who else sees it, and how to get it removed. There are no advertising trackers on this site."
    >
      <LegalSection id="scope" title="1. Who is responsible">
        <p>
          {LEGAL.operator} is the controller of the personal data described here,
          and can be reached at {LEGAL.supportEmail}. This policy covers the
          service at {LEGAL.siteUrl.replace(/^https?:\/\//, "")}, including
          accounts, saved content, published collections and paid plans.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="2. What we collect">
        <p>
          <span className="font-medium text-foreground">Account data.</span> Your
          email address, display name, an optional username and profile image,
          and whether your email has been verified. If you sign up with a
          password we store a one-way hash of it, never the password. If you sign
          in with Google we receive your Google account identifier, email address
          and name; we do not receive your Google password.
        </p>
        <p>
          <span className="font-medium text-foreground">Content you save.</span>{" "}
          The links you save and the metadata fetched from them (title,
          description, cover image, domain), your notes, tags, collections and
          their nesting, favourites, archived state, and the visibility you set
          on each collection.
        </p>
        <p>
          <span className="font-medium text-foreground">Technical data.</span>{" "}
          Request logs recording the time, HTTP method, path, status code,
          duration, a request identifier and &mdash; when you are signed in
          &mdash; your user identifier. We read your IP address in memory to
          apply rate limits (a short-lived per-minute counter); it is not stored
          in the database and is not written to our application logs.
        </p>
        <p>
          <span className="font-medium text-foreground">Billing data.</span> When
          you buy a paid plan we store the customer and subscription identifiers
          issued by Dodo Payments, the plan, the subscription status and the
          current period end. Card numbers and bank details are entered on Dodo&apos;s
          checkout and never reach our servers.
        </p>
      </LegalSection>

      <LegalSection id="not-collected" title="3. What we do not collect">
        <LegalList>
          <li>No advertising or cross-site tracking scripts, and no ad networks.</li>
          <li>No third-party analytics product recording your page views.</li>
          <li>No payment card data, and no bank account details.</li>
          <li>
            No precise location beyond the country an edge provider infers from
            your connection.
          </li>
          <li>No content of the pages you link to, beyond the metadata we display.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" title="4. Cookies and local storage">
        <p>
          We set one essential cookie: a session cookie that keeps you signed in.
          It is required for the service to work, is not used for advertising,
          and disappears when you sign out or it expires.
        </p>
        <p>
          Your browser may also hold your theme preference in local storage, and
          a cached copy of the app so it loads quickly. Neither is transmitted to
          us.
        </p>
        <p>
          Payment is completed on Dodo&apos;s checkout, which sets its own
          cookies under its own policy.
        </p>
      </LegalSection>

      <LegalSection id="why" title="5. Why we process it">
        <LegalList>
          <li>
            <span className="font-medium text-foreground">To provide the service</span>{" "}
            &mdash; storing your account and content, rendering your collections,
            fetching link metadata, and enforcing plan limits.
          </li>
          <li>
            <span className="font-medium text-foreground">To take payment</span>{" "}
            &mdash; creating a checkout, and applying the plan once the payment
            provider confirms it.
          </li>
          <li>
            <span className="font-medium text-foreground">To keep it working and safe</span>{" "}
            &mdash; rate limiting, abuse prevention, debugging failures, and
            responding to security incidents.
          </li>
          <li>
            <span className="font-medium text-foreground">To meet legal obligations</span>{" "}
            &mdash; tax and accounting records, and responding to lawful requests.
          </li>
        </LegalList>
        <p>
          Where the GDPR applies, the lawful bases are performance of our
          contract with you, our legitimate interest in running a secure service,
          and compliance with legal obligations. We do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection id="sharing" title="6. Who processes it">
        <p>
          We use a small number of providers, each of which sees only what its
          job requires:
        </p>
        <LegalList>
          <li>
            <span className="font-medium text-foreground">Render</span> &mdash;
            hosts the application.
          </li>
          <li>
            <span className="font-medium text-foreground">Neon</span> &mdash;
            hosts the Postgres database that holds accounts and content.
          </li>
          <li>
            <span className="font-medium text-foreground">Cloudflare</span>{" "}
            &mdash; fronts the site as a CDN and proxy, and may process connection
            metadata such as IP address and country.
          </li>
          <li>
            <span className="font-medium text-foreground">Dodo Payments</span>{" "}
            &mdash; the Merchant of Record that processes payments, handles tax
            and stores your billing details.
          </li>
          <li>
            <span className="font-medium text-foreground">Google</span> &mdash;
            only if you choose to sign in with Google.
          </li>
          <li>
            <span className="font-medium text-foreground">Our email provider</span>{" "}
            &mdash; delivers verification, password-reset and billing emails.
          </li>
        </LegalList>
        <p>
          We may also disclose data where the law requires it, or to establish or
          defend a legal claim. We do not sell or rent personal data to anyone.
        </p>
      </LegalSection>

      <LegalSection id="public" title="7. What other people can see">
        <p>
          A collection you publish is visible to anyone with the link, along with
          the display name and username on your profile. Anything you put in a
          public collection &mdash; a link, a title, a note, a tag &mdash; should
          be treated as public. Search engines and link-preview crawlers may
          index it.
        </p>
        <p>
          Collections you keep private, your email address, and your billing
          details are not shown to other users. They are stored in the same
          database as public content but are never served to a visitor without
          your session.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="8. How long we keep it">
        <p>
          Account data and content are kept while your account exists. Request
          logs are short-lived operational records. Billing records are kept for
          as long as tax and accounting law requires, even after an account is
          closed.
        </p>
        <p>
          When you ask us to delete your account we remove your accounts, saved
          links, collections, tags and profile, and the published pages stop
          resolving. Residual copies may persist briefly in encrypted backups
          before they are overwritten.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="9. Your rights">
        <p>
          Depending on where you live, you may have the right to access a copy of
          your data, correct it, delete it, export it, restrict or object to how
          it is used, and complain to a supervisory authority. Where the GDPR
          applies, you also have the right to data portability.
        </p>
        <p>
          To exercise any of these, write to {LEGAL.supportEmail} from the address
          on your account. We answer within 30 days. You can also delete your own
          content at any time from inside the app.
        </p>
      </LegalSection>

      <LegalSection id="security" title="10. Security">
        <p>
          Traffic is encrypted in transit with HTTPS. Passwords are stored as
          one-way hashes. Database access is limited to the application, and
          payment data is held by the Merchant of Record rather than by us. No
          system is perfectly secure: if a breach affects your data we will
          notify you and the relevant authority as the law requires.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="11. International transfers">
        <p>
          Our providers may process data outside your country, including in the
          United States. Where data leaves the EEA or the UK we rely on the
          transfer safeguards those providers publish, such as standard
          contractual clauses.
        </p>
      </LegalSection>

      <LegalSection id="children" title="12. Children">
        <p>
          The service is not intended for anyone under 16, and we do not
          knowingly collect data from a child under that age. If you believe a
          child has created an account, write to us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="13. Changes to this policy">
        <p>
          If we change how we handle personal data we will update this page and
          its date, and tell you by email or in the app before a material change
          takes effect. The{" "}
          <Link
            to="/terms"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Terms of Service
          </Link>{" "}
          describe the rest of our relationship.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
