const API_BASE_URL =
    "http://localhost:5000/api";


// ============================================================
// GLOBAL STATE
// ============================================================

let currentCaseId = null;

let mediaRecorder = null;

let mediaStream = null;

let audioChunks = [];

let recordedAudioBlob = null;

let recordedAudioUrl = null;

let isRecording = false;


// ============================================================
// HELPER FUNCTIONS
// ============================================================

function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatFileSize(bytes) {

    if (!bytes) {
        return "0 KB";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes /
        (1024 * 1024)
    ).toFixed(2)} MB`;
}


async function readJsonResponse(response) {

    const text =
        await response.text();

    try {

        return text
            ? JSON.parse(text)
            : {};

    } catch {

        return {
            success: false,
            message:
                text ||
                `HTTP ${response.status}`
        };
    }
}


// ============================================================
// VICTIM PORTAL
// ============================================================

function nextScreen(screenNumber) {

    const screens =
        document.querySelectorAll(
            ".screen"
        );

    if (!screens.length) {
        return;
    }

    screens.forEach(screen => {
        screen.classList.remove(
            "active"
        );
    });

    const target =
        document.getElementById(
            `screen-${screenNumber}`
        );

    if (target) {
        target.classList.add(
            "active"
        );
    }
}


// ============================================================
// CONSENT
// ============================================================

function toggleConsent() {

    const checkbox =
        document.getElementById(
            "consent-checkbox"
        );

    const button =
        document.getElementById(
            "consent-btn"
        );

    if (
        checkbox &&
        button
    ) {
        button.disabled =
            !checkbox.checked;
    }
}


// ============================================================
// CHARACTER COUNT
// ============================================================

function updateCharCount() {

    const text =
        document.getElementById(
            "report-text"
        );

    const counter =
        document.getElementById(
            "char-counter"
        );

    if (!text || !counter) {
        return;
    }

    if (text.value.length > 3000) {

        text.value =
            text.value.slice(
                0,
                3000
            );
    }

    counter.innerText =
        `${text.value.length} / 3000`;
}


// ============================================================
// AUDIO RECORDING
// ============================================================

function getSupportedAudioMimeType() {

    if (!window.MediaRecorder) {
        return "";
    }

    const types = [

        "audio/webm;codecs=opus",

        "audio/webm",

        "audio/ogg;codecs=opus",

        "audio/ogg",

        "audio/mp4"
    ];

    return types.find(
        type =>
            MediaRecorder.isTypeSupported(
                type
            )
    ) || "";
}


async function simulateVoiceRecording() {

    const button =
        document.querySelector(
            ".voice-btn"
        );

    const buttonText =
        document.getElementById(
            "voice-btn-text"
        );

    const status =
        document.getElementById(
            "rec-status"
        );

    const preview =
        document.getElementById(
            "recording-preview"
        );


    // --------------------------------------------------------
    // STOP RECORDING
    // --------------------------------------------------------

    if (
        isRecording &&
        mediaRecorder
    ) {

        mediaRecorder.stop();

        return;
    }


    // --------------------------------------------------------
    // BROWSER SUPPORT
    // --------------------------------------------------------

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        alert(
            "Your browser does not support microphone recording."
        );

        return;
    }


    if (!window.MediaRecorder) {

        alert(
            "Your browser does not support audio recording."
        );

        return;
    }


    // --------------------------------------------------------
    // START RECORDING
    // --------------------------------------------------------

    try {

        mediaStream =
            await navigator.mediaDevices
                .getUserMedia({
                    audio: true
                });


        audioChunks = [];

        recordedAudioBlob = null;


        const mimeType =
            getSupportedAudioMimeType();


        mediaRecorder =
            mimeType
                ? new MediaRecorder(
                    mediaStream,
                    {
                        mimeType
                    }
                )
                : new MediaRecorder(
                    mediaStream
                );


        mediaRecorder.ondataavailable =
            event => {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );
                }
            };


        mediaRecorder.onerror =
            event => {

                console.error(
                    "MediaRecorder error:",
                    event.error
                );

                cleanupRecorder();

                alert(
                    "Recording failed. Please try again."
                );
            };


        mediaRecorder.onstop = () => {

            const finalType =
                mediaRecorder.mimeType ||
                mimeType ||
                "audio/webm";


            recordedAudioBlob =
                new Blob(
                    audioChunks,
                    {
                        type:
                            finalType
                    }
                );


            if (recordedAudioUrl) {

                URL.revokeObjectURL(
                    recordedAudioUrl
                );
            }


            recordedAudioUrl =
                URL.createObjectURL(
                    recordedAudioBlob
                );


            if (preview) {

                preview.src =
                    recordedAudioUrl;

                preview.style.display =
                    "block";
            }


            if (buttonText) {

                buttonText.innerText =
                    "Record Again";
            }


            if (status) {

                status.innerText =
                    "✓ Recording ready";

                status.style.display =
                    "block";
            }


            cleanupRecorder();
        };


        mediaRecorder.start(250);


        isRecording = true;


        if (buttonText) {

            buttonText.innerText =
                "Stop Recording";
        }


        if (status) {

            status.innerText =
                "🔴 Recording...";

            status.style.display =
                "block";
        }

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        cleanupRecorder();


        if (
            error.name ===
            "NotAllowedError"
        ) {

            alert(
                "Microphone permission was denied. Please allow microphone access and try again."
            );

        } else {

            alert(
                "Could not start recording. Please try again."
            );
        }
    }
}


function cleanupRecorder() {

    isRecording = false;


    if (mediaStream) {

        mediaStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });
    }


    mediaStream = null;

    mediaRecorder = null;
}


// ============================================================
// REPORT SCREEN
// ============================================================

function getReportInput() {

    const reportText =
        document.getElementById(
            "report-text"
        );

    return reportText
        ? reportText.value.trim()
        : "";
}


function submitReportText() {

    const text =
        getReportInput();


    const error =
        document.getElementById(
            "report-error"
        );


    const transcript =
        document.getElementById(
            "transcript-text"
        );


    const hasText =
        text.length > 0;


    const hasAudio =
        !!recordedAudioBlob;


    // Nothing entered
    if (
        !hasText &&
        !hasAudio
    ) {

        if (error) {

            error.innerText =
                "Please write a report or record your voice before continuing.";

            error.style.display =
                "block";
        }

        return;
    }


    if (error) {

        error.style.display =
            "none";
    }


    if (transcript) {

        transcript.value =
            hasText
                ? text
                : "[Voice recording attached. Transcript will be added by the backend/AI service.]";
    }


    nextScreen(5);
}


// ============================================================
// FINAL SUBMISSION
// ============================================================

function getAudioExtension(blob) {

    const type =
        (
            blob.type || ""
        ).toLowerCase();


    if (type.includes("ogg")) {
        return "ogg";
    }


    if (type.includes("mp4")) {
        return "mp4";
    }


    return "webm";
}


async function submitFinalReport() {

    const transcript =
        document.getElementById(
            "transcript-text"
        );


    const submitButton =
        document.getElementById(
            "final-submit-btn"
        );


    const statement =
        transcript
            ? transcript.value.trim()
            : "";


    const hasAudio =
        !!recordedAudioBlob;


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (
        !statement &&
        !hasAudio
    ) {

        alert(
            "Please enter a report or attach a voice recording."
        );

        nextScreen(3);

        return;
    }


    // --------------------------------------------------------
    // DISABLE BUTTON
    // --------------------------------------------------------

    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.innerText =
            "Submitting...";
    }


    try {

        // Show submitting screen
        nextScreen(7);


        // ----------------------------------------------------
        // CREATE CASE
        // ----------------------------------------------------

        const caseResponse =
            await fetch(
                `${API_BASE_URL}/cases`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            statement,

                            source:
                                hasAudio &&
                                statement
                                    ? "text_and_voice"
                                    : hasAudio
                                        ? "voice"
                                        : "text",

                            language:
                                "English"
                        })
                }
            );


        const caseData =
            await readJsonResponse(
                caseResponse
            );


        if (
            !caseResponse.ok ||
            !caseData.case
        ) {

            throw new Error(
                caseData.message ||
                "Could not create the case."
            );
        }


        currentCaseId =
            caseData.case.caseId;


        console.log(
            "Case created:",
            currentCaseId
        );


        // ----------------------------------------------------
        // UPLOAD AUDIO
        // ----------------------------------------------------

        if (hasAudio) {

            const extension =
                getAudioExtension(
                    recordedAudioBlob
                );


            const audioFile =
                new File(
                    [
                        recordedAudioBlob
                    ],

                    `voice-report.${extension}`,

                    {
                        type:
                            recordedAudioBlob.type ||
                            "audio/webm"
                    }
                );


            const formData =
                new FormData();


            formData.append(
                "audio",
                audioFile
            );


            console.log(
                "Uploading recorded audio..."
            );


            const audioResponse =
                await fetch(
                    `${API_BASE_URL}/cases/${encodeURIComponent(
                        currentCaseId
                    )}/audio`,

                    {
                        method: "POST",

                        body:
                            formData
                    }
                );


            const audioData =
                await readJsonResponse(
                    audioResponse
                );


            if (
                !audioResponse.ok
            ) {

                throw new Error(
                    audioData.message ||
                    "Audio upload failed."
                );
            }


            console.log(
                "Audio uploaded successfully."
            );
        }


        // ----------------------------------------------------
        // SHOW CONFIRMATION
        // ----------------------------------------------------

        const caseIdDisplay =
            document.getElementById(
                "case-id-display"
            );


        if (caseIdDisplay) {

            caseIdDisplay.innerText =
                currentCaseId;
        }


        nextScreen(8);

    } catch (error) {

        console.error(
            "Final submission error:",
            error
        );


        alert(
            `Report could not be submitted.\n\n${error.message}`
        );


        nextScreen(5);

    } finally {

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.innerText =
                "Submit Report";
        }
    }
}


// ============================================================
// OTHER VICTIM FUNCTIONS
// ============================================================

function toggleLanguage() {

    alert(
        "Language switch can be connected to the translation layer later."
    );
}


function resetPortal() {

    const text =
        document.getElementById(
            "report-text"
        );


    const transcript =
        document.getElementById(
            "transcript-text"
        );


    const checkbox =
        document.getElementById(
            "consent-checkbox"
        );


    const consentButton =
        document.getElementById(
            "consent-btn"
        );


    const error =
        document.getElementById(
            "report-error"
        );


    const preview =
        document.getElementById(
            "recording-preview"
        );


    const status =
        document.getElementById(
            "rec-status"
        );


    const buttonText =
        document.getElementById(
            "voice-btn-text"
        );


    if (text) {
        text.value = "";
    }


    if (transcript) {
        transcript.value = "";
    }


    if (checkbox) {
        checkbox.checked = false;
    }


    if (consentButton) {
        consentButton.disabled = true;
    }


    if (error) {
        error.style.display = "none";
    }


    if (recordedAudioUrl) {

        URL.revokeObjectURL(
            recordedAudioUrl
        );
    }


    recordedAudioUrl = null;

    recordedAudioBlob = null;

    audioChunks = [];

    currentCaseId = null;


    if (preview) {

        preview.removeAttribute(
            "src"
        );

        preview.load();

        preview.style.display =
            "none";
    }


    if (status) {

        status.innerText =
            "🔴 Recording...";

        status.style.display =
            "none";
    }


    if (buttonText) {

        buttonText.innerText =
            "Record Voice";
    }


    cleanupRecorder();

    updateCharCount();

    nextScreen(1);
}


// ============================================================
// ORGANIZATION PORTAL
// ============================================================

let organizationCases = [];

let selectedCaseId = null;


// ============================================================
// LOGIN
// ============================================================

function handleLogin() {

    const email =
        document.getElementById(
            "login-email"
        );


    const password =
        document.getElementById(
            "login-password"
        );


    const loginView =
        document.getElementById(
            "view-login"
        );


    const portalView =
        document.getElementById(
            "view-portal"
        );


    if (
        !loginView ||
        !portalView
    ) {
        return;
    }


    if (
        !email ||
        !email.value.trim()
    ) {

        alert(
            "Please enter staff email."
        );

        return;
    }


    if (
        !password ||
        !password.value.trim()
    ) {

        alert(
            "Please enter password."
        );

        return;
    }


    loginView.classList.remove(
        "active"
    );


    portalView.classList.add(
        "active"
    );


    loadCases();

    switchTab(
        "dashboard"
    );
}


function logoutOrganization() {

    const loginView =
        document.getElementById(
            "view-login"
        );


    const portalView =
        document.getElementById(
            "view-portal"
        );


    if (portalView) {

        portalView.classList.remove(
            "active"
        );
    }


    if (loginView) {

        loginView.classList.add(
            "active"
        );
    }
}


// ============================================================
// LOAD CASES
// ============================================================

async function loadCases() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases`
            );


        const data =
            await readJsonResponse(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Could not load cases."
            );
        }


        organizationCases =
            data.cases || [];


        renderDashboardCases();

        renderCasesTable();

        updateCaseStatistics();

    } catch (error) {

        console.error(
            "Could not load cases:",
            error
        );


        const body =
            document.getElementById(
                "case-table-body"
            );


        if (body) {

            body.innerHTML = `
                <tr>
                    <td colspan="4">
                        Could not connect to backend.
                        Make sure the Node server is running on port 5000.
                    </td>
                </tr>
            `;
        }
    }
}


