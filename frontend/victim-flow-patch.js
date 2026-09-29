const NIVARAN_API = "/api";

let nivaranReportMethod = null;
let nivaranUploadedAudio = null;


// ============================================================
// SCREEN CONTROL
// ============================================================

function nextScreen(number) {

    document.querySelectorAll(".screen").forEach(screen => {

        screen.classList.remove("active");

        screen.style.display = "none";

    });


    const target =
        document.getElementById(`screen-${number}`);


    if (target) {

        target.classList.add("active");

        target.style.display = "block";

    }

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// ============================================================
// CONSENT
// ============================================================

function toggleConsent() {

    const checkbox =
        document.getElementById("consent-checkbox");

    const button =
        document.getElementById("consent-btn");


    if (checkbox && button) {

        button.disabled =
            !checkbox.checked;

    }
}


// ============================================================
// ERROR
// ============================================================

function showReportError(message) {

    const error =
        document.getElementById("report-error");


    if (error) {

        error.textContent = message;

        error.style.display = "block";

    } else {

        alert(message);

    }
}


function clearReportError() {

    const error =
        document.getElementById("report-error");


    if (error) {

        error.textContent = "";

        error.style.display = "none";

    }
}


// ============================================================
// REPORT METHOD SELECTION
// ============================================================

function selectReportMethod(method) {

    if (
        !["text", "record", "upload"]
            .includes(method)
    ) {
        return;
    }


    nivaranReportMethod = method;


    // Highlight selected method
    document
        .querySelectorAll(".method-card")
        .forEach(card => {

            card.classList.remove(
                "selected",
                "disabled"
            );

            if (
                card.id !==
                `method-${method}`
            ) {

                card.classList.add(
                    "disabled"
                );

            }

        });


    const selected =
        document.getElementById(
            `method-${method}`
        );


    if (selected) {

        selected.classList.add(
            "selected"
        );

    }


    // Show only selected panel
    document
        .querySelectorAll(".method-panel")
        .forEach(panel => {

            panel.classList.remove(
                "active"
            );

        });


    const panel =
        document.getElementById(
            `panel-${method}`
        );


    if (panel) {

        panel.classList.add(
            "active"
        );

    }


    document
        .getElementById(
            "change-method-btn"
        )
        .style.display =
            "inline-block";


    clearReportError();


    // Leaving recording
    if (method !== "record") {

        if (
            typeof isRecording !== "undefined" &&
            isRecording &&
            typeof mediaRecorder !== "undefined" &&
            mediaRecorder
        ) {

            mediaRecorder.stop();

        }


        if (
            typeof recordedAudioBlob !==
            "undefined"
        ) {

            recordedAudioBlob = null;

        }

    }


    // Leaving upload
    if (method !== "upload") {

        const input =
            document.getElementById(
                "v-audio"
            );


        if (input) {

            input.value = "";

        }


        nivaranUploadedAudio = null;

    }


    // Leaving text
    if (method !== "text") {

        const text =
            document.getElementById(
                "report-text"
            );


        if (text) {

            text.value = "";

        }


        if (
            typeof updateCharCount ===
            "function"
        ) {

            updateCharCount();

        }

    }

}


// ============================================================
// CHANGE METHOD
// ============================================================

function changeReportMethod() {

    nivaranReportMethod = null;


    document
        .querySelectorAll(".method-card")
        .forEach(card => {

            card.classList.remove(
                "selected",
                "disabled"
            );

        });


    document
        .querySelectorAll(".method-panel")
        .forEach(panel => {

            panel.classList.remove(
                "active"
            );

        });


    document
        .getElementById(
            "change-method-btn"
        )
        .style.display =
            "none";


    clearReportError();

}


// ============================================================
// CONTINUE TO REVIEW
// ============================================================

function submitReportText() {

    clearReportError();


    if (!nivaranReportMethod) {

        showReportError(
            "Please choose one report method first."
        );

        return;

    }


    const transcript =
        document.getElementById(
            "transcript-text"
        );


    // TEXT
    if (
        nivaranReportMethod === "text"
    ) {

        const text =
            (
                document.getElementById(
                    "report-text"
                )?.value || ""
            ).trim();


        if (!text) {

            showReportError(
                "Please write your report before continuing."
            );

            return;

        }


        transcript.value = text;

    }


    // RECORD
    else if (
        nivaranReportMethod === "record"
    ) {

        if (!recordedAudioBlob) {

            showReportError(
                "Please record your voice before continuing."
            );

            return;

        }


        transcript.value =
            "[Voice recording attached. Transcript pending.]";

    }


    // UPLOAD
    else {

        const file =
            document.getElementById(
                "v-audio"
            )?.files?.[0];


        if (!file) {

            showReportError(
                "Please choose an audio file before continuing."
            );

            return;

        }


        nivaranUploadedAudio =
            file;


        transcript.value =
            "[Uploaded audio attached. Transcript pending.]";

    }


    nextScreen(5);

}


// ============================================================
// FINAL SUBMISSION
// ============================================================

async function submitFinalReport() {

    const ngoSlug =
        new URLSearchParams(
            window.location.search
        ).get("ngo");


    if (!ngoSlug) {

        alert(
            "Please open this page using the organization's unique reporting link."
        );

        return;

    }


    const button =
        document.getElementById(
            "final-submit-btn"
        );


    const statement =
        (
            document.getElementById(
                "transcript-text"
            )?.value || ""
        ).trim();


    let audioFile = null;


    // RECORDED AUDIO
    if (
        nivaranReportMethod === "record" &&
        recordedAudioBlob
    ) {

        const type =
            recordedAudioBlob.type ||
            "audio/webm";


        let extension = "webm";


        if (type.includes("ogg")) {

            extension = "ogg";

        }


        if (type.includes("mp4")) {

            extension = "mp4";

        }


        audioFile =
            new File(
                [recordedAudioBlob],
                `voice-report.${extension}`,
                {
                    type
                }
            );

    }


    // UPLOADED AUDIO
    if (
        nivaranReportMethod === "upload"
    ) {

        audioFile =
            nivaranUploadedAudio ||
            document.getElementById(
                "v-audio"
            )?.files?.[0];

    }


    if (
        nivaranReportMethod === "text" &&
        !statement
    ) {

        nextScreen(3);

        showReportError(
            "Please write your report."
        );

        return;

    }


    if (
        (
            nivaranReportMethod === "record" ||
            nivaranReportMethod === "upload"
        ) &&
        !audioFile
    ) {

        nextScreen(3);

        showReportError(
            "Please provide the audio recording."
        );

        return;

    }


    const formData =
        new FormData();


    formData.append(
        "ngoSlug",
        ngoSlug
    );


    formData.append(
        "name",
        document.getElementById(
            "v-name"
        )?.value.trim() || ""
    );


    formData.append(
        "age",
        document.getElementById(
            "v-age"
        )?.value || ""
    );


    formData.append(
        "gender",
        document.getElementById(
            "v-gender"
        )?.value.trim() || ""
    );


    formData.append(
        "phone",
        document.getElementById(
            "v-phone"
        )?.value.trim() || ""
    );


    formData.append(
        "email",
        document.getElementById(
            "v-email"
        )?.value.trim() || ""
    );


    formData.append(
        "address",
        document.getElementById(
            "v-address"
        )?.value.trim() || ""
    );


    formData.append(
        "statement",
        statement
    );


    formData.append(
        "source",
        nivaranReportMethod === "text"
            ? "text"
            : "voice"
    );


    if (audioFile) {

        formData.append(
            "audio",
            audioFile
        );

    }


    if (button) {

        button.disabled = true;

        button.textContent =
            "Submitting...";

    }


    nextScreen(7);


    try {

        const response =
            await fetch(
                `${NIVARAN_API}/cases/submit`,
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Could not submit the report."
            );

        }


        const caseId =
            data.caseId ||
            data.case?.caseId ||
            "Submitted";


        const display =
            document.getElementById(
                "case-id-display"
            );


        if (display) {

            display.textContent =
                caseId;

        }


        nextScreen(8);


    } catch (error) {

        console.error(
            "Victim submission error:",
            error
        );


        alert(
            "Report could not be submitted.\n\n" +
            error.message
        );


        nextScreen(5);


    } finally {

        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Submit Report";

        }

    }

}


