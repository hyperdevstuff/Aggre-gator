import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/$id")({
  loader: async ({ params }) => await fetch(`/bookmarks/${params.id}`),
  component: postId,
});

function postId() {
  const { id } = Route.useParams();
  return <div>Post ID: {id}</div>;
}