// ============================================================
// DASHBOARD STATISTICS
// ============================================================

function updateCaseStatistics() {

    const total =
        organizationCases.length;


    const newCases =
        organizationCases.filter(
            item =>
                item.status === "NEW"
        ).length;


    const inReview =
        organizationCases.filter(
            item =>
                item.status ===
                "IN_REVIEW"
        ).length;


    const resolved =
        organizationCases.filter(
            item =>
                item.status ===
                "RESOLVED"
        ).length;


    const totalEl =
        document.getElementById(
            "total-case-count"
        );


    const newEl =
        document.getElementById(
            "new-case-count"
        );


    const reviewEl =
        document.getElementById(
            "review-case-count"
        );


    const resolvedEl =
        document.getElementById(
            "resolved-case-count"
        );


    if (totalEl) {
        totalEl.innerText = total;
    }


    if (newEl) {
        newEl.innerText =
            newCases;
    }


    if (reviewEl) {
        reviewEl.innerText =
            inReview;
    }


    if (resolvedEl) {
        resolvedEl.innerText =
            resolved;
    }
}


// ============================================================
// DASHBOARD CASES
// ============================================================

function renderDashboardCases() {

    const body =
        document.getElementById(
            "dashboard-case-body"
        );


    if (!body) {
        return;
    }


    const recent =
        organizationCases
            .slice(-5)
            .reverse();


    if (!recent.length) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    No submitted cases yet.
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML =
        recent.map(item => `

            <tr
                onclick="openCaseDetail('${escapeHtml(
                    item.caseId
                )}')"
            >

                <td>
                    <strong>
                        ${escapeHtml(
                            item.caseId
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        item.source ||
                        "text"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        (
                            item.statement ||
                            ""
                        ).slice(0, 60)
                    )}
                </td>

                <td>
                    ${createStatusBadge(
                        item.status
                    )}
                </td>

            </tr>

        `).join("");
}


