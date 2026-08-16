import Link from "next/link";
import { ArrowLeft, BookOpen, ChartNoAxesColumnIncreasing, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { knowledgeService } from "@/services/knowledge/local-knowledge-service";

export default async function AdminPage() {
  const entries = await knowledgeService.listEnabled();
  const categories = new Set(entries.map((entry) => entry.category));
  return (
    <main className="admin-page">
      <div className="admin-container">
        <Link href="/" className="back-link"><ArrowLeft size={16} /> Back to assistant</Link>
        <div className="admin-heading"><span className="eyebrow">Staff workspace · preview</span><h1>My Pet Health knowledge admin</h1><p>This scaffold shows where staff knowledge, conversation review and recommendation controls will live.</p></div>
        <div className="admin-stats">
          <article><BookOpen /><strong>{entries.length}</strong><span>Enabled knowledge entries</span></article>
          <article><SlidersHorizontal /><strong>{categories.size}</strong><span>Knowledge categories</span></article>
          <article><MessagesSquare /><strong>—</strong><span>Conversations (Supabase later)</span></article>
          <article><ChartNoAxesColumnIncreasing /><strong>—</strong><span>Unanswered questions</span></article>
        </div>
        <section className="admin-panel">
          <div><span className="eyebrow">Current local knowledge</span><h2>Published entries</h2></div>
          <div className="entry-list">{entries.map((entry) => <article key={entry.id}><span>{entry.category.replaceAll("-", " ")}</span><strong>{entry.title}</strong><p>{entry.summary}</p><button disabled>Edit later</button></article>)}</div>
        </section>
      </div>
    </main>
  );
}
