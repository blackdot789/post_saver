import type { User } from "firebase/auth";
import { getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { newUserDoc } from "@postsaver/core";
import { readLocal, writeLocal } from "../lib/storage.ts";
import { userRef } from "./firestore.ts";

const CHECKED_KEY = "ps:profile-ok:";

/**
 * Creates the account's profile document (`users/{uid}`: email, settings, sync epoch) the first
 * time a verified account uses the app. Checked once per device; offline, it tries next time.
 */
export async function ensureProfile(user: User): Promise<void> {
  if (!user.email || readLocal(CHECKED_KEY + user.uid)) return;
  const ref = userRef(user.uid);
  const snap = await getDocFromServer(ref);
  if (!snap.exists()) {
    await setDoc(ref, newUserDoc({ email: user.email, displayName: user.displayName, now: serverTimestamp() }));
  }
  writeLocal(CHECKED_KEY + user.uid, "1");
}
