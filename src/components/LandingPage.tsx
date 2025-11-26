import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearToken, getToken, getUserFromToken } from "../helpers/authClient";
import { loadGeneratedSession, saveGeneratedSession } from "../helpers/sessionStore";
import type { NormalizedContent, StudyMode } from "../types/content";
import { LoadingIndicator } from "./LoadingIndicator";
import { ModeSelector } from "./ModeSelector";
import { ResultPreview } from "./ResultPreview";
import { useToast } from "./ToastProvider";
import { ThemeInput } from "./ThemeInput";

export const LandingPage = () => {
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);
  const [theme, setTheme] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<NormalizedContent | null>(null);
  const [rawJson, setRawJson] = useState<string>("");
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const isAdmin = userRole === "admin";

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/signin");
      return;
    }
    const user = getUserFromToken();
    if (user) {
      setUserEmail(user.email);
      setUserRole(user.role);
    }
    const stored = loadGeneratedSession();
    if (stored) {
      setSelectedMode(stored.mode);
      setTheme(stored.theme);
      setContent(stored.content);
      setRawJson(stored.rawJson);
    }
  }, [navigate]);

  const isSubmitDisabled = useMemo(
    () => loading || theme.trim().length === 0 || !selectedMode,
    [loading, selectedMode, theme],
  );

  const generateViaBackend = async (mode: StudyMode, themeValue: string) => {
    const token = getToken();
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query: `
          mutation GenerateStudyContent($mode: String!, $theme: String!) {
            generateStudyContent(mode: $mode, theme: $theme)
          }
        `,
        variables: { mode, theme: themeValue },
      }),
    });

    if (!res.ok) throw new Error(`Backend request failed (${res.status})`);
    const json = (await res.json()) as {
      data?: { generateStudyContent?: string };
      errors?: { message: string }[];
    };
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    if (!json.data?.generateStudyContent) throw new Error("No content returned.");
    return json.data.generateStudyContent;
  };

  const normalizeFromServer = (
    raw: string,
    mode: StudyMode,
    themeValue: string,
  ): NormalizedContent | null => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      const items = parsed.map((item, idx) => {
        const record = (item ?? {}) as Record<string, unknown>;
        const prompt = typeof record.question === "string" ? record.question : "";
        const answer = typeof record.answer === "string" ? record.answer : "";
        const options =
          mode === "multiple-choice" && Array.isArray(record.choices)
            ? (record.choices.filter((c) => typeof c === "string") as string[])
            : undefined;
        const level = typeof record.level === "string" ? record.level : null;
        const topic = typeof record.topic === "string" ? record.topic : null;
        const themeVal = typeof record.theme === "string" ? record.theme : themeValue;
        return {
          id: String(record.id ?? `${mode}-${idx}`),
          kind: mode,
          prompt,
          answer,
          options,
          theme: themeVal,
          level,
          topic,
        };
      });
      return { mode, theme: themeValue, items } satisfies NormalizedContent;
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    const token = getToken();
    if (!token) {
      showToast("Please sign in as admin to generate content.", "error");
      navigate("/signin");
      return;
    }
    if (!isAdmin) {
      showToast("Only admins can generate content. Please contact an admin.", "error");
      return;
    }
    const trimmedTheme = theme.trim();

    if (!selectedMode && trimmedTheme === "") {
      setError("Please choose a mode and enter a theme first.");
      return;
    }

    if (!selectedMode) {
      setError("Choose Flashcards or Multiple Choice to continue.");
      return;
    }

    if (!trimmedTheme) {
      setError("Enter a theme so we can generate content.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const raw = await generateViaBackend(selectedMode, trimmedTheme);
      const normalized = normalizeFromServer(raw, selectedMode, trimmedTheme);

      if (!normalized) {
        throw new Error("Invalid content returned from server.");
      }

      setRawJson(raw);
      setContent(normalized);
      saveGeneratedSession({
        content: normalized,
        rawJson: raw,
        theme: trimmedTheme,
        mode: selectedMode,
      });
      showToast("Generated content received from server.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
      showToast(
        submitError instanceof Error
          ? submitError.message
          : "We couldn't generate content. Please retry.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const AuthHeader = (
    <header className="mx-auto max-w-4xl space-y-3 text-center">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
        German Practice
      </p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
        Build your next study session in seconds.
      </h1>
      <p className="mt-3 text-lg text-slate-600">
        Select a learning mode, add a theme, and generate content to study.
      </p>
      {userEmail ? (
        <div className="mt-2 flex items-center justify-center gap-3 text-sm text-slate-700">
          <span>
            Signed in as <span className="font-semibold">{userEmail}</span>{" "}
            {userRole ? `(${userRole})` : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              clearToken();
              navigate("/signin");
            }}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/signin"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Sign in
          </Link>
        </div>
      )}
    </header>
  );

  const AdminSection = (
    <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
        <ModeSelector
          selectedMode={selectedMode}
          disabled={loading || !isAdmin}
          onSelect={(mode) => setSelectedMode(mode)}
        />

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Theme
            </p>
            <p className="text-lg text-slate-700">
              Describe what you want to practice. We will generate questions or flashcards
              around it.
            </p>
            <div className="w-full max-w-3xl">
              <ThemeInput
                value={theme}
                onChange={setTheme}
                onSubmit={handleSubmit}
                loading={loading}
              />
            </div>
            {selectedMode ? (
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Stored mode: {selectedMode}
              </p>
            ) : (
              <p className="text-xs uppercase tracking-[0.22em] text-amber-600">
                Select a mode to continue
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">Submission</p>
            {loading ? (
              <LoadingIndicator label="Generating" />
            ) : error ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {error}
              </span>
            ) : (
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Ready</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled || !isAdmin}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Generating..." : "Submit selection"}
          </button>
          <p className="text-xs text-slate-600">
            {isAdmin
              ? "On submit we validate mode + theme, call the backend generator, and preview the returned content."
              : "Sign in with an admin account to generate new content."}
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm lg:sticky lg:top-16">
        <p className="text-sm font-semibold text-slate-900">Preview & Normalized Data</p>
        <ResultPreview data={content} rawJson={rawJson} />
      </div>
    </section>
  );

  const UserSection = (
    <section className="mx-auto max-w-4xl space-y-6 text-center">
      <h2 className="text-3xl font-semibold text-slate-900">Practice smarter, daily.</h2>
      <p className="text-lg text-slate-600">
        This app helps you review flashcards and multiple-choice questions using spaced
        repetition. Track your progress per item and pick up where you left off.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/exercise"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Go to exercises →
        </Link>
        <Link
          to="/signin"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Switch account
        </Link>
      </div>
    </section>
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-20 top-10 h-52 w-52 rounded-full bg-emerald-200 blur-3xl" />
        <div className="absolute bottom-0 right-8 h-64 w-64 rounded-full bg-sky-200 blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {AuthHeader}
        {isAdmin ? AdminSection : UserSection}
      </div>
    </main>
  );
};
