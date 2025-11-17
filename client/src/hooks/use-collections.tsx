import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export const collectionsQueryOptions = () =>
  queryOptions({
    queryKey: ["collections"],
    queryFn: api.collections.list,
    staleTime: 1000 * 60 * 5,
  });

export const collectionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["collections", id],
    queryFn: () => api.collections.get(id),
  });

export const useCollections = () => useQuery(collectionsQueryOptions());

export const useCollection = (id: string) =>
  useQuery(collectionQueryOptions(id));
