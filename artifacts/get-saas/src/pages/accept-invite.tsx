import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Loader2, Check, AlertCircle, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-context";
import { useToast } from "@/hooks/use-toast";
import {
  BRAND,
  tone,
  line,
  type,
  r,
  cardStyle,
  PrimaryButton,
  SecondaryButton,
  GhostButton,
  BrandLogo,
  Pill,
  IconTile,
} from "@/lib/ui";

type InviteInfo = {
  email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "expired" | "revoked";
  projectName: string;
  expiresAt: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; invite: InviteInfo }
  | { kind: "error"; message: string };

function buildBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

export default function AcceptInvitePage() {
  const [, params] = useRoute("/accept-invite/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ kind: "error", message: "Invite link is missing or invalid." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/invites/${encodeURIComponent(token)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (cancelled) return;
          setState({
            kind: "error",
            message: body?.error || "This invite link isn't valid.",
          });
          return;
        }
        const invite: InviteInfo = await res.json();
        if (cancelled) return;
        setState({ kind: "ok", invite });
      } catch {
        if (cancelled) return;
        setState({
          kind: "error",
          message: "Couldn't load invite. Check your connection and try again.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const next = useMemo(() => `/accept-invite/${token}`, [token]);

  const acceptInvite = async () => {
    if (state.kind !== "ok") return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't accept invite",
          description: body?.error || "Please try again.",
        });
        setAccepting(false);
        return;
      }
      if (body.alreadyMember) {
        toast({ title: "You're already a member", description: `Opening ${state.invite.projectName}.` });
      } else {
        toast({ title: "Welcome", description: `You now have access to ${state.invite.projectName}.` });
      }
      setLocation(`/app/editor/${body.projectId}`);
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't accept invite",
        description: "Network error. Please try again.",
      });
      setAccepting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BRAND.paper,
        color: BRAND.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
          <BrandLogo width={140} />
        </div>

        <div style={{ ...cardStyle, padding: 28 }}>
          {state.kind === "loading" || authLoading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "32px 0" }}>
              <Loader2 className="animate-spin" style={{ width: 28, height: 28, color: tone[400] }} />
              <p style={{ fontSize: type.sm, color: tone[500] }}>Loading invite…</p>
            </div>
          ) : state.kind === "error" ? (
            <ErrorView message={state.message} />
          ) : (
            <ReadyView
              invite={state.invite}
              user={user ?? null}
              accepting={accepting}
              onAccept={acceptInvite}
              next={next}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <IconTile icon={AlertCircle} variant="soft" size={52} />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
        Invite unavailable
      </h1>
      <p style={{ fontSize: type.base, color: tone[600], lineHeight: 1.55, marginBottom: 24 }}>
        {message}
      </p>
      <Link href="/">
        <span>
          <SecondaryButton block>Back to home</SecondaryButton>
        </span>
      </Link>
    </div>
  );
}

function ReadyView({
  invite,
  user,
  accepting,
  onAccept,
  next,
}: {
  invite: { email: string; role: string; status: string; projectName: string };
  user: { email: string; name: string } | null;
  accepting: boolean;
  onAccept: () => void;
  next: string;
}) {
  if (invite.status === "accepted") {
    return (
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <IconTile icon={Check} variant="accent" size={52} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
          Invite already used
        </h1>
        <p style={{ fontSize: type.base, color: tone[600], lineHeight: 1.55, marginBottom: 24 }}>
          This invite has already been accepted. Sign in to access your project.
        </p>
        <Link href="/login">
          <span>
            <PrimaryButton block>Sign in</PrimaryButton>
          </span>
        </Link>
      </div>
    );
  }

  if (invite.status === "expired") {
    return (
      <ErrorView message="This invite has expired. Ask the project owner to send a new one." />
    );
  }

  if (invite.status === "revoked") {
    return (
      <ErrorView message="This invite has been revoked by the project owner. Ask them to send a new one if you still need access." />
    );
  }

  const emailMatches = user && user.email.toLowerCase() === invite.email.toLowerCase();

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.25 }}>
          You're invited
        </h1>
        <p style={{ fontSize: type.base, color: tone[600], lineHeight: 1.55 }}>
          Join <strong style={{ color: BRAND.ink }}>{invite.projectName}</strong> as{" "}
          <Pill>{invite.role}</Pill>.
        </p>
      </div>

      <div
        style={{
          padding: 14,
          border: `1px solid ${line.base}`,
          borderRadius: r.md,
          background: tone[50],
          marginBottom: 20,
        }}
      >
        <p style={{ fontSize: type.xs, color: tone[500], marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Invite for
        </p>
        <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink, wordBreak: "break-all" }}>
          {invite.email}
        </p>
      </div>

      {!user ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.55, marginBottom: 4 }}>
            Sign in or create an account with <strong style={{ color: BRAND.ink }}>{invite.email}</strong> to accept.
          </p>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>
            <span>
              <PrimaryButton block>
                Sign in <ArrowRight style={{ width: 16, height: 16 }} />
              </PrimaryButton>
            </span>
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`}>
            <span>
              <SecondaryButton block>Create an account</SecondaryButton>
            </span>
          </Link>
        </div>
      ) : !emailMatches ? (
        <div>
          <p
            style={{
              fontSize: type.sm,
              color: BRAND.ink,
              background: tone[50],
              border: `1px solid ${BRAND.ink}`,
              padding: 12,
              borderRadius: r.md,
              lineHeight: 1.55,
              marginBottom: 16,
            }}
          >
            You're signed in as <strong>{user.email}</strong>, but this invite is for{" "}
            <strong>{invite.email}</strong>. Sign in with that account to accept.
          </p>
          <SignOutAndRetry next={next} />
        </div>
      ) : (
        <PrimaryButton block onClick={onAccept} loading={accepting} disabled={accepting}>
          {accepting ? "Joining…" : (<>Accept invite <ArrowRight style={{ width: 16, height: 16 }} /></>)}
        </PrimaryButton>
      )}
    </div>
  );
}

function SignOutAndRetry({ next }: { next: string }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  return (
    <GhostButton
      block
      onClick={async () => {
        try {
          await fetch(`/api/auth/logout`, { method: "POST", credentials: "include" });
        } catch {}
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation(`/login?next=${encodeURIComponent(next)}`);
      }}
    >
      Sign out and switch account
    </GhostButton>
  );
}
