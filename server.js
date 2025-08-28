
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GI_BASE = process.env.GI_BASE || "https://api.golfintelligence.com";
const GI_CLIENT_ID = process.env.GI_CLIENT_ID || "";
const GI_API_TOKEN = process.env.GI_API_TOKEN || "";
const PORT = process.env.PORT || 8080;

if (!GI_CLIENT_ID || !GI_API_TOKEN) {
  console.warn("[WARN] GI_CLIENT_ID or GI_API_TOKEN not set. The proxy will fail to authenticate.");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

// In-memory caches
let accessToken = null;
let tokenExpiry = 0;
const cache = new Map();
const GPS_TTL_MS = 10 * 60 * 1000;
const SEARCH_TTL_MS = 2 * 60 * 1000;

async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry - 10_000) return accessToken;

  // GI auth requires application/x-www-form-urlencoded
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("code", GI_API_TOKEN);
  params.append("client_id", GI_CLIENT_ID);

  const r = await fetch(`${GI_BASE}/auth/authenticateToken`, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GI auth failed ${r.status}: ${text}`);
  }

  const data = await r.json();
  accessToken = data?.accessToken || data?.access_token;
  const exp = data?.expiresIn || data?.expires_in || 3300;
  tokenExpiry = now + exp * 1000;
  if (!accessToken) throw new Error("No accessToken in GI auth response");
  return accessToken;
}



function setCache(key, data, ttl) { cache.set(key, { data, expiry: Date.now() + ttl }); }
function getCache(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.expiry) { cache.delete(key); return null; }
  return v.data;
}

// Search
app.get("/gi/courses", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const cached = getCache("s:" + q);
    if (cached) return res.json(cached);

    const token = await getAccessToken();
    const r = await fetch(`${GI_BASE}/courses/searchCourseGroups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "accept": "application/json"
      },
      body: JSON.stringify({
        rows: 10,
        offset: 0,
        keywords: q,
        countryCode: "",
        regionCode: "",
        gpsCoordinate: { latitude: 0, longitude: 0 }
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    const payload = data?.data || data;
    setCache("s:" + q, payload, SEARCH_TTL_MS);
    res.json(payload);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// GPS by publicId
app.get("/gi/courses/:publicId/gps", async (req, res) => {
  try {
    const id = req.params.publicId;
    const cached = getCache("g:" + id);
    if (cached) return res.json(cached);

    const token = await getAccessToken();
    const r = await fetch(`${GI_BASE}/courses/getCourseGroupGPS?publicId=${encodeURIComponent(id)}`, {
      headers: { "Authorization": `Bearer ${token}`, "accept": "application/json" }
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    setCache("g:" + id, data, GPS_TTL_MS);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "web", "index.html")));
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`DriveDen GPS running on port ${PORT}`);
});



