import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const members = ["Daniel", "Mohan", "Ganesh", "Karthi", "Asgar ali", "Selva", "Design"];
const categories = [
    "Vegetables", "Cosmetics", "Cleaning", "Groceries", "Water",
    "Electricity", "Maintenance", "Room Items", "Other"
];

const DANIEL_EMAIL = "dd2589741@example.com"; // Adjust email if needed

let currentUser = null;
let expenses = [];
let contributions = [];
let notifications = [];

const money = n =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const escapeHTML = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#039;"
    }[c]));

async function resetAllRoomMoney() {
    if (
        !currentUser ||
        !currentUser.email ||
        currentUser.email.toLowerCase() !== DANIEL_EMAIL.toLowerCase()
    ) {
        alert("❌ Only Daniel can reset the room money.");
        return;
    }

    const confirmed = confirm(
        "⚠️ RESET ALL ROOM MONEY?\n\n" +
        "This will delete:\n" +
        "• All contributions\n" +
        "• All expenses\n" +
        "• All notifications\n\n" +
        "This cannot be undone."
    );

    if (!confirmed) return;

    try {
        const collectionsToDelete = ["expenses", "contributions", "notifications"];

        for (const collectionName of collectionsToDelete) {
            const snapshot = await getDocs(collection(db, collectionName));
            for (const documentSnapshot of snapshot.docs) {
                await deleteDoc(doc(db, collectionName, documentSnapshot.id));
            }
        }

        alert("✅ Room money has been reset successfully.");
        window.location.reload();

    } catch (error) {
        console.error("Reset error:", error);
        alert("❌ Reset failed: " + error.message);
    }
}

async function handleAdminMoneyAdjustment(e) {
    e.preventDefault();

    const amountInput = document.getElementById("adminMoneyAmount");
    const noteInput = document.getElementById("adminMoneyNote");

    const amount = Number(amountInput.value);
    const note = noteInput.value.trim();

    if (!amount || isNaN(amount)) {
        alert("Enter a valid amount.");
        return;
    }

    try {
        await addDoc(collection(db, "contributions"), {
            member: "Admin (Adjustment)",
            amount,
            date: new Date().toISOString().split('T')[0],
            note: note || "Admin money adjustment",
            addedByUid: currentUser.uid,
            addedByEmail: currentUser.email,
            createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "notifications"), {
            message: `Admin adjusted room money by ${money(amount)} (${note}).`,
            date: new Date().toLocaleString("en-IN"),
            readBy: [],
            createdAt: serverTimestamp()
        });

        alert("✅ Balance adjusted successfully.");
        amountInput.value = "";
        noteInput.value = "";
    } catch (error) {
        console.error(error);
        alert("Could not adjust money: " + error.message);
    }
}

function setToday() {
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) input.valueAsDate = new Date();
    });
}

function populateSelects() {
    const memberOptions = members.map(m => `<option value="${m}">${m}</option>`).join("");

    ["expenseMember", "moneyMember"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = memberOptions;
    });

    const memberFilter = document.getElementById("memberFilter");
    if (memberFilter) {
        memberFilter.innerHTML =
            '<option value="all">All members</option>' + memberOptions;
    }

    const categoryFilter = document.getElementById("categoryFilter");
    if (categoryFilter) {
        categoryFilter.innerHTML =
            '<option value="all">All categories</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join("");
    }

    setToday();
}