// ============================================================
// CASE TABLE
// ============================================================

function renderCasesTable() {

    const body =
        document.getElementById(
            "case-table-body"
        );


    if (!body) {
        return;
    }


    if (
        !organizationCases.length
    ) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    No submitted cases yet.
                </td>
            </tr>
        `;

        return;
    }


    body.innerHTML =
        organizationCases.map(item => `

            <tr
                onclick="openCaseDetail('${escapeHtml(
                    item.caseId
                )}')"
            >

                <td>
                    <strong>
                        ${escapeHtml(
                            item.caseId
                        )}
                    </strong>
                </td>

                <td>
                    ${escapeHtml(
                        item.source ||
                        "text"
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        (
                            item.statement ||
                            ""
                        ).slice(0, 70)
                    )}
                </td>

                <td>
                    ${createStatusBadge(
                        item.status
                    )}
                </td>

            </tr>

        `).join("");
}


// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tabName) {

    const tabs =
        document.querySelectorAll(
            ".portal-tab"
        );


    tabs.forEach(tab => {

        tab.style.display =
            "none";
    });


    const target =
        document.getElementById(
            `tab-${tabName}`
        );


    if (target) {

        target.style.display =
            "block";
    }


    if (
        tabName === "cases"
    ) {

        loadCases();
    }
}


// ============================================================
// OPEN CASE
// ============================================================

async function openCaseDetail(
    caseId
) {

    selectedCaseId =
        caseId;


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases/${encodeURIComponent(
                    caseId
                )}`
            );


        const data =
            await readJsonResponse(
                response
            );


        if (
            !response.ok ||
            !data.case
        ) {

            throw new Error(
                data.message ||
                "Could not load case."
            );
        }


        const item =
            data.case;


        const caseIdElement =
            document.getElementById(
                "detail-case-id"
            );


        const statementElement =
            document.getElementById(
                "detail-statement"
            );


        const submittedElement =
            document.getElementById(
                "detail-submitted"
            );


        const statusElement =
            document.getElementById(
                "detail-status"
            );


        const counsellorElement =
            document.getElementById(
                "assigned-counsellor-text"
            );


        if (caseIdElement) {

            caseIdElement.innerText =
                item.caseId;
        }


        if (statementElement) {

            statementElement.innerText =
                item.statement ||
                "Voice recording submitted. No transcript yet.";
        }


        if (submittedElement) {

            submittedElement.innerText =
                item.createdAt
                    ? new Date(
                        item.createdAt
                    ).toLocaleString()
                    : "Not available";
        }


        if (statusElement) {

            statusElement.value =
                item.status ||
                "NEW";
        }


        if (counsellorElement) {

            counsellorElement.innerText =
                item.counsellor ||
                "Not Assigned";
        }


        updateDetailStatusBadge(
            item.status ||
            "NEW"
        );


        renderAudioPlayer(
            item
        );


        switchTab(
            "detail"
        );

    } catch (error) {

        console.error(
            "Could not open case:",
            error
        );

        alert(
            error.message
        );
    }
}


