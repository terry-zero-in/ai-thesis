import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · AI Thesis" };

interface Search {
  next?: string;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { next = "/" } = await searchParams;
  const envConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--canvas)",
      }}
    >
      <div
        style={{
          width: 380,
          padding: "28px 28px 24px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 12px 36px rgba(0,0,0,.55)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          AI Thesis
        </div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text-1)",
            marginBottom: 18,
            letterSpacing: "-.014em",
          }}
        >
          Sign in
        </h1>
        <LoginForm next={next} envConfigured={envConfigured} />
      </div>
    </div>
  );
}
