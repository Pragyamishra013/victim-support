const API_BASE = "http://localhost:5004/api";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;

            try {
                const res = await fetch(`${API_BASE}/ngo/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem("ngoId", data.ngoId);
                    localStorage.setItem("ngoName", data.ngoName);
                    localStorage.setItem("uniqueLink", data.uniqueLink);
                    showNgoLinks(data);
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("Login error: " + err.message);
            }
        });
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const ngoName = document.getElementById("reg-name").value;
            const email = document.getElementById("reg-email").value;
            const password = document.getElementById("reg-password").value;

            try {
                const res = await fetch(`${API_BASE}/ngo/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ngoName, email, password })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem("ngoId", data.ngoId);
                    localStorage.setItem("ngoName", data.ngoName);
                    localStorage.setItem("uniqueLink", data.uniqueLink);
                    showNgoLinks(data);
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("Registration error: " + err.message);
            }
        });
    }

    function showNgoLinks(data) {
        document.getElementById("auth-forms").style.display = "none";
        document.getElementById("ngo-dashboard-link").style.display = "block";
        document.getElementById("ngo-title").innerText = data.ngoName;
        document.getElementById("unique-link-display").value = data.uniqueLink;
        document.getElementById("goto-dash").onclick = () => {
            window.location.href = "dashboard.html";
        };
    }

    const victimForm = document.getElementById("victim-form");
    if (victimForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const ngoSlug = urlParams.get("ngo");

        if (!ngoSlug) {
            document.getElementById("error-banner").innerText = "Invalid or missing NGO reporting link!";
            victimForm.style.display = "none";
        }

        victimForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append("ngoSlug", ngoSlug);
            formData.append("name", document.getElementById("v-name").value);
            formData.append("age", document.getElementById("v-age").value);
            formData.append("gender", document.getElementById("v-gender").value);
            formData.append("email", document.getElementById("v-email").value);
            formData.append("address", document.getElementById("v-address").value);
            formData.append("statement", document.getElementById("v-statement").value);

            const audioFile = document.getElementById("v-audio").files[0];
            if (audioFile) formData.append("audio", audioFile);

            try {
                const res = await fetch(`${API_BASE}/cases/submit`, {
                    method: "POST",
                    body: formData
                });
                const data = await res.json();
                if (data.success) {
                    victimForm.style.display = "none";
                    const succ = document.getElementById("success-msg");
                    succ.style.display = "block";
                    succ.innerText = `Report submitted successfully! Case ID: ${data.caseId}`;
                } else {
                    alert(data.message);
                }
            } catch (err) {
                alert("Submission error: " + err.message);
            }
        });
    }

    const casesList = document.getElementById("cases-list");
    if (casesList) {
        const ngoId = localStorage.getItem("ngoId");
        const ngoName = localStorage.getItem("ngoName");
        if (!ngoId) {
            window.location.href = "org.html";
            return;
        }
        document.getElementById("dash-ngo-name").innerText = ngoName;

        fetch(`${API_BASE}/cases/ngo/${ngoId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.cases.length > 0) {
                    casesList.innerHTML = data.cases.map(c => `
                        <div class="case-card ${c.severity}">
                            <strong>Case ID: ${c.caseId}</strong> | <b>Severity: ${c.severity}</b>
                            <p><b>Victim:</b> ${c.victimDetails.name} (Age: ${c.victimDetails.age}, Gender: ${c.victimDetails.gender})</p>
                            <p><b>Statement:</b> ${c.statement}</p>
                            <p><b>AI Summary:</b> ${c.aiSummary}</p>
                            <small>Submitted on: ${new Date(c.createdAt).toLocaleString()}</small>
                        </div>
                    `).join("");
                } else {
                    casesList.innerHTML = "<p>No grievance reports found yet.</p>";
                }
            })
            .catch(err => {
                casesList.innerHTML = "<p>Error loading cases: " + err.message + "</p>";
            });
    }
});