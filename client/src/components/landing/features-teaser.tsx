import {
  BookmarkPlus,
  FolderTree,
  Globe,
  Search,
  Tags,
  Users,
} from "lucide-react";

/*
 * Every line here is checkable against the code. Two of these used to claim
 * things that are not built: "one search box" said the query ran across titles,
 * URLs, descriptions and tags when it is a title match, and "a real public page"
 * said "one link publishes the whole collection" when the free tier ships a
 * single active share link and multi-collection pages are still on the roadmap.
 */
const FEATURES = [
  {
    icon: BookmarkPlus,
    title: "Save once, metadata included",
    body: "Paste a URL and the title, description, cover and favicon are fetched for you. No untitled link dumps.",
  },
  {
    icon: FolderTree,
    title: "Collections that nest",
    body: "Group bookmarks into collections up to three levels deep, so a syllabus or a shortlist keeps its shape.",
  },
  {
    icon: Tags,
    title: "Tags and favorites",
    body: "Collections are for curation, tags are for retrieval. Find every React link without re-reading everything.",
  },
  {
    icon: Globe,
    title: "One page, no account",
    body: "A share link publishes a collection and its sub-collections — tag pills, pagination, no sign-up for readers.",
  },
  {
    icon: Search,
    title: "Find it by title",
    body: "One box over bookmark titles, with filters for collection, tag and favourite. Everything it narrows lives in the URL.",
  },
  {
    icon: Users,
    title: "Stays current",
    body: "The page you send is the page that updates. Add a bookmark and every reader holding the link already sees it.",
  },
];

export function FeaturesTeaser() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="scroll-mt-28 border-t border-border/60"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="max-w-2xl">
          <h2
            id="features-heading"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Everything a link dump shouldn&apos;t need
          </h2>
          <p className="mt-3 text-pretty text-muted-foreground">
            Two jobs, done properly: keeping links organised, and publishing
            them somewhere that stays current.
          </p>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                <Icon className="size-4" />
              </span>
              <h3 className="mt-4 text-sm font-medium">{title}</h3>
              <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}