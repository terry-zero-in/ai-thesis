import { PageStub } from "@/components/primitives/PageStub";

export default function MemosPage() {
  return (
    <PageStub
      title="Memos"
      intent="Investment memos — drafts, approvals, archive. Reticle Sessions list pattern is the visual reference."
      bullets={[
        "List view: ticker · memo title · status (draft / approved / archived) · last edit",
        "Filter by status; sort by date or ticker",
        "Click → memo detail with full markdown body",
        "Per-memo: linked composite snapshot + AIQ snapshot at memo time",
      ]}
    />
  );
}
