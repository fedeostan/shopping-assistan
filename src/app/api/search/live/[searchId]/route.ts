import { getSearchState } from "@/lib/search/search-events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  const state = getSearchState(searchId);

  if (!state) {
    return Response.json({ streamingUrls: [], progress: [] });
  }

  return Response.json({
    streamingUrls: state.streamingUrls,
    progress: state.progress,
  });
}
