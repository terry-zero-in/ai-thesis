import { PageStub } from "@/components/primitives/PageStub";

interface Params { ticker: string }

export default async function NameDetailPage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  return (
    <PageStub
      title={ticker.toUpperCase()}
      intent="Per-name detail (THS-53). Composite + tier headline, factor decomposition (Q/G/V/AIQ with sub-components), forward-PE history, prior-week comparison, decision history thread."
      bullets={[
        "Header: ticker · name · layer chip · tier badge · final score",
        "Q / G / V / AIQ panels with sub-factor decomposition",
        "Forward-PE history chart (52-week range, sector overlay)",
        "Decision log thread (drives /decisions)",
        "AIQ rubric editor entry point (→ /aiq)",
      ]}
    />
  );
}
