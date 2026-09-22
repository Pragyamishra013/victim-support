// --- VICTIM PORTAL LOGIC ---
function nextScreen(screenNumber) {
    const screens = document.querySelectorAll('.screen');
    if (screens.length === 0) return;
    
    screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${screenNumber}`);
    if (target) target.classList.add('active');

    if (screenNumber === 7) {
        setTimeout(() => {
            const caseIdDisplay = document.getElementById('case-id-display');
            if (caseIdDisplay) {
                caseIdDisplay.innerText = 'CASE-' + Math.floor(1000 + Math.random() * 9000);
            }
            nextScreen(8);
        }, 3000);
    }
}

function toggleConsent() {
    const checkbox = document.getElementById('consent-checkbox');
    const btn = document.getElementById('consent-btn');
    if (checkbox && btn) {
        btn.disabled = !checkbox.checked;
    }
}

function updateCharCount() {
    const textElem = document.getElementById('report-text');
    const counterElem = document.getElementById('char-counter');
    if (textElem && counterElem) {
        counterElem.innerText = `${textElem.value.length} / 3000`;
    }
}

function simulateVoiceRecording() {
    const status = document.getElementById('rec-status');
    const btnText = document.getElementById('voice-btn-text');
    const reportText = document.getElementById('report-text');
    
    if (status && btnText && reportText) {
        status.style.display = 'block';
        btnText.innerText = "Stop Recording";
        
        setTimeout(() => {
            status.style.display = 'none';
            btnText.innerText = "Record Again";
            reportText.value = "Mera experience yeh raha ki mujhe baar baar pareshan kiya ja raha hai...";
            updateCharCount();
        }, 3000);
    }
}

function submitReportText() {
    const textElem = document.getElementById('report-text');
    const errorMsg = document.getElementById('report-error');
    const transcriptText = document.getElementById('transcript-text');

    if (textElem && errorMsg && transcriptText) {
        const text = textElem.value.trim();
        if (text === "") {
            errorMsg.style.display = 'block';
            return;
        }
        errorMsg.style.display = 'none';
        transcriptText.value = text;
        nextScreen(5);
    }
}

function toggleLanguage() {
    alert('Language switched (English / हिंदी feature active)');
}

function resetPortal() {
    const textElem = document.getElementById('report-text');
    const checkbox = document.getElementById('consent-checkbox');
    const btn = document.getElementById('consent-btn');
    
    if (textElem) textElem.value = '';
    if (checkbox) checkbox.checked = false;
    if (btn) btn.disabled = true;
    nextScreen(1);
}

// --- ORGANIZATION PORTAL LOGIC ---
function handleLogin() {
    const email = document.getElementById('login-email');
    const viewLogin = document.getElementById('view-login');
    const viewPortal = document.getElementById('view-portal');

    if (email && viewLogin && viewPortal) {
        if(email.value.trim() === "") {
            alert("Please enter staff email");
            return;
        }
        viewLogin.classList.remove('active');
        viewPortal.classList.add('active');
        switchTab('dashboard');
    }
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.portal-tab');
    if (tabs.length === 0) return;

    tabs.forEach(t => t.style.display = 'none');
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
    }
}

function openCaseDetail(caseId) {
    const detailCaseId = document.getElementById('detail-case-id');
    if (detailCaseId) {
        detailCaseId.innerText = caseId;
    }
    switchTab('detail');
}

function openModal() {
    const modal = document.getElementById('counsellor-modal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('counsellor-modal');
    if (modal) modal.style.display = 'none';
}

function assignCounsellor(name) {
    const counsellorText = document.getElementById('assigned-counsellor-text');
    if (counsellorText) {
        counsellorText.innerHTML = `<strong style="color: var(--success);">${name}</strong> (Assigned)`;
    }
    closeModal();
}

function filterCases(element) {
    let filter = element.value.toLowerCase();
    let rows = document.querySelectorAll('#case-table-body tr');
    rows.forEach(row => {
        let text = row.innerText.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}