# חיבור Firebase לאפליקציית Indigo

כרגע האפליקציה תעבוד גם בלי Firebase ותשמור מקומית בדפדפן.
כדי לשמור הרשמות בענן, צריך להכניס את הגדרות Firebase בקובץ `firebase-config.js`.

## שלבים ב-Firebase

1. היכנסי ל-Firebase Console.
2. פתחי או צרי Project.
3. הוסיפי Web App.
4. העתיקי את `firebaseConfig`.
5. פתחי את `firebase-config.js`.
6. החליפי את:

```js
window.INDIGO_FIREBASE_CONFIG = null;
```

ב-config שקיבלת מ-Firebase.

## Firestore

1. ב-Firebase Console פתחי Firestore Database.
2. צרי Database.
3. בחרי Production או Test לפי הצורך.
4. האפליקציה תשמור מסמך אחד:

```text
indigoApp/state
```

ובתוכו את נתוני האפליקציה.

## Rules זמניים לבדיקה

ה-rules האלה פתוחים ומתאימים רק לבדיקה ראשונית:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /indigoApp/{document} {
      allow read, write: if true;
    }
  }
}
```

לפני שימוש אמיתי עם לקוחות, צריך להקשיח הרשאות עם Firebase Auth:
- משתמש רגיל רואה רק את ההרשמות שלו.
- מנהל מועדון ואדמין רואים ומנהלים את כל ההרשמות.
- רק אדמין משנה roles.

## פריסה ל-Netlify

אחרי שמעדכנים `firebase-config.js`, מעלים מחדש ל-Netlify את כל התיקייה, כולל:

- `index.html`
- `app.js`
- `styles.css`
- `firebase-config.js`
- `firebase-cloud.js`
- `netlify.toml`
- `indigo-logo-default.jpg`
- `assets/`