// ============================================================
// AUDIO PLAYER
// ============================================================

function renderAudioPlayer(
    caseItem
) {

    const container =
        document.getElementById(
            "audio-player-container"
        );


    if (!container) {
        return;
    }


    if (
        !caseItem.audio ||
        !caseItem.audio.filename
    ) {

        container.innerHTML = `
            <p style="margin:0;">
                No voice recording was attached to this case.
            </p>
        `;

        return;
    }


    const audioUrl =
        `${API_BASE_URL}/cases/${encodeURIComponent(
            caseItem.caseId
        )}/audio`;


    container.innerHTML = `

        <audio
            controls
            preload="metadata"
            style="
                width:100%;
                margin-bottom:8px;
            "
        >

            <source
                src="${audioUrl}"
                type="${escapeHtml(
                    caseItem.audio.mimeType ||
                    "audio/webm"
                )}"
            >

            Your browser does not support
            audio playback.

        </audio>

        <p
            style="
                font-size:12px;
                margin:0;
            "
        >

            File:
            ${escapeHtml(
                caseItem.audio.originalName ||
                caseItem.audio.filename
            )}

            <br>

            Size:
            ${formatFileSize(
                caseItem.audio.size
            )}

        </p>
    `;
}


// ============================================================
// STATUS BADGE
// ============================================================

