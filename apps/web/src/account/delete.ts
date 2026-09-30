import {
  browserPopupRedirectResolver,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type CollectionReference,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { newUserDoc } from "@postsaver/core";
import { clearLocalData, getDb, savesOf, userRef } from "../data/firestore.ts";
import { forgetJobs } from "../import/jobs.ts";

// Deleting an account (CLAUDE.md §6.4, §6.8): everything the account owns, then the account.
// The profile is marked `deleting` first, which is what lets the rules accept deleting live
// saves; if the page closes half-way, the mark is still there and the next visit carries on.
// Order: saves → collections → imports → the profile → the sign-in itself.

/** Documents removed per round trip (a batch takes at most 500 writes). */
const BATCH = 300;

export type SignInKind = "password" | "google";

/** How this account signs in, which decides how its owner confirms the deletion. */
export function signInKind(user: User): SignInKind {
  return user.providerData.some((p) => p.providerId === "password") ? "password" : "google";
}

/**
 * Confirms it's the account's owner at the keyboard. Firebase only deletes an account that
 * signed in moments ago.
 */
export async function confirmOwner(user: User, password?: string): Promise<void> {
  if (signInKind(user) === "password") {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? "", password ?? ""));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider(), browserPopupRedirectResolver);
  }
}

export type DeleteStage = "saves" | "collections" | "imports" | "account";

export interface DeleteProgress {
  stage: DeleteStage;
  /** Documents removed so far, over all stages. */
  removed: number;
}

/** Follows the profile's `deleting` mark: true while a deletion was started and hasn't finished. */
export function useDeleting(uid: string): boolean {
  const [deleting, setDeleting] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        userRef(uid),
        (snap) => setDeleting(snap.data()?.deleting === true),
        () => undefined,
      ),
    [uid],
  );
  return deleting;
}

/** Takes the `deleting` mark back. What was removed already stays removed. */
export function cancelDeletion(uid: string): Promise<void> {
  return updateDoc(userRef(uid), { deleting: false, updatedAt: serverTimestamp() });
}

async function wipe(items: CollectionReference, onRemoved: (count: number) => void): Promise<void> {
  for (;;) {
    // Asked of the server each time, so nothing another device added is left behind.
    const snap = await getDocsFromServer(query(items, limit(BATCH)));
    if (snap.empty) return;
    const batch = writeBatch(getDb());
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    onRemoved(snap.size);
  }
}

/** Wipes what this browser keeps: the library copy, waiting links, imports, remembered settings. */
async function forgetDevice(): Promise<void> {
  await clearLocalData();
  await forgetJobs();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("ps-capture");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("ps:")) localStorage.removeItem(key);
  } catch {
    // Storage is blocked: there was nothing to forget.
  }
}

/**
 * Deletes the account and everything in it. Needs a connection, and `confirmOwner` just before.
 * Rejects with Firestore's or Auth's error when it can't finish (e.g. `resource-exhausted` once
 * the day's limit is used up); calling it again carries on from where it stopped.
 */
export async function deleteAccount(user: User, onProgress: (progress: DeleteProgress) => void): Promise<void> {
  const uid = user.uid;
  const profile = userRef(uid);
  const db = getDb();

  // The mark that allows the deletes. A profile that was never created is created with it.
  const snap = await getDocFromServer(profile);
  if (snap.exists()) await updateDoc(profile, { deleting: true, updatedAt: serverTimestamp() });
  else await setDoc(profile, { ...newUserDoc({ email: user.email ?? "", displayName: user.displayName, now: serverTimestamp() }), deleting: true });

  let removed = 0;
  const stage = (name: DeleteStage) => (count: number) => {
    removed += count;
    onProgress({ stage: name, removed });
  };
  onProgress({ stage: "saves", removed });
  await wipe(savesOf(uid), stage("saves"));
  onProgress({ stage: "collections", removed });
  await wipe(collection(db, "users", uid, "collections"), stage("collections"));
  onProgress({ stage: "imports", removed });
  await wipe(collection(db, "users", uid, "imports"), stage("imports"));

  onProgress({ stage: "account", removed });
  await deleteDoc(profile);
  await deleteUser(user);
  await forgetDevice();
}
