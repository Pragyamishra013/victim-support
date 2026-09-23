// ============================================================
// NIVARAN / SafeSupport - Frontend JavaScript
// ============================================================

// Backend API
const API_BASE_URL = "http://localhost:5000/api";

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentCaseId = null;

let mediaRecorder = null;
let audioChunks = [];
let recordedAudioBlob = null;

let organizationCases = [];
let currentOrganizationCase = null;


// ============================================================
// SCREEN NAVIGATION
// ============================================================

function nextScreen(screenNumber) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    const targetScreen = document.getElementById(`screen-${screenNumber}`);

    if (targetScreen) {
        targetScreen.classList.add("active");
    }
}


// ============================================================
// LANGUAGE
// ============================================================

function toggleLanguage() {
    alert("Hindi language support will be added soon.");
}


// ============================================================
// CONSENT
// ============================================================

function toggleConsent() {
    const checkbox = document.getElementById("consent-checkbox");
    const button = document.getElementById("consent-btn");

    if (!checkbox || !button) {
        return;
    }

    button.disabled = !checkbox.checked;
}


// ============================================================
// CHARACTER COUNTER
// ============================================================

function updateCharCount() {
    const textarea = document.getElementById("report-text");
    const counter = document.getElementById("char-counter");

    if (!textarea || !counter) {
        return;
    }

    counter.textContent = `${textarea.value.length} / 3000`;
}


// ============================================================
// VOICE RECORDING
// ============================================================

async function simulateVoiceRecording() {

    console.log("Voice recording started");

    // If already recording, stop it
    if (mediaRecorder && mediaRecorder.state === "recording") {
        console.log("Stopping current recording...");
        mediaRecorder.stop();
        return;
    }

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support microphone recording.");
        console.error("getUserMedia is not supported.");
        return;
    }

    try {

        console.log("Requesting microphone permission...");

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        console.log("Microphone permission granted.");

        audioChunks = [];
        recordedAudioBlob = null;

        // Determine supported MIME type
        let mimeType = "";

        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
        } else {
            mimeType = "";
        }

        console.log("Selected audio MIME type:", mimeType || "browser default");

        if (mimeType) {
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType
            });
        } else {
            mediaRecorder = new MediaRecorder(stream);
        }

        console.log("MediaRecorder created:", mediaRecorder);

        // ----------------------------------------------------
        // When audio data becomes available
        // ----------------------------------------------------

        mediaRecorder.ondataavailable = (event) => {

            console.log(
                "Audio data received:",
                event.data,
                "size:",
                event.data.size
            );

            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };


        // ----------------------------------------------------
        // When recording starts
        // ----------------------------------------------------

        mediaRecorder.onstart = () => {

            console.log("MediaRecorder started.");

            const buttonText =
                document.getElementById("voice-btn-text");

            const status =
                document.getElementById("rec-status");

            if (buttonText) {
                buttonText.textContent = "Stop Recording";
            }

            if (status) {
                status.style.display = "block";
                status.textContent = "🔴 Recording...";
            }
        };


        // ----------------------------------------------------
        // When recording stops
        // ----------------------------------------------------

        mediaRecorder.onstop = () => {

            console.log("MediaRecorder stopped.");

            recordedAudioBlob = new Blob(audioChunks, {
                type: mediaRecorder.mimeType || "audio/webm"
            });

            console.log("=================================");
            console.log("AUDIO RECORDING COMPLETE");
            console.log("Audio Blob:", recordedAudioBlob);
            console.log("Audio size:", recordedAudioBlob.size);
            console.log("Audio type:", recordedAudioBlob.type);
            console.log("Audio chunks:", audioChunks.length);
            console.log("=================================");

            // Stop microphone tracks
            stream.getTracks().forEach(track => {
                track.stop();
            });

            const buttonText =
                document.getElementById("voice-btn-text");

            const status =
                document.getElementById("rec-status");

            if (buttonText) {
                buttonText.textContent = "Record Voice Again";
            }

            if (status) {
                status.style.display = "block";
                status.textContent = "✅ Recording ready";
            }

            // Check whether recording actually contains data
            if (!recordedAudioBlob || recordedAudioBlob.size === 0) {

                console.error("Audio recording is EMPTY.");

                if (status) {
                    status.textContent =
                        "❌ Recording failed. Please try again.";
                }

                alert(
                    "No audio was recorded. Please check your microphone and try again."
                );

                return;
            }

            console.log("Audio successfully stored in browser.");
        };


        // ----------------------------------------------------
        // Recorder error
        // ----------------------------------------------------

        mediaRecorder.onerror = (event) => {

            console.error(
                "MediaRecorder error:",
                event
            );

            const status =
                document.getElementById("rec-status");

            if (status) {
                status.textContent =
                    "❌ Recording error";
            }
        };


        // Start recording
        mediaRecorder.start();

        console.log("Recording is now active.");

        // Automatically stop after 5 minutes
        setTimeout(() => {

            if (
                mediaRecorder &&
                mediaRecorder.state === "recording"
            ) {
                console.log("Maximum recording time reached.");
                mediaRecorder.stop();
            }

        }, 5 * 60 * 1000);

    } catch (error) {

        console.error(
            "Microphone access error:",
            error
        );

        alert(
            "Could not access the microphone. Please allow microphone permission and try again."
        );
    }
}