// ============================================================
// RESET
// ============================================================

function resetPortal() {

    const form =
        document.getElementById(
            "victim-details-form"
        );


    if (form) {

        form.reset();

    }


    [
        "report-text",
        "transcript-text"
    ].forEach(id => {

        const element =
            document.getElementById(id);


        if (element) {

            element.value = "";

        }

    });


    const audio =
        document.getElementById(
            "v-audio"
        );


    if (audio) {

        audio.value = "";

    }


    if (
        typeof recordedAudioBlob !==
        "undefined"
    ) {

        recordedAudioBlob = null;

    }


    if (
        typeof audioChunks !==
        "undefined"
    ) {

        audioChunks = [];

    }


    if (
        typeof cleanupRecorder ===
        "function"
    ) {

        cleanupRecorder();

    }


    document
        .querySelectorAll(
            ".method-card"
        )
        .forEach(card => {

            card.classList.remove(
                "selected",
                "disabled"
            );

        });


    document
        .querySelectorAll(
            ".method-panel"
        )
        .forEach(panel => {

            panel.classList.remove(
                "active"
            );

        });


    document
        .getElementById(
            "change-method-btn"
        )
        .style.display =
            "none";


    nivaranReportMethod = null;

    nivaranUploadedAudio = null;


    const checkbox =
        document.getElementById(
            "consent-checkbox"
        );


    const consentButton =
        document.getElementById(
            "consent-btn"
        );


    if (checkbox) {

        checkbox.checked = false;

    }


    if (consentButton) {

        consentButton.disabled = true;

    }


    nextScreen(1);

}


