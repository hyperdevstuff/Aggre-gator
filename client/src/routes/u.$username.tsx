import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for the `/u/:username` tree.
 *
 * The profile (`u.$username.index.tsx`) and a readable collection
 * (`u.$username.$slug.tsx`) are siblings under this route, which exists only to
 * mount them. Without the `<Outlet />` the nested collection route never
 * renders — every `/u/:username/:slug` URL would fall back to the profile.
 */
export const Route = createFileRoute("/u/$username")({
  component: Outlet,
});
