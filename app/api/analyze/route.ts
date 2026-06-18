import { NextRequest } from "next/server";
import { buildRepoContext } from "@/lib/github";
import { enforce } from "@/lib/rate-limit";
import { log, errMessage } from "@/lib/log";

export async function GET(req: NextRequest) {
  const limited = await enforce(req, "analyze", 15, "code");
  if (limited) return limited;

  const repo = req.nextUrl.searchParams.get("repo");

  if (!repo) {
    return Response.json({ code: "INVALID_REPO" }, { status: 400 });
  }

  const parts = repo.split("/").filter(Boolean);
  if (parts.length !== 2) {
    return Response.json({ code: "INVALID_REPO" }, { status: 400 });
  }

  const [owner, name] = parts;

  try {
    const context = await buildRepoContext(owner, name);
    return Response.json(context);
  } catch (err) {
    const message = errMessage(err);

    if (message === "REPO_NOT_FOUND") {
      return Response.json({ code: "REPO_NOT_FOUND" }, { status: 404 });
    }
    if (message === "RATE_LIMITED") {
      log.warn("analyze.github_rate_limited", { repo: `${owner}/${name}` });
      return Response.json({ code: "RATE_LIMITED" }, { status: 429 });
    }

    log.error("analyze.fetch_error", { repo: `${owner}/${name}`, error: message });
    return Response.json({ code: "FETCH_ERROR", message }, { status: 500 });
  }
}