// ============================================================
// REPORT TEXT -> REVIEW SCREEN
// ============================================================

function submitReportText() {

    const reportText =
        document.getElementById("report-text");

    const transcriptText =
        document.getElementById("transcript-text");

    const errorMessage =
        document.getElementById("report-error");

    if (!reportText || !transcriptText) {
        console.error("Report textarea not found.");
        return;
    }

    const text = reportText.value.trim();

    // If there is no written report AND no recording
    if (
        text === "" &&
        (!recordedAudioBlob || recordedAudioBlob.size === 0)
    ) {

        if (errorMessage) {
            errorMessage.style.display = "block";
        }

        alert(
            "Please write a report or record your experience before continuing."
        );

        return;
    }

    if (errorMessage) {
        errorMessage.style.display = "none";
    }

    // Put written report into review box
    if (text !== "") {
        transcriptText.value = text;
    } else {
        transcriptText.value =
            "[Voice recording attached. No written report was provided.]";
    }

    console.log("Report ready for review.");
    console.log("Written report length:", text.length);

    if (recordedAudioBlob) {
        console.log(
            "Recorded audio size:",
            recordedAudioBlob.size
        );

        console.log(
            "Recorded audio type:",
            recordedAudioBlob.type
        );
    }

    nextScreen(5);
}


// ============================================================
// FINAL REPORT SUBMISSION
// ============================================================

