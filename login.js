import { auth } from "./firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const submitBtn = document.getElementById("submitBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Logging in...";
    }

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        console.log("LOGIN SUCCESS:", result.user.email);
        
        window.location.replace("./dashboard.html");
    } catch (error) {
        console.error("ERROR CODE:", error.code);
        console.error("ERROR MESSAGE:", error.message);

        message.textContent = error.code + " : " + error.message;

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Login";
        }
    }
});