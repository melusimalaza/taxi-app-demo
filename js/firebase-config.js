// Firebase client config — safe to be public; access is controlled by the
// database's security rules, not by keeping this secret.
const firebaseConfig = {
  apiKey: "AIzaSyAsX87mlwJ5VQdDjA1DZ_FTAJ1Dg-rqVdc",
  authDomain: "taxi-app-7196b.firebaseapp.com",
  databaseURL: "https://taxi-app-7196b-default-rtdb.firebaseio.com",
  projectId: "taxi-app-7196b",
  storageBucket: "taxi-app-7196b.firebasestorage.app",
  messagingSenderId: "669755295156",
  appId: "1:669755295156:web:f2911fe943fbbce1029ee1",
};

firebase.initializeApp(firebaseConfig);