async function submitFinalReport() {

    const transcriptElement =
        document.getElementById("transcript-text");

    if (!transcriptElement) {
        console.error("transcript-text element not found.");
        return;
    }

    const transcript =
        transcriptElement.value.trim();

    console.log("=================================");
    console.log("SUBMITTING REPORT");
    console.log("=================================");

    console.log(
        "Report text:",
        transcript
    );

    console.log(
        "Recorded audio:",
        recordedAudioBlob
    );

    if (recordedAudioBlob) {
        console.log(
            "Recorded audio size:",
            recordedAudioBlob.size
        );

        console.log(
            "Recorded audio type:",
            recordedAudioBlob.type
        );
    }


    // --------------------------------------------------------
    // Validate report
    // --------------------------------------------------------

    if (
        transcript === "" &&
        (!recordedAudioBlob || recordedAudioBlob.size === 0)
    ) {

        alert(
            "Please provide a report before submitting."
        );

        return;
    }


    try {

        // ----------------------------------------------------
        // STEP 1
        // Create case
        // ----------------------------------------------------

        console.log("Creating case on backend...");

        const reportForBackend =
            transcript ||
            "[Voice recording submitted without written text.]";

        const response = await fetch(
            `${API_BASE_URL}/cases`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    reportText: reportForBackend
                })
            }
        );


        console.log(
            "Case creation HTTP status:",
            response.status
        );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Case creation failed:",
                errorText
            );

            throw new Error(
                "Failed to create case."
            );
        }


        const data =
            await response.json();

        console.log(
            "Case creation response:",
            data
        );


        if (
            !data.success ||
            !data.case ||
            !data.case.caseId
        ) {

            throw new Error(
                "Backend did not return a Case ID."
            );
        }


        // Save Case ID
        currentCaseId =
            data.case.caseId;


        console.log(
            "Case created:",
            currentCaseId
        );


        // ----------------------------------------------------
        // STEP 2
        // Upload audio if available
        // ----------------------------------------------------

        if (
            recordedAudioBlob &&
            recordedAudioBlob.size > 0
        ) {

            console.log(
                "Uploading recorded audio..."
            );

            console.log(
                "Audio size:",
                recordedAudioBlob.size
            );

            console.log(
                "Audio type:",
                recordedAudioBlob.type
            );


            const formData =
                new FormData();


            // Make sure the browser has a usable MIME type
            let audioExtension = "webm";

            if (
                recordedAudioBlob.type.includes("ogg")
            ) {
                audioExtension = "ogg";
            }

            if (
                recordedAudioBlob.type.includes("mp4")
            ) {
                audioExtension = "mp4";
            }


            const audioFile =
                new File(
                    [
                        recordedAudioBlob
                    ],
                    `voice-report.${audioExtension}`,
                    {
                        type:
                            recordedAudioBlob.type ||
                            "audio/webm"
                    }
                );


            formData.append(
                "audio",
                audioFile
            );


            console.log(
                "Uploading audio for Case ID:",
                currentCaseId
            );

            console.log(
                "Filename:",
                audioFile.name
            );

            console.log(
                "File size:",
                audioFile.size
            );

            console.log(
                "File type:",
                audioFile.type
            );


            const audioResponse =
                await fetch(
                    `${API_BASE_URL}/cases/${currentCaseId}/audio`,
                    {
                        method: "POST",
                        body: formData
                    }
                );


            console.log(
                "Audio upload HTTP status:",
                audioResponse.status
            );


            const audioData =
                await audioResponse.json();


            console.log(
                "Audio upload response:",
                audioData
            );


            if (!audioResponse.ok) {

                console.error(
                    "Audio upload failed:",
                    audioData
                );

                alert(
                    "Your report was created, but the voice recording could not be uploaded."
                );

                // We don't cancel the case.
                // The text report/case already exists.
            } else {

                console.log(
                    "Audio uploaded successfully:",
                    audioData
                );
            }

        } else {

            console.log(
                "No audio recording attached."
            );
        }


        // ----------------------------------------------------
        // STEP 3
        // Show analyzing screen
        // ----------------------------------------------------

        nextScreen(7);


        // ----------------------------------------------------
        // STEP 4
        // Show confirmation
        // ----------------------------------------------------

        setTimeout(() => {

            const caseDisplay =
                document.getElementById(
                    "case-id-display"
                );

            if (caseDisplay) {
                caseDisplay.textContent =
                    currentCaseId;
            }

            nextScreen(8);

        }, 3000);


    } catch (error) {

        console.error(
            "SUBMISSION ERROR:",
            error
        );

        alert(
            "Something went wrong while submitting your report. Please check that the backend server is running."
        );
    }
}


// ============================================================
// RESET VICTIM PORTAL
// ============================================================

function resetPortal() {

    console.log("Resetting victim portal...");

    currentCaseId = null;

    recordedAudioBlob = null;

    audioChunks = [];

    mediaRecorder = null;


    const reportText =
        document.getElementById("report-text");

    const transcriptText =
        document.getElementById("transcript-text");

    const consentCheckbox =
        document.getElementById("consent-checkbox");

    const consentButton =
        document.getElementById("consent-btn");

    const charCounter =
        document.getElementById("char-counter");

    const status =
        document.getElementById("rec-status");

    const voiceButtonText =
        document.getElementById("voice-btn-text");

    const errorMessage =
        document.getElementById("report-error");


    if (reportText) {
        reportText.value = "";
    }

    if (transcriptText) {
        transcriptText.value = "";
    }

    if (consentCheckbox) {
        consentCheckbox.checked = false;
    }

    if (consentButton) {
        consentButton.disabled = true;
    }

    if (charCounter) {
        charCounter.textContent = "0 / 3000";
    }

    if (status) {
        status.style.display = "none";
        status.textContent = "🔴 Recording...";
    }

    if (voiceButtonText) {
        voiceButtonText.textContent =
            "Record Voice";
    }

    if (errorMessage) {
        errorMessage.style.display = "none";
    }


    nextScreen(1);
}


