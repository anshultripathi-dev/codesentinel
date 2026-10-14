async function req(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${r.status})`);
  }
  return r.json();
}
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const q = (model, family) => {
  const p = new URLSearchParams();
  if (model) p.set("model", model);
  if (family) p.set("family", family);
  const t = p.toString();
  return t ? `?${t}` : "";
};

export const getFamilies = () => req("/api/families");
export const getModels = (family) => req(`/api/models${q(null, family)}`);
export const getEda = (family) => req(`/api/eda${q(null, family)}`);
export const getRuns = () => req("/api/runs");
export const getRun = (id) => req(`/api/runs/${id}`);
export const deleteRun = (id) => req(`/api/runs/${id}`, { method: "DELETE" });
export const compareRun = (id) => req(`/api/runs/${id}/compare`);
export const analyzeSnippet = (code, filename, model, family) => req("/api/analyze/snippet", json({ code, filename, model: model || null, family }));
export const analyzeDemo = (model, family) => req(`/api/analyze/demo${q(model, family)}`, { method: "POST" });
export const analyzeZip = (file, model, family) => {
  const fd = new FormData();
  fd.append("file", file);
  return req(`/api/analyze/upload${q(model, family)}`, { method: "POST", body: fd });
};
