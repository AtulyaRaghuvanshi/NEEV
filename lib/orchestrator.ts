import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { retrieveRules, RuleEntry } from "@/lib/rules";
import { runAI } from "@/lib/server";

export type PlanStep = { id: string; title: string; description: string; office: string; url?: string; source?: string; state: "ready" | "locked" | "complete" };
type CaseRecord = { id: string; service: string; state: string; district: string; language: "en" | "hi"; profile: Record<string, unknown>; documents?: unknown[] };
type AgentOutputs = {
  documentAgent: { available: boolean; artifact: "draft-affidavit-pdf" };
  appointmentAgent: { booked: false; reason: string; locator?: string };
  submissionAgent: { checklist: string[] };
  notificationAgent: { enabled: false; reason: string };
};

const PathwayState = Annotation.Root({
  caseRecord: Annotation<CaseRecord>,
  rules: Annotation<RuleEntry[]>({ default: () => [], reducer: (_, next) => next }),
  steps: Annotation<PlanStep[]>({ default: () => [], reducer: (_, next) => next }),
  retrievalMode: Annotation<"structured-official-rules" | "ai-fallback">,
  warnings: Annotation<string[]>({ default: () => [], reducer: (left, right) => [...left, ...right] }),
  agents: Annotation<AgentOutputs>,
});

function buildFromRules(caseRecord: CaseRecord, rules: RuleEntry[]) {
  const language = caseRecord.language || "en"; const documents = caseRecord.profile.documents as string[] || [];
  const hasIdentity = documents.some((document) => ["Voter ID", "PAN card", "Aadhaar"].includes(document));
  const hasAddress = documents.some((document) => ["Ration card", "Voter ID", "Aadhaar", "Panchayat record"].includes(document));
  const steps: PlanStep[] = [];
  if (caseRecord.service === "Aadhaar enrolment" && !(hasIdentity && hasAddress)) {
    const residence = retrieveRules("Residence certificate", caseRecord.state)[0];
    if (residence) steps.push({ id: residence.id, title: residence.title[language], description: residence.guidance[language], office: residence.office, url: residence.officialUrl, source: residence.sourceUrl, state: "ready" });
    const hof = rules.find((rule) => rule.id === "uidai-hof-enrolment");
    if (hof) steps.push({ id: hof.id, title: hof.title[language], description: hof.guidance[language], office: hof.office, url: hof.officialUrl, source: hof.sourceUrl, state: steps.length ? "locked" : "ready" });
    const enrolment = rules.find((rule) => rule.id === "uidai-document-enrolment");
    if (enrolment) steps.push({ id: enrolment.id, title: language === "en" ? "Complete Aadhaar enrolment" : "आधार नामांकन पूरा करें", description: enrolment.guidance[language], office: enrolment.office, url: enrolment.officialUrl, source: enrolment.sourceUrl, state: "locked" });
    return steps;
  }
  return rules.slice(0, 4).map((rule, index) => ({ id: rule.id, title: rule.title[language], description: rule.guidance[language], office: rule.office, url: rule.officialUrl, source: rule.sourceUrl, state: index === 0 ? "ready" : "locked" }));
}

const retrieveNode = (state: typeof PathwayState.State) => ({ rules: retrieveRules(state.caseRecord.service, state.caseRecord.state, JSON.stringify(state.caseRecord.profile)) });
const planNode = async (state: typeof PathwayState.State) => {
  const deterministic = buildFromRules(state.caseRecord, state.rules); if (deterministic.length) return { steps: deterministic, retrievalMode: "structured-official-rules" as const };
  const generated = await runAI<{ steps: { title: string; description: string; office: string; officialUrl?: string }[] }>({ prompt: `A user in ${state.caseRecord.district}, ${state.caseRecord.state}, India wants ${state.caseRecord.service}. Evidence: ${JSON.stringify(state.caseRecord.profile)}. No matching local rule was found. Return exactly one shortest sequence, make no assumptions, identify uncertainty, and do not invent URLs. JSON: {"steps":[{"title":"","description":"","office":"","officialUrl":""}]}. Language: ${state.caseRecord.language}.` });
  return { retrievalMode: "ai-fallback" as const, steps: generated.steps.slice(0, 5).map((step, index) => ({ id: `fallback-${index}`, title: step.title, description: `${step.description} (AI fallback: verify with the named authority.)`, office: step.office, url: step.officialUrl, state: index === 0 ? "ready" as const : "locked" as const })) };
};
function official(url?: string) { if (!url) return undefined; try { const host = new URL(url).hostname; return host.endsWith(".gov.in") || host === "uidai.gov.in" || host.endsWith(".uidai.gov.in") || host === "bhuvan.nrsc.gov.in" ? url : undefined; } catch { return undefined; } }
const verifyNode = (state: typeof PathwayState.State) => {
  const warnings: string[] = []; let readyFound = false; const steps = state.steps.map((step) => { const url = official(step.url); const source = official(step.source); if (step.url && !url) warnings.push(`Removed unverified service URL from ${step.id}`); if (step.source && !source) warnings.push(`Removed unverified source URL from ${step.id}`); const nextState = step.state === "complete" ? "complete" : !readyFound && step.state === "ready" ? "ready" : "locked"; if (nextState === "ready") readyFound = true; return { ...step, url, source, state: nextState }; }); return { steps, warnings };
};
const dispatchNode = (state: typeof PathwayState.State) => ({ agents: {
  documentAgent: { available: true, artifact: "draft-affidavit-pdf" as const },
  appointmentAgent: { booked: false as const, reason: "No reliable free booking API is available; use the official locator.", locator: state.steps.find((step) => step.url)?.url },
  submissionAgent: { checklist: ["Original user-confirmed evidence", ...state.steps.map((step) => step.title)] },
  notificationAgent: { enabled: false as const, reason: "Disabled in the free MVP; case progress remains visible after sign-in." },
} });

const pathwayGraph = new StateGraph(PathwayState).addNode("retrieve_rules", retrieveNode).addNode("plan_dependencies", planNode).addNode("verify_claims", verifyNode).addNode("dispatch_agents", dispatchNode).addEdge(START, "retrieve_rules").addEdge("retrieve_rules", "plan_dependencies").addEdge("plan_dependencies", "verify_claims").addEdge("verify_claims", "dispatch_agents").addEdge("dispatch_agents", END).compile();

export async function orchestratePathway(caseRecord: CaseRecord) { return pathwayGraph.invoke({ caseRecord }); }