// ============================================================
// ORGANIZATION LOGIN
// ============================================================

function handleLogin() {

    console.log(
        "Organization login"
    );

    const loginScreen =
        document.getElementById("login-screen");

    const portal =
        document.getElementById("org-portal");

    if (loginScreen) {
        loginScreen.style.display = "none";
    }

    if (portal) {
        portal.style.display = "block";
    }

    switchTab("dashboard");

    loadCases();
}


// ============================================================
// ORGANIZATION LOGOUT
// ============================================================

function logoutOrganization() {

    console.log(
        "Organization logout"
    );

    const loginScreen =
        document.getElementById("login-screen");

    const portal =
        document.getElementById("org-portal");

    if (portal) {
        portal.style.display = "none";
    }

    if (loginScreen) {
        loginScreen.style.display = "block";
    }

    organizationCases = [];
    currentOrganizationCase = null;
}


// ============================================================
// LOAD CASES
// ============================================================

async function loadCases() {

    console.log(
        "Loading cases from backend..."
    );

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases`
            );


        if (!response.ok) {
            throw new Error(
                "Failed to load cases."
            );
        }


        const data =
            await response.json();


        console.log(
            "Cases response:",
            data
        );


        organizationCases =
            data.cases || [];


        updateCaseStatistics();

        renderDashboardCases();

        renderCasesTable();


    } catch (error) {

        console.error(
            "Could not load cases:",
            error
        );
    }
}


// ============================================================
// CASE STATISTICS
// ============================================================

function updateCaseStatistics() {

    const totalCount =
        document.getElementById(
            "total-case-count"
        );

    const newCount =
        document.getElementById(
            "new-case-count"
        );

    const reviewCount =
        document.getElementById(
            "review-case-count"
        );

    const resolvedCount =
        document.getElementById(
            "resolved-case-count"
        );


    const newCases =
        organizationCases.filter(
            item => item.status === "NEW"
        );

    const reviewCases =
        organizationCases.filter(
            item => item.status === "IN_REVIEW"
        );

    const resolvedCases =
        organizationCases.filter(
            item => item.status === "RESOLVED"
        );


    if (totalCount) {
        totalCount.textContent =
            organizationCases.length;
    }

    if (newCount) {
        newCount.textContent =
            newCases.length;
    }

    if (reviewCount) {
        reviewCount.textContent =
            reviewCases.length;
    }

    if (resolvedCount) {
        resolvedCount.textContent =
            resolvedCases.length;
    }
}


// ============================================================
// DASHBOARD CASES
// ============================================================

function renderDashboardCases() {

    const tableBody =
        document.getElementById(
            "dashboard-case-body"
        );

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    const activeCases =
        organizationCases
            .filter(
                item =>
                    item.status !== "RESOLVED"
            )
            .slice(0, 10);


    if (activeCases.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No active cases found.
                </td>
            </tr>
        `;

        return;
    }


    activeCases.forEach(caseItem => {

        const row =
            document.createElement("tr");


        row.innerHTML = `
            <td>${escapeHtml(caseItem.caseId)}</td>

            <td>
                ${escapeHtml(
                    truncateText(
                        caseItem.reportText,
                        60
                    )
                )}
            </td>

            <td>
                ${createStatusBadge(
                    caseItem.status
                )}
            </td>

            <td>
                ${formatDate(
                    caseItem.createdAt
                )}
            </td>

            <td>
                <button
                    class="btn btn-small"
                    onclick="openCaseDetail('${caseItem.caseId}')"
                >
                    View
                </button>
            </td>
        `;


        tableBody.appendChild(row);
    });
}


// ============================================================
// CASES TABLE
// ============================================================

