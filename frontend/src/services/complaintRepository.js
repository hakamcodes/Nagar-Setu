import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase.js";
import { readStore, writeStore } from "./prototypeStore.js";
import { toDate } from "../utils/date.js";
import { computeSlaDueAt } from "../config/sla.js";

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
}

export async function listComplaints() {
  if (isFirebaseConfigured) {
    const snapshot = await getDocs(query(collection(db, "complaints"), orderBy("createdAt", "desc")));
    return snapshot.docs.map((item) => normalizeComplaint({ complaintId: item.id, ...item.data() }));
  }
  return readStore().complaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeComplaint(complaint) {
  const createdAt = toDate(complaint.createdAt)?.toISOString() || new Date().toISOString();
  const updatedAt = toDate(complaint.updatedAt)?.toISOString() || createdAt;
  return {
    supportCount: 0,
    status: "Open",
    adminNotes: "",
    resolutionImageData: "",
    resolvedAt: "",
    timeline: [{ label: "Reported", at: createdAt }],
    city: "",
    state: "",
    country: "",
    municipality: "",
    ward: null,
    zone: null,
    locality: "",
    road: "",
    formattedAddress: "",
    aiSubcategory: "",
    aiSeverityScore: null,
    aiCivicImpactScore: null,
    aiRisks: null,
    aiRecommendedAction: "",
    aiSuggestedDepartment: "",
    duplicatePercentage: 0,
    clusterId: "",
    slaDueAt: "",
    assignedOfficer: "",
    assignedOfficerEmail: "",
    escalationLevel: 0,
    escalatedAt: "",
    imageHash: "",
    ...complaint,
    createdAt,
    updatedAt,
    timeline: (complaint.timeline?.length ? complaint.timeline : [{ label: "Reported", at: createdAt }]).map((event) => ({
      ...event,
      at: toDate(event.at)?.toISOString() || createdAt,
    })),
  };
}

export async function createComplaint(payload) {
  const now = new Date().toISOString();
  const complaint = {
    supportCount: 0,
    status: "Open",
    adminNotes: "",
    resolutionImageData: "",
    resolvedAt: "",
    timeline: [{ label: "Reported", at: now }],
    createdAt: now,
    updatedAt: now,
    slaDueAt: computeSlaDueAt(payload.aiPriority, now),
    escalationLevel: 0,
    escalatedAt: "",
    ...payload,
  };

  if (isFirebaseConfigured) {
    const docRef = await addDoc(collection(db, "complaints"), complaint);
    return { complaintId: docRef.id, ...complaint };
  }

  const store = readStore();
  const localComplaint = {
    complaintId: uid("cmp"),
    ...complaint,
  };
  writeStore({ ...store, complaints: [localComplaint, ...store.complaints] });
  return localComplaint;
}

// A complaint can never move to Resolved without photo evidence attached -
// enforced here so no UI path can bypass it, not just in the form that
// happens to call it today.
function assertResolutionProofPresent(patch, existing) {
  if (patch.status !== "Resolved") return;
  if (patch.resolutionImageData || existing?.resolutionImageData) return;
  throw new Error("A resolution photo is required before marking this complaint Resolved.");
}

export async function updateComplaint(complaintId, patch, actorId = "system") {
  const now = new Date().toISOString();

  if (isFirebaseConfigured) {
    const ref = doc(db, "complaints", complaintId);
    const snapshot = await getDoc(ref);
    const existing = snapshot.exists() ? snapshot.data() : null;
    assertResolutionProofPresent(patch, existing);

    const timeline =
      patch.status && existing && patch.status !== existing.status
        ? [...(existing.timeline || []), { label: patch.status, at: now }]
        : existing?.timeline || [];

    await updateDoc(ref, {
      ...patch,
      timeline,
      updatedAt: now,
      resolvedAt: patch.status === "Resolved" ? now : existing?.resolvedAt || "",
    });

    await addDoc(collection(db, "auditLog"), {
      complaintId,
      actorId,
      actionType: "update_complaint",
      oldValue: "",
      newValue: JSON.stringify(patch),
      createdAt: now,
    });
    return;
  }

  const store = readStore();
  const existingLocal = store.complaints.find((item) => item.complaintId === complaintId);
  assertResolutionProofPresent(patch, existingLocal);

  const complaints = store.complaints.map((item) => {
    if (item.complaintId !== complaintId) return item;
    const timeline =
      patch.status && patch.status !== item.status
        ? [...(item.timeline || []), { label: patch.status, at: now }]
        : item.timeline || [];
    return { ...item, ...patch, timeline, updatedAt: now, resolvedAt: patch.status === "Resolved" ? now : item.resolvedAt };
  });
  const auditLog = [
    {
      actionId: uid("act"),
      complaintId,
      actorId,
      actionType: "update_complaint",
      oldValue: "",
      newValue: JSON.stringify(patch),
      createdAt: now,
    },
    ...store.auditLog,
  ];
  writeStore({ ...store, complaints, auditLog });
}

export async function supportComplaint(complaintId, userId) {
  const now = new Date().toISOString();

  if (isFirebaseConfigured) {
    const voteRef = doc(db, "votes", `${complaintId}_${userId}`);
    const complaintRef = doc(db, "complaints", complaintId);
    return runTransaction(db, async (transaction) => {
      const existing = await transaction.get(voteRef);
      if (existing.exists()) return { alreadySupported: true };

      transaction.set(voteRef, { complaintId, userId, createdAt: now });
      transaction.update(complaintRef, { supportCount: increment(1), updatedAt: now });
      return { alreadySupported: false };
    });
  }

  const store = readStore();
  const existing = store.votes.find((vote) => vote.complaintId === complaintId && vote.userId === userId);
  if (existing) return { alreadySupported: true };
  const vote = { voteId: uid("vote"), complaintId, userId, createdAt: now };
  const complaints = store.complaints.map((item) =>
    item.complaintId === complaintId ? { ...item, supportCount: (item.supportCount || 0) + 1, updatedAt: now } : item,
  );
  writeStore({ ...store, votes: [vote, ...store.votes], complaints });
  return { alreadySupported: false };
}

export async function addAdminNote(complaintId, adminId, note) {
  const now = new Date().toISOString();

  if (isFirebaseConfigured) {
    await addDoc(collection(db, "adminNotes"), { complaintId, adminId, note, createdAt: now });
    await updateDoc(doc(db, "complaints", complaintId), { adminNotes: note, updatedAt: now });
    return;
  }

  const store = readStore();
  const adminNote = { noteId: uid("note"), complaintId, adminId, note, createdAt: now };
  const complaints = store.complaints.map((item) =>
    item.complaintId === complaintId ? { ...item, adminNotes: note, updatedAt: now } : item,
  );
  writeStore({ ...store, adminNotes: [adminNote, ...store.adminNotes], complaints });
}
