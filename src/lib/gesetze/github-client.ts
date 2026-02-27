/**
 * GitHub API client for bundestag/gesetze repository.
 * Fetches all Gesetz file paths+SHAs and raw Markdown content.
 * No external dependencies — uses native fetch (Node 18+).
 */

const GITHUB_API = "https://api.github.com";
const REPO_OWNER = "bundestag";
const REPO_REPO = "gesetze";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_REPO}/master`;

export interface GitTreeItem {
  path: string;   // e.g. "b/bgb/index.md"
  type: string;   // "blob" | "tree"
  sha: string;    // blob SHA for change detection
}

function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  } else {
    // Log warning once on first call — unauthenticated = 60 req/hr limit
    console.warn("[gesetze] GITHUB_TOKEN not set — unauthenticated rate limit (60 req/hr). Set GITHUB_TOKEN for 5000 req/hr.");
  }
  return headers;
}

/**
 * Fetch all index.md file paths and SHAs from bundestag/gesetze.
 * Uses git trees recursive API — one request for all ~2000 files.
 */
export async function fetchAllGesetzeFiles(): Promise<GitTreeItem[]> {
  const headers = getGitHubHeaders();

  // Step 1: Get HEAD commit SHA from master branch
  const branchRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_REPO}/branches/master`,
    { headers, signal: AbortSignal.timeout(15_000) }
  );
  if (!branchRes.ok) {
    throw new Error(`GitHub branch fetch failed: ${branchRes.status} ${await branchRes.text().catch(() => "")}`);
  }
  const branch = await branchRes.json() as { commit: { sha: string } };
  const treeSha = branch.commit.sha;

  // Step 2: Fetch all files recursively (bundestag/gesetze ~2000 files, well under 100k limit)
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_REPO}/git/trees/${treeSha}?recursive=1`,
    { headers, signal: AbortSignal.timeout(30_000) }
  );
  if (!treeRes.ok) {
    throw new Error(`GitHub tree fetch failed: ${treeRes.status}`);
  }
  const tree = await treeRes.json() as { tree: GitTreeItem[]; truncated: boolean };

  if (tree.truncated) {
    // Should not happen for bundestag/gesetze — it has ~2000 files, limit is 100k nodes
    throw new Error("GitHub git tree response was truncated — unexpected for bundestag/gesetze");
  }

  // Filter to only {letter}/{slug}/index.md files (3-part path, ends in /index.md)
  return tree.tree.filter(item =>
    item.type === "blob" &&
    item.path.endsWith("/index.md") &&
    item.path.split("/").length === 3
  );
}

/**
 * Fetch raw Markdown content for a single Gesetz file.
 * @param path - File path as returned by fetchAllGesetzeFiles, e.g. "b/bgb/index.md"
 */
export async function fetchRawFileContent(path: string): Promise<string> {
  const url = `${RAW_BASE}/${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`Raw file fetch failed (${res.status}): ${url}`);
  }
  return res.text();
}