function renderCasesTable(
    filteredCases = organizationCases
) {

    const tableBody =
        document.getElementById(
            "case-table-body"
        );

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    if (filteredCases.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    No cases found.
                </td>
            </tr>
        `;

        return;
    }


    filteredCases.forEach(caseItem => {

        const row =
            document.createElement("tr");


        row.innerHTML = `
            <td>${escapeHtml(caseItem.caseId)}</td>

            <td>
                ${escapeHtml(
                    truncateText(
                        caseItem.reportText,
                        80
                    )
                )}
            </td>

            <td>
                ${createStatusBadge(
                    caseItem.status
                )}
            </td>

            <td>
                ${escapeHtml(
                    caseItem.assignedCounsellor ||
                    "Unassigned"
                )}
            </td>

            <td>
                ${formatDate(
                    caseItem.createdAt
                )}
            </td>

            <td>
                <button
                    class="btn btn-small"
                    onclick="openCaseDetail('${caseItem.caseId}')"
                >
                    View
                </button>
            </td>
        `;


        tableBody.appendChild(row);
    });
}


// ============================================================
// ORGANIZATION TAB SWITCHING
// ============================================================

function switchTab(tabName) {

    console.log(
        "Switching organization tab:",
        tabName
    );


    document.querySelectorAll(
        ".org-tab"
    ).forEach(tab => {

        tab.classList.remove("active");

    });


    document.querySelectorAll(
        ".org-section"
    ).forEach(section => {

        section.classList.remove("active");

    });


    const selectedTab =
        document.getElementById(
            `tab-${tabName}`
        );

    const selectedSection =
        document.getElementById(
            `section-${tabName}`
        );


    if (selectedTab) {
        selectedTab.classList.add("active");
    }

    if (selectedSection) {
        selectedSection.classList.add("active");
    }


    if (tabName === "cases") {
        loadCases();
    }
}


// ============================================================
// OPEN CASE DETAIL
// ============================================================

async function openCaseDetail(caseId) {

    console.log(
        "Opening case:",
        caseId
    );


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases/${caseId}`
            );


        if (!response.ok) {

            throw new Error(
                "Could not load case."
            );
        }


        const data =
            await response.json();


        currentOrganizationCase =
            data.case;


        const caseIdElement =
            document.getElementById(
                "detail-case-id"
            );

        const statusBadge =
            document.getElementById(
                "detail-status-badge"
            );

        const statusElement =
            document.getElementById(
                "detail-status"
            );

        const submittedElement =
            document.getElementById(
                "detail-submitted"
            );

        const statementElement =
            document.getElementById(
                "detail-statement"
            );


        if (caseIdElement) {
            caseIdElement.textContent =
                data.case.caseId;
        }


        if (statusBadge) {
            statusBadge.innerHTML =
                createStatusBadge(
                    data.case.status
                );
        }


        if (statusElement) {
            statusElement.value =
                data.case.status;
        }


        if (submittedElement) {
            submittedElement.textContent =
                formatDate(
                    data.case.createdAt
                );
        }


        if (statementElement) {
            statementElement.textContent =
                data.case.reportText;
        }


        // Update assigned counsellor display
        const counsellorElement =
            document.getElementById(
                "assigned-counsellor"
            );

        if (counsellorElement) {

            counsellorElement.textContent =
                data.case.assignedCounsellor ||
                "Unassigned";
        }


        switchTab("detail");


    } catch (error) {

        console.error(
            "Case detail error:",
            error
        );

        alert(
            "Could not load case details."
        );
    }
}


// ============================================================
// STATUS BADGE
// ============================================================

function createStatusBadge(status) {

    let label = status;

    if (status === "NEW") {
        label = "New";
    }

    if (status === "IN_REVIEW") {
        label = "In Review";
    }

    if (status === "RESOLVED") {
        label = "Resolved";
    }


    return `
        <span class="status-badge status-${status}">
            ${escapeHtml(label)}
        </span>
    `;
}


// ============================================================
// UPDATE DETAIL STATUS BADGE
// ============================================================

