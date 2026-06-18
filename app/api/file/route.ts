import { fetchRawFile } from "@/lib/github";
import { enforce } from "@/lib/rate-limit";

// Fetches the raw source of a single repo file so the chat can render the lines
// behind a code citation. GET /api/file?repo=owner/name&branch=main&path=lib/x.ts
export async function GET(req: Request) {
  const limited = await enforce(req, "file", 80);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo") ?? "";
  const branch = searchParams.get("branch") ?? "main";
  const path = searchParams.get("path") ?? "";

  const [owner, name] = repo.split("/");
  if (!owner || !name || !path) {
    return Response.json({ error: "Missing repo or path" }, { status: 400 });
  }

  // The path is user-supplied and gets appended to a raw.githubusercontent URL.
  // Reject traversal / absolute paths so it can't be normalized into a
  // different repo or branch on the host.
  if (path.startsWith("/") || path.split("/").includes("..")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  const content = await fetchRawFile(owner, name, branch, path);
  if (content === null) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  return Response.json(
    { path, content },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
