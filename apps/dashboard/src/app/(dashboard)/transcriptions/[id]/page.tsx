import TranscriptionDetailClient from "@/components/pages/TranscriptionDetailClient";
import { SEED_TRANSCRIPTION_IDS } from "@/lib/seed/data";

export default function TranscriptionDetailPage({ params }: { params: { id: string } }) {
  return <TranscriptionDetailClient id={params.id} />;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  return SEED_TRANSCRIPTION_IDS.map((id) => ({ id }));
}
