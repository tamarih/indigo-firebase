(function () {
  const COLLECTION_NAME = "indigoApp";
  const DOCUMENT_ID = "state";
  let firestore = null;
  let documentRef = null;
  let saveTimer = null;
  let enabled = false;

  function hasFirebaseConfig() {
    return Boolean(window.INDIGO_FIREBASE_CONFIG && window.firebase?.initializeApp);
  }

  async function load(localDb) {
    if (!hasFirebaseConfig()) {
      return { db: localDb, enabled: false };
    }

    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.INDIGO_FIREBASE_CONFIG);
      }

      firestore = window.firebase.firestore();
      documentRef = firestore.collection(COLLECTION_NAME).doc(DOCUMENT_ID);
      const snapshot = await documentRef.get();
      enabled = true;

      if (snapshot.exists && snapshot.data()?.db) {
        return { db: snapshot.data().db, enabled: true };
      }

      await documentRef.set({
        db: localDb,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });

      return { db: localDb, enabled: true };
    } catch (error) {
      console.error("Firebase load failed", error);
      enabled = false;
      return { db: localDb, enabled: false, error };
    }
  }

  function save(db) {
    if (!enabled || !documentRef) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      documentRef.set({
        db,
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch((error) => {
        console.error("Firebase save failed", error);
      });
    }, 250);
  }

  window.IndigoCloud = {
    load,
    save,
    isEnabled: () => enabled
  };
})();
