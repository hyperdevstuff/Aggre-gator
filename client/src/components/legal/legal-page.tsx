import type { ReactNode } from "react";
import { useEffect } from "react";
import { format } from "date-fns";
import { SiteNavbar } from "@/components/landing/site-navbar";
import { SiteFooter } from "@/components/landing/site-footer";
import { LEGAL } from "@/lib/legal";

/**
 * Shared shell for the legal documents.
 *
 * These pages are the ones a payment provider's reviewer opens, so they are
 * deliberately plain: one column inside the same 3xl measure the rest of the
 * marketing copy uses, no animation, no cards. The marketing navbar and footer
 * stay so the page does not feel like a different property.
 */

type LegalPageProps = {
  title: string;
  /** One sentence a reader can act on without scrolling. */
  summary: string;
  children: ReactNode;
};

export function LegalPage({ title, summary, children }: LegalPageProps) {
  /**
   * This app has no head management — the SPA shell title is static, and public
   * pages get their Open Graph tags from the API for crawler requests only
   * (ADR-002). So the browser tab title is set here, and restored on unmount so
   * returning to the landing page does not leave "Privacy Policy" in the tab.
   */
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;

    document.title = `${title} — ${LEGAL.productName}`;
    meta?.setAttribute("content", summary);

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== null) {
        meta.setAttribute("content", previousDescription);
      }
    };
  }, [title, summary]);

  return (
    <div className="min-h-svh bg-background">
      <SiteNavbar />
      <main className="mx-auto max-w-3xl px-6 pt-32 pb-24 sm:pt-36">
        <p className="meta-sm">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-pretty text-muted-foreground">{summary}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Last updated{" "}
          <time dateTime={LEGAL.effectiveDate}>
            {/*
              Noon anchor: `new Date("2026-10-29")` is parsed as UTC midnight, so
              a browser in a negative offset would render the previous day. The
              unsuffixed form is parsed as local time, which is what a static
              document wants.
            */}
            {format(new Date(`${LEGAL.effectiveDate}T12:00:00`), "d MMMM yyyy")}
          </time>
        </p>

        <div className="mt-12 flex flex-col gap-10 border-t border-border/60 pt-10">
          {children}
        </div>

        {/* Rendered here, once, rather than in each page: a legal document that
            ends without a contact address is the thing reviewers flag, so it
            must not be possible to forget. */}
        <LegalContact />
      </main>
      <SiteFooter notes={false} />
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28">
      <h2
        id={`${id}-heading`}
        className="text-lg font-semibold tracking-tight text-balance"
      >
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** A bulleted list with the spacing the surrounding prose expects. */
export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground/60">
      {children}
    </ul>
  );
}

/**
 * Closing block shared by all three documents. The email is a live link on
 * purpose: a reviewer or a customer must be able to reach a human without
 * hunting for a contact form.
 */
export function LegalContact() {
  return (
    <section
      aria-labelledby="contact-heading"
      className="mt-12 rounded-xl border bg-card p-6"
    >
      <h2 id="contact-heading" className="text-sm font-medium">
        Questions
      </h2>
      <p className="mt-2 text-sm text-pretty text-muted-foreground">
        Write to{" "}
        <a
          href={`mailto:${LEGAL.supportEmail}`}
          className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {LEGAL.supportEmail}
        </a>
        .
      </p>
    </section>
  );
}