function updateDetailStatusBadge() {

    const statusElement =
        document.getElementById(
            "detail-status"
        );

    const badgeElement =
        document.getElementById(
            "detail-status-badge"
        );


    if (!statusElement || !badgeElement) {
        return;
    }


    badgeElement.innerHTML =
        createStatusBadge(
            statusElement.value
        );
}


// ============================================================
// UPDATE CASE STATUS
// ============================================================

async function updateCaseStatus() {

    if (!currentOrganizationCase) {

        alert(
            "No case selected."
        );

        return;
    }


    const statusElement =
        document.getElementById(
            "detail-status"
        );


    if (!statusElement) {
        return;
    }


    const newStatus =
        statusElement.value;


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases/${currentOrganizationCase.caseId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Status update response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Status update failed."
            );
        }


        currentOrganizationCase =
            data.case;


        updateDetailStatusBadge();

        await loadCases();


        alert(
            "Case status updated successfully."
        );


    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            error.message ||
            "Could not update case status."
        );
    }
}


// ============================================================
// FILTER CASES
// ============================================================

function filterCases() {

    const searchInput =
        document.getElementById(
            "case-search"
        );


    if (!searchInput) {
        return;
    }


    const search =
        searchInput.value
            .trim()
            .toLowerCase();


    if (search === "") {

        renderCasesTable(
            organizationCases
        );

        return;
    }


    const filtered =
        organizationCases.filter(
            caseItem => {

                return (
                    caseItem.caseId
                        .toLowerCase()
                        .includes(search)

                    ||

                    caseItem.reportText
                        .toLowerCase()
                        .includes(search)

                    ||

                    (
                        caseItem.assignedCounsellor ||
                        ""
                    )
                    .toLowerCase()
                    .includes(search)

                    ||

                    caseItem.status
                        .toLowerCase()
                        .includes(search)
                );
            }
        );


    renderCasesTable(filtered);
}


// ============================================================
// COUNSELLOR MODAL
// ============================================================

function openCounsellorModal() {

    const modal =
        document.getElementById(
            "counsellor-modal"
        );

    if (modal) {
        modal.style.display = "flex";
    }
}


function closeCounsellorModal() {

    const modal =
        document.getElementById(
            "counsellor-modal"
        );

    if (modal) {
        modal.style.display = "none";
    }
}


// ============================================================
// ASSIGN COUNSELLOR
// ============================================================

async function assignCounsellor(name) {

    if (!currentOrganizationCase) {

        alert(
            "Please select a case first."
        );

        return;
    }


    console.log(
        "Assigning counsellor:",
        name
    );


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/cases/${currentOrganizationCase.caseId}`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        assignedCounsellor:
                            name
                    })
                }
            );


        const data =
            await response.json();


        console.log(
            "Counsellor assignment response:",
            data
        );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Could not assign counsellor."
            );
        }


        currentOrganizationCase =
            data.case;


        const counsellorElement =
            document.getElementById(
                "assigned-counsellor"
            );


        if (counsellorElement) {

            counsellorElement.textContent =
                name;
        }


        closeCounsellorModal();

        await loadCases();


        alert(
            `${name} has been assigned to this case.`
        );


    } catch (error) {

        console.error(
            "Counsellor assignment error:",
            error
        );

        alert(
            error.message ||
            "Could not assign counsellor."
        );
    }
}


// ============================================================
// DATE FORMAT
// ============================================================

function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }


    const date =
        new Date(dateString);


    if (Number.isNaN(date.getTime())) {
        return dateString;
    }


    return date.toLocaleString();
}


// ============================================================
// TEXT TRUNCATION
// ============================================================

function truncateText(
    text,
    maxLength
) {

    if (!text) {
        return "";
    }


    if (text.length <= maxLength) {
        return text;
    }


    return (
        text.substring(
            0,
            maxLength
        ) + "..."
    );
}


// ============================================================
// HTML ESCAPING
// ============================================================

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {

        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "SafeSupport JavaScript loaded."
        );

        console.log(
            "Backend API:",
            API_BASE_URL
        );

        // Hide recording status initially
        const status =
            document.getElementById(
                "rec-status"
            );

        if (status) {
            status.style.display = "none";
        }
        // Initialize character count
        updateCharCount();
    }
);