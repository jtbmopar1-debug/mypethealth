import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import reviewSource from "../../../knowledge/pethealth_knowledge_base.json";
import { AdminKnowledgeEditor, type KnowledgeReviewCandidate } from "@/components/admin-knowledge-editor";
import { isAdminEmail } from "@/services/admin-auth";
import { readShopifySessionOrLocalDev, SHOPIFY_SESSION_COOKIE } from "@/services/shopify/customer-auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = readShopifySessionOrLocalDev(cookieStore.get(SHOPIFY_SESSION_COOKIE)?.value);
  if (!session?.email || !isAdminEmail(session.email)) redirect("/");

  const reviewCandidates: KnowledgeReviewCandidate[] = reviewSource.records.map((entry) => ({
    id: entry.id,
    question: entry.question,
    answer: entry.answer,
    category: entry.category,
    safetyNote: entry.safety_note || "",
    tags: entry.tags,
  }));

  return (
    <main className="admin-page">
      <div className="admin-container">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to assistant</Link>
        <div className="admin-heading">
          <span className="eyebrow">Restricted staff workspace</span>
          <h1>Buddy knowledge editor</h1>
          <p>Add reviewed answers to real customer questions, save unfinished work as drafts, and publish approved guidance directly to Buddy. Only configured admin email addresses can access this page or its API.</p>
        </div>

        <AdminKnowledgeEditor builtInCount={7} reviewCandidates={reviewCandidates} />
      </div>
    </main>
  );
}
