import ClassDashboardPage from "@/components/classes/ClassDashboardPage";
import { getClassDashboardDetail, SEED_CLASS_SLUGS } from "@/lib/seed/data";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const dynamicParams = false;

export default function ClassDetailPage({ params }: { params: { slug: string } }) {
  const detail = getClassDashboardDetail(params.slug);
  if (!detail) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading class workspace…</div>}>
      <ClassDashboardPage detail={detail} />
    </Suspense>
  );
}

export async function generateStaticParams() {
  return SEED_CLASS_SLUGS.map((slug) => ({ slug }));
}
