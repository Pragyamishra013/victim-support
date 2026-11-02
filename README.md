# NIVARAN — AI-Powered Victim Support & Case Triage

**Turning reports into structured insights and a pathway to support.**

NIVARAN is an AI-assisted victim-support and case-management platform designed to help NGOs and support organizations review incident reports, understand key case details, and identify cases that may require timely human attention.

The platform aims to make reporting more accessible through multimedia submissions while helping support teams organize information and manage cases through a centralized dashboard.

> **Our vision:** Reporting should be the first step toward support, not the end of the process.

## Table of Contents

- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Key Features](#-key-features)
- [How It Works](#-how-it-works)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Current Status](#-current-status)
- [Future Enhancements](#-future-enhancements)
- [Responsible AI and Privacy](#-responsible-ai-and-privacy)
- [Team](#-team)
- [Contributing](#-contributing)
- [License](#-license)

## 🚨 Problem Statement

Victims and complainants may struggle to communicate distressing experiences, while organizations supporting them can face challenges such as:

- Reviewing lengthy text and audio reports manually.
- Extracting important information from unstructured submissions.
- Organizing evidence and managing multiple cases.
- Identifying reports that may require urgent human attention.
- Connecting individuals with appropriate support resources.

NIVARAN explores how AI-assisted analysis and centralized case management can help address these challenges.

## 💡 Our Solution

NIVARAN combines a secure reporting interface, AI-assisted report processing, database-backed case management, and an NGO-facing dashboard.

It is designed to help transform submitted information into structured summaries and actionable review material, while keeping human reviewers involved in important support decisions.

## ✨ Key Features

### 1. Multimedia Reporting
- Submit reports through supported text, audio, and video formats.
- Record audio or video through the reporting interface where supported.
- Provide a more flexible reporting experience for users.

### 2. AI-Assisted Report Analysis
- Transcribe supported audio recordings using Whisper.
- Generate report summaries using an AI-powered workflow.
- Extract relevant case details to support the review process.

### 3. Centralized NGO Dashboard
- Access and review submitted cases.
- View available report information and supporting media.
- Organize and track cases through a centralized interface.

### 4. Case Triage — Development Goal
- Explore structured case categorization.
- Highlight potential vulnerability indicators and safety concerns.
- Assist human reviewers in identifying cases that may require timely attention.

### 5. Emotion-Aware Analysis — Planned Enhancement
- Explore voice-based indicators associated with possible distress.
- Explore facial-expression analysis from supported video inputs.
- Present model-generated observations as supplementary information for human review.

**Note:** Emotion AI integration is an area of planned development unless explicitly implemented in the current version. Emotional cues cannot establish a person's true emotional state or prove whether a report is genuine.

## 🔄 How It Works

1. **Report Submission:** A user submits a report through the available reporting interface.
2. **Media Processing:** Supported audio is processed for transcription; submitted information is prepared for analysis.
3. **AI-Assisted Analysis:** The AI workflow generates a summary and extracts relevant details.
4. **Database Management:** Case information and associated data are stored in MongoDB according to the implemented workflow.
5. **NGO Review:** Authorized reviewers access available case information through the dashboard.
6. **Support and Follow-Up:** The platform aims to support case tracking and connections with relevant support resources.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML, CSS, JavaScript / Frontend framework | User interface |
| Node.js | Backend runtime |
| Express.js | Backend server and API routes |
| MongoDB | Case and application data storage |
| Groq API | AI-powered report processing |
| Whisper Large V3 | Speech-to-text transcription |
| MediaRecorder API | Browser-based audio/video recording where supported |
| Git & GitHub | Version control and collaboration |
| Vercel / Deployment platform | Deployment, where configured |