function createStatusBadge(
    status
) {

    const safeStatus =
        String(
            status || "NEW"
        );


    const className =
        safeStatus
            .toLowerCase()
            .replace(
                /[^a-z_]/g,
                "_"
            );


    return `
        <span
            class="badge ${className}"
        >
            ${escapeHtml(
                safeStatus
            )}
        </span>
    `;
}


function updateDetailStatusBadge(
    status
) {

    const badge =
        document.getElementById(
            "detail-status-badge"
        );


    if (badge) {

        badge.className =
            `badge ${String(
                status
            ).toLowerCase()}`;

        badge.innerText =
            status;
    }
}


// ============================================================
// UPDATE STATUS
// ============================================================

async function updateCaseStatus() {

    if (!selectedCaseId) {
        return;
    }


    const statusElement =
        document.getElementById(
            "detail-status"
        );


    if (!statusElement) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases/${encodeURIComponent(
                    selectedCaseId
                )}`,

                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            status:
                                statusElement.value
                        })
                }
            );


        const data =
            await readJsonResponse(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Could not update case."
            );
        }


        updateDetailStatusBadge(
            data.case.status
        );


        await loadCases();


        alert(
            "Case status updated."
        );

    } catch (error) {

        console.error(
            error
        );

        alert(
            error.message
        );
    }
}


// ============================================================
// SEARCH
// ============================================================

function filterCases(input) {

    const filter =
        (
            input.value || ""
        ).toLowerCase();


    const rows =
        document.querySelectorAll(
            "#case-table-body tr"
        );


    rows.forEach(row => {

        row.style.display =
            row.innerText
                .toLowerCase()
                .includes(filter)
                ? ""
                : "none";
    });
}


// ============================================================
// COUNSELLOR
// ============================================================

function openCounsellorModal() {

    const modal =
        document.getElementById(
            "counsellor-modal"
        );


    if (modal) {

        modal.style.display =
            "flex";
    }
}


function closeCounsellorModal() {

    const modal =
        document.getElementById(
            "counsellor-modal"
        );


    if (modal) {

        modal.style.display =
            "none";
    }
}


function assignCounsellor(
    name
) {

    if (!selectedCaseId) {
        return;
    }


    fetch(
        `${API_BASE_URL}/cases/${encodeURIComponent(
            selectedCaseId
        )}`,

        {
            method: "PATCH",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body:
                JSON.stringify({
                    counsellor: name
                })
        }
    )

        .then(
            readJsonResponse
        )

        .then(data => {

            if (!data.case) {

                throw new Error(
                    data.message ||
                    "Could not assign counsellor."
                );
            }


            const target =
                document.getElementById(
                    "assigned-counsellor-text"
                );


            if (target) {

                target.innerText =
                    data.case.counsellor;
            }


            closeCounsellorModal();
        })

        .catch(error => {

            console.error(
                error
            );

            alert(
                error.message
            );
        });
}