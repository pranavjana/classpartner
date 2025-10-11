import ClassDetailClient from "@/components/pages/ClassDetailClient";
import { SEED_CLASS_SLUGS } from "@/lib/seed/data";

export default function ClassDetailPage({ params }: { params: { slug: string } }) {
  return <ClassDetailClient slug={params.slug} />;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return SEED_CLASS_SLUGS.map((slug) => ({ slug }));
}
