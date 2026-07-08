import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookmarks, updateBookmark } from '../lib/api';

export function useBookmarks() {
  const queryClient = useQueryClient();

  const { data: bookmarks = [] } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: getBookmarks,
  });

  const mutation = useMutation({
    mutationFn: ({ sessionId, starred, tags, note }: { sessionId: string; starred?: boolean; tags?: string[]; note?: string }) =>
      updateBookmark(sessionId, { starred, tags, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  const toggleStar = (sessionId: string) => {
    const bm = (bookmarks as any[]).find((b: any) => b.session_id === sessionId);
    mutation.mutate({ sessionId, starred: !bm?.starred });
  };

  const updateTags = (sessionId: string, tags: string[]) => {
    mutation.mutate({ sessionId, tags });
  };

  return { bookmarks: bookmarks as any[], toggleStar, updateTags };
}
