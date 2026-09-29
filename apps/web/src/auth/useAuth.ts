import { onIdTokenChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getAuth } from "./session.ts";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  /** Signed in, but the email isn't verified, so nothing can sync yet. */
  | { status: "unverified"; user: User }
  | { status: "ready"; user: User };

function toState(user: User | null): AuthState {
  if (!user) return { status: "signed-out" };
  return user.emailVerified ? { status: "ready", user } : { status: "unverified", user };
}

/** The signed-in user. Updates on sign-in, sign-out and token refresh (e.g. after verifying). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  useEffect(() => onIdTokenChanged(getAuth(), (user) => setState(toState(user))), []);
  return state;
}