function totalContributions() {
    return contributions.reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

function totalExpenses() {
    return expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

function balance() {
    return totalContributions() - totalExpenses();
}

function render() {
    document.getElementById("balance").textContent = money(balance());
    document.getElementById("contributions").textContent = money(totalContributions());
    document.getElementById("expensesTotal").textContent = money(totalExpenses());

    const unread = notifications.filter(n => !n.readBy?.includes(currentUser?.uid)).length;
    document.getElementById("notificationCount").textContent = unread;

    renderRecent();
    renderExpenses();
    renderMembers();
    renderNotifications();
    renderChart();
}

function expenseHTML(e) {
    return `
    <div class="expense-row">
      <div>
        <div class="item-name">${escapeHTML(e.item)}</div>
        <div class="muted">${escapeHTML(e.date)} · ${escapeHTML(e.member)}</div>
      </div>
      <div><span class="tag">${escapeHTML(e.category)}</span></div>
      <div class="muted">${escapeHTML(e.note || "Common room expense")}</div>
      <div class="amount">${money(e.amount)}</div>
    </div>
  `;
}

function renderRecent() {
    const el = document.getElementById("recentExpenses");
    const rows = [...expenses].slice(0, 5);
    el.innerHTML = rows.length
        ? rows.map(expenseHTML).join("")
        : '<div class="empty">No expenses yet.</div>';
}

function renderExpenses() {
    const search = (document.getElementById("expenseSearch")?.value || "").toLowerCase();
    const cat = document.getElementById("categoryFilter")?.value || "all";
    const mem = document.getElementById("memberFilter")?.value || "all";

    const rows = expenses.filter(e =>
        (!search || `${e.item} ${e.category} ${e.member}`.toLowerCase().includes(search)) &&
        (cat === "all" || e.category === cat) &&
        (mem === "all" || e.member === mem)
    );

    document.getElementById("expenseList").innerHTML = rows.length
        ? rows.map(expenseHTML).join("")
        : '<div class="empty">No matching expenses.</div>';
}

function renderMembers() {
    const total = totalContributions();

    document.getElementById("membersGrid").innerHTML = members.map(m => {
        const paid = contributions
            .filter(x => x.member === m)
            .reduce((s, x) => s + Number(x.amount || 0), 0);

        const spent = expenses
            .filter(x => x.member === m)
            .reduce((s, x) => s + Number(x.amount || 0), 0);

        const target = total / members.length;
        const pct = target ? Math.min(100, (paid / target) * 100) : 0;

        return `
      <div class="member-card">
        <div class="avatar">${escapeHTML(m[0])}</div>
        <h3>${escapeHTML(m)}</h3>
        <p>Contributed: <strong>${money(paid)}</strong></p>
        <p>Purchases: <strong>${money(spent)}</strong></p>
        <div class="progress"><i style="width:${pct}%"></i></div>
      </div>
    `;
    }).join("");
}

function renderNotifications() {
    const list = notifications;

    document.getElementById("notificationList").innerHTML = list.length
        ? list.map(n => `
        <div class="notification">
          <strong>${escapeHTML(n.message)}</strong>
          <span class="muted">${escapeHTML(n.date || "")} · Sent to all members</span>
        </div>
      `).join("")
        : '<div class="empty">No notifications yet.</div>';
}

function renderChart() {
    const sums = {};
    expenses.forEach(e => {
        sums[e.category] = (sums[e.category] || 0) + Number(e.amount || 0);
    });

    const max = Math.max(1, ...Object.values(sums));

    document.getElementById("categoryChart").innerHTML =
        Object.keys(sums).length
            ? Object.entries(sums)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => `
            <div class="bar-row">
              <span>${escapeHTML(k)}</span>
              <div class="bar"><i style="width:${(v / max) * 100}%"></i></div>
              <b>${money(v)}</b>
            </div>
          `).join("")
            : '<div class="empty">No expense data.</div>';
}

function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
}

function showSection(section) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.getElementById(section).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.section === section);
    });

    document.getElementById("pageTitle").textContent =
        section[0].toUpperCase() + section.slice(1);
}

document.querySelectorAll(".nav-btn,.text-btn").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
});

document.getElementById("notificationBtn").onclick =
    () => showSection("notifications");

document.getElementById("addExpenseBtn").onclick =
    () => openModal("expenseModal");

document.getElementById("addExpenseBtn2").onclick =
    () => openModal("expenseModal");

document.getElementById("addMoneyBtn").onclick =
    () => openModal("moneyModal");

document.querySelectorAll("[data-close]").forEach(btn => {
    btn.onclick = () => closeModal(btn.dataset.close);
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
        if (e.target === modal) modal.classList.add("hidden");
    });
});

