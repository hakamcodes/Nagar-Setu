import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase.js";
import { readStore, writeStore } from "./prototypeStore.js";

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

// In-app only, as agreed - no email/SMS integration here.
export async function notify(forEmail, type, complaintId, message) {
  if (!forEmail) return;
  const record = {
    forEmail: forEmail.toLowerCase(),
    type,
    complaintId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };

  if (isFirebaseConfigured) {
    await addDoc(collection(db, "notifications"), record);
    return;
  }

  const store = readStore();
  writeStore({ ...store, notifications: [{ notificationId: uid("notif"), ...record }, ...(store.notifications || [])] });
}

// Sorted client-side rather than via a Firestore orderBy so this never needs a
// composite index to be created in the console before it works.
export async function listNotificationsFor(email) {
  const lower = (email || "").toLowerCase();
  if (!lower) return [];

  let notifications;
  if (isFirebaseConfigured) {
    const snapshot = await getDocs(query(collection(db, "notifications"), where("forEmail", "==", lower)));
    notifications = snapshot.docs.map((item) => ({ notificationId: item.id, ...item.data() }));
  } else {
    notifications = (readStore().notifications || []).filter((item) => item.forEmail === lower);
  }

  return notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function markNotificationRead(notificationId) {
  if (isFirebaseConfigured) {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    return;
  }
  const store = readStore();
  const notifications = (store.notifications || []).map((item) =>
    item.notificationId === notificationId ? { ...item, read: true } : item,
  );
  writeStore({ ...store, notifications });
}

// Notifications otherwise persist indefinitely (read or not) - this is the
// only way one leaves the list, and it's only ever triggered by the officer
// it belongs to.
export async function deleteNotification(notificationId) {
  if (isFirebaseConfigured) {
    await deleteDoc(doc(db, "notifications", notificationId));
    return;
  }
  const store = readStore();
  const notifications = (store.notifications || []).filter((item) => item.notificationId !== notificationId);
  writeStore({ ...store, notifications });
}
