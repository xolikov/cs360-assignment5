import http from "node:http";
import { pathToFileURL } from "node:url";
import { TranscriptStore } from "./transcriptStore.js";

function sendJSON(response, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(payload);
}

async function readJSON(request) {
  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
  }
  if (!rawBody) {
    return {};
  }
  return JSON.parse(rawBody);
}

export function createAppServer(store = new TranscriptStore()) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "POST" && url.pathname === "/transcripts") {
        const body = await readJSON(request);
        return sendJSON(response, 201, { studentID: store.addStudent(body.name) });
      }

      if (request.method === "GET" && url.pathname === "/studentids") {
        return sendJSON(response, 200, store.getStudentIDs(url.searchParams.get("name") ?? undefined));
      }

      if (
        request.method === "GET" &&
        parts.length === 2 &&
        parts[0] === "transcripts"
      ) {
        return sendJSON(response, 200, store.getTranscript(parts[1]));
      }

      if (
        request.method === "DELETE" &&
        parts.length === 2 &&
        parts[0] === "transcripts"
      ) {
        store.deleteStudent(parts[1]);
        return sendJSON(response, 204);
      }

      if (
        request.method === "POST" &&
        parts.length === 3 &&
        parts[0] === "transcripts"
      ) {
        const body = await readJSON(request);
        return sendJSON(
          response,
          201,
          store.addGrade(parts[1], parts[2], body.grade),
        );
      }

      if (
        request.method === "PUT" &&
        parts.length === 3 &&
        parts[0] === "transcripts"
      ) {
        const body = await readJSON(request);
        return sendJSON(
          response,
          200,
          store.changeGrade(parts[1], parts[2], body.grade),
        );
      }

      if (
        request.method === "GET" &&
        parts.length === 3 &&
        parts[0] === "transcripts"
      ) {
        const grade = store.getGrade(parts[1], parts[2]);
        if (grade === undefined) {
          return sendJSON(response, 404, { error: "Grade not found" });
        }
        return sendJSON(response, 200, {
          studentID: Number(parts[1]),
          course: parts[2].toUpperCase(),
          grade,
        });
      }

      return sendJSON(response, 404, { error: "Unknown request" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("not found") ? 404 : 409;
      return sendJSON(response, status, { error: message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4001);
  createAppServer().listen(port, () => {
    console.log(`Transcript Manager listening on http://localhost:${port}`);
  });
}