["expenseSearch", "categoryFilter", "memberFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderExpenses);
});

document.getElementById("expenseForm").addEventListener("submit", async e => {
    e.preventDefault();

    const f = new FormData(e.target);
    const amount = Number(f.get("amount"));

    if (amount <= 0) {
        alert("Enter a valid amount.");
        return;
    }

    if (amount > balance()) {
        alert(`Not enough common money. Current balance: ${money(balance())}`);
        return;
    }

    try {
        const expense = {
            item: f.get("item"),
            category: f.get("category"),
            amount,
            member: f.get("member"),
            date: f.get("date"),
            note: f.get("note") || "",
            addedByUid: currentUser.uid,
            addedByEmail: currentUser.email,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "expenses"), expense);

        await addDoc(collection(db, "notifications"), {
            message: `${expense.member} spent ${money(amount)} on ${expense.item}.`,
            date: new Date().toLocaleString("en-IN"),
            readBy: [],
            createdAt: serverTimestamp()
        });

        e.target.reset();
        setToday();
        closeModal("expenseModal");
    } catch (error) {
        console.error(error);
        alert("Could not save expense: " + error.message);
    }
});

document.getElementById("moneyForm").addEventListener("submit", async e => {
    e.preventDefault();

    const f = new FormData(e.target);
    const amount = Number(f.get("amount"));

    if (amount <= 0) {
        alert("Enter a valid amount.");
        return;
    }

    try {
        await addDoc(collection(db, "contributions"), {
            member: f.get("member"),
            amount,
            date: f.get("date"),
            note: f.get("note") || "",
            addedByUid: currentUser.uid,
            addedByEmail: currentUser.email,
            createdAt: serverTimestamp()
        });

        await addDoc(collection(db, "notifications"), {
            message: `${f.get("member")} added ${money(amount)} to the common fund.`,
            date: new Date().toLocaleString("en-IN"),
            readBy: [],
            createdAt: serverTimestamp()
        });

        e.target.reset();
        setToday();
        closeModal("moneyModal");
    } catch (error) {
        console.error(error);
        alert("Could not add contribution: " + error.message);
    }
});

document.getElementById("clearNotifications").onclick = async () => {
    try {
        const unread = notifications.filter(n => !n.readBy?.includes(currentUser.uid));

        for (const n of unread) {
            const existing = n.readBy || [];
            const updated = [...new Set([...existing, currentUser.uid])];

            const { id } = n;
            await import("https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js")
                .then(({ updateDoc }) =>
                    updateDoc(doc(db, "notifications", id), { readBy: updated })
                );
        }
    } catch (error) {
        console.error(error);
    }
};

document.getElementById("logoutBtn").onclick = async () => {
    await signOut(auth);
    window.location.href = "index.html";
};

function startRealtimeListeners() {
    const expenseQuery = query(
        collection(db, "expenses"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(expenseQuery, snapshot => {
        expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    }, error => console.error("Expenses:", error));

    const contributionQuery = query(
        collection(db, "contributions"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(contributionQuery, snapshot => {
        contributions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    }, error => console.error("Contributions:", error));

    const notificationQuery = query(
        collection(db, "notifications"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(notificationQuery, snapshot => {
        notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    }, error => console.error("Notifications:", error));
}

// Authentication Check & UI Toggle
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;
    document.getElementById("userEmail").textContent = user.email;

    const isDaniel = user.email && user.email.toLowerCase() === DANIEL_EMAIL.toLowerCase();

    const adminSection = document.getElementById("adminSection");
    if (adminSection) {
        adminSection.style.display = isDaniel ? "block" : "none";
    }

    populateSelects();
    startRealtimeListeners();
});

// Admin Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
        resetBtn.addEventListener("click", resetAllRoomMoney);
    }

    const adminMoneyForm = document.getElementById("adminMoneyForm");
    if (adminMoneyForm) {
        adminMoneyForm.addEventListener("submit", handleAdminMoneyAdjustment);
    }
});