// ============================================================
// INITIALIZE VICTIM PORTAL
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            !document.querySelector(
                ".screen"
            )
        ) {

            return;

        }


        const ngoSlug =
            new URLSearchParams(
                window.location.search
            ).get("ngo");


        // No NGO link = no reporting
        if (!ngoSlug) {

            document
                .querySelectorAll(
                    ".screen"
                )
                .forEach(screen => {

                    screen.classList.remove(
                        "active"
                    );

                    screen.style.display =
                        "none";

                });


            const screen =
                document.getElementById(
                    "screen-1"
                );


            screen.innerHTML = `
                <h1>
                    Secure support link required
                </h1>

                <p>
                    This page must be opened through
                    the reporting link provided by
                    the organization.
                </p>
            `;


            screen.classList.add(
                "active"
            );

            screen.style.display =
                "block";


            return;

        }


        // Always begin at consent
        nextScreen(1);


        // Victim details
        const detailsForm =
            document.getElementById(
                "victim-details-form"
            );


        if (detailsForm) {

            detailsForm.addEventListener(
                "submit",
                event => {

                    event.preventDefault();


                    if (
                        detailsForm.checkValidity()
                    ) {

                        nextScreen(3);

                    } else {

                        detailsForm.reportValidity();

                    }

                }
            );

        }


        // Upload automatically selects upload mode
        const uploadInput =
            document.getElementById(
                "v-audio"
            );


        if (uploadInput) {

            uploadInput.addEventListener(
                "change",
                () => {

                    if (
                        uploadInput.files.length
                    ) {

                        selectReportMethod(
                            "upload"
                        );

                    }

                }
            );

        }

    }
);