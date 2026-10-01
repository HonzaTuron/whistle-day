/**
 * Legal and compliance pages: Privacy policy, Terms of service, and User deletion path.
 *
 * These pages state plainly how Whistle.day handles data, what the service
 * provides, and how any user or visitor can delete their information.
 *
 * Written in plain language without unnecessary legalese, in keeping with
 * the rest of the site: what is collected, why, where it lives, and how to
 * erase it.
 */

import type { Page } from "./types";

export const LEGAL_PAGES: Page[] = [
  {
    slug: "privacy",
    kind: "legal",
    title: "Privacy Policy — How Whistle.day Handles Your Data",
    h1: "Privacy policy",
    description:
      "How Whistle.day handles personal data: anonymous device accounts, no tracking cookies, no ads, and how to delete your data.",
    lede:
      "Whistle.day is built to run tournaments, not collect personal data. Most tournaments are created with anonymous device accounts, we use no tracking cookies or ads, and you can delete your data at any time.",
    sections: [
      {
        heading: "The short version",
        body: [
          "You do not need to register, verify an email, or install an app to create and run a tournament.",
          "We use local storage on your device to keep your draft and session. We do not use third-party tracking cookies or advertising networks.",
          "If you choose to claim your account with an email address or through Google or Facebook, we store only what is needed to let you log in again.",
          "You can delete your account and all tournaments you have created at any time.",
        ],
      },
      {
        heading: "What information we collect",
        body: [
          "Device accounts: When you start setting up a tournament, the system creates an anonymous account with a randomly generated identifier stored solely in your browser's local storage. No name, email, or physical location is collected.",
          "Claimed accounts: If you choose to keep your tournament accessible across multiple devices, you may associate an email address and password, or sign in via Google or Facebook OAuth. We store your email address and an encrypted password hash, or the unique identifier returned by the identity provider.",
          "Tournament data: Tournament names, dates, sports, court names, team names, match schedules, scores, and set points entered by organizers and referees.",
          "Access tokens: Each tournament uses cryptographically random tokens in URLs to control access — one token for the projector display, another for mobile referee scoring, and one for public results.",
        ],
      },
      {
        heading: "How we use your information",
        body: [
          "We use the information strictly to operate Whistle.day: computing brackets, updating group standings, synchronizing live scores with venue projector displays, and enabling referees to submit scores.",
          "We do not sell, rent, or monetize your personal information or tournament records. We do not profile users or serve behavioral advertisements.",
        ],
      },
      {
        heading: "Cookies and local storage",
        body: [
          "Whistle.day does not use third-party tracking cookies or analytics trackers.",
          "We use browser local storage (localStorage and sessionStorage) to maintain your login session, remember the active tournament on your device, and preserve your chosen display language.",
        ],
      },
      {
        heading: "Third-party services",
        body: [
          "Authentication: If you choose to log in with Google or Facebook, authentication is handled directly by the provider. We receive only your verified email address and basic profile identifier to authenticate you.",
          "Transactional email: If you claim an account or request a password reset, transactional emails are sent through an SMTP relay. We do not send marketing emails or newsletters.",
        ],
      },
      {
        heading: "Data retention and automated cleanup",
        body: [
          "Draft tournaments that were never drawn, have no fixtures, and are owned by an unclaimed device account are automatically purged by our daily maintenance sweep after 30 days.",
          "Real tournaments that were drawn or published remain available until deleted by the organizer.",
        ],
      },
      {
        heading: "Your rights under GDPR and privacy laws",
        body: [
          "Under the General Data Protection Regulation (GDPR) and other applicable privacy laws, you have the right to access, rectify, port, and erase your personal data.",
          "You can exercise your right to erasure at any time through our user deletion path, directly on your Account screen, or by contacting us.",
        ],
      },
      {
        heading: "Contact",
        body: [
          "If you have questions about this privacy policy or wish to submit a data protection request, you can reach the maintainers at info@whistle.day.",
        ],
      },
    ],
    faq: [
      {
        q: "Do players or spectators need an account to view results?",
        a: "No. Anyone with the public results link or QR code can view the live draw and scores without creating an account or providing any personal details.",
      },
      {
        q: "Do referees need an account?",
        a: "No. A referee scans the court QR code provided by the organizer, enters their first name or role, and scores directly from their browser without registration.",
      },
      {
        q: "Can I delete my data?",
        a: "Yes. You can delete your account and all associated tournaments at any time from your Account screen, or follow the steps on our user deletion page.",
      },
    ],
    related: ["terms", "user-deletion"],
  },

  {
    slug: "terms",
    kind: "legal",
    title: "Terms of Service — Using Whistle.day",
    h1: "Terms of service",
    description:
      "The terms of service for using Whistle.day to organise tournaments, generate brackets, and display live scores.",
    lede:
      "Whistle.day is a free tournament organisation platform. These terms set out what you can expect from the service, and the rules that govern your use of it.",
    sections: [
      {
        heading: "Acceptance of terms",
        body: [
          "By accessing Whistle.day, creating a tournament, using the projector display, scoring a fixture, or creating an account, you agree to be bound by these Terms of Service. If you do not agree, you should not use the service.",
        ],
      },
      {
        heading: "The service",
        body: [
          "Whistle.day provides tools to generate tournament schedules, calculate group tables, manage knockout brackets, coordinate multiple courts, and display live standings on projectors and mobile devices.",
          "The software is provided free of charge. We strive to maintain continuous availability and reliable calculations, but services may occasionally be updated, modified, or temporarily unavailable for maintenance.",
        ],
      },
      {
        heading: "Permitted use",
        body: [
          "You may use Whistle.day for lawful amateur, school, club, and professional sporting and gaming competitions.",
          "You agree not to enter names or content that is unlawful, defamatory, harassing, hateful, or infringing on the intellectual property of others.",
          "You agree not to attempt to disrupt, overload, probe, or compromise the stability and security of Whistle.day servers, APIs, or networks.",
        ],
      },
      {
        heading: "Access tokens and responsibility",
        body: [
          "Whistle.day uses URL tokens for screen displays, mobile results, and staff invitations. Anyone who possesses a token has the access rights granted by that token.",
          "You are responsible for safeguarding your account credentials and for managing whom you share invitation and display links with.",
        ],
      },
      {
        heading: "Intellectual property",
        body: [
          "You retain all rights to the tournament names, team rosters, and competition data that you submit to Whistle.day.",
        ],
      },
      {
        heading: "Disclaimer of warranties",
        body: [
          "Whistle.day is provided on an 'as is' and 'as available' basis without warranties of any kind, whether express or implied. We do not warrant that the service will be uninterrupted, bug-free, or entirely error-free.",
          "While the application includes offline data queues and transaction safeguards, organizers should ensure critical competition records are backed up or printed when appropriate.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the maximum extent permitted by law, Whistle.day and its maintainers shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of or inability to use the service.",
        ],
      },
      {
        heading: "Termination",
        body: [
          "You may terminate your agreement with Whistle.day at any time by deleting your account and tournaments.",
          "We reserve the right to suspend access or remove content that violates these terms or poses a security risk to other users.",
        ],
      },
    ],
    faq: [
      {
        q: "Can I use Whistle.day for commercial or paid tournaments?",
        a: "Yes. Whistle.day can be used for community, charity, corporate, and commercial sporting events.",
      },
      {
        q: "Who owns my tournament data?",
        a: "You do. You retain full ownership of your tournament information, team lists, and match results.",
      },
      {
        q: "What happens if our venue loses internet connection?",
        a: "Whistle.day includes an offline queue on mobile scoring devices. Match results entered while offline are saved locally and synchronized automatically once connection is restored.",
      },
    ],
    related: ["privacy", "user-deletion"],
  },

  {
    slug: "user-deletion",
    kind: "legal",
    title: "User Deletion Path — How to Delete Your Account and Data",
    h1: "User deletion path",
    description:
      "How to delete your Whistle.day account, tournaments, and all associated personal data.",
    lede:
      "You have complete control over your data on Whistle.day. Whether you used an anonymous device account or a claimed login, here is how to permanently delete your account and all associated records.",
    sections: [
      {
        heading: "In-app account deletion",
        body: [
          "The fastest way to delete your data is directly inside the application.",
          "Step 1: Navigate to the Account screen at whistle.day/account.",
          "Step 2: If you are not already signed in, log in with your email address or through Google or Facebook.",
          "Step 3: At the bottom of the Account screen, click 'Delete account'.",
          "Step 4: Confirm the deletion prompt. Your account and every tournament you created will be permanently removed immediately.",
        ],
      },
      {
        heading: "What gets deleted",
        body: [
          "Deleting your account is permanent and cannot be undone. It immediately deletes:",
          "Your user account record, email address, password hash, and social login associations.",
          "All tournaments you created and own.",
          "All stages, pools, courts, team entries, fixtures, set scores, and historical edits belonging to those tournaments.",
          "All active projector screen tokens, referee join codes, and public results links for your events.",
          "Your local session tokens on the device.",
        ],
      },
      {
        heading: "Anonymous device accounts",
        body: [
          "If you used Whistle.day without ever claiming an account or providing an email address, your session credentials exist solely in your browser's local storage.",
          "Clearing your browser's site data or local storage immediately erases this device's ability to access the tournament.",
          "Any unclaimed draft tournaments with no fixtures left behind are automatically purged by our daily maintenance sweep after 30 days.",
        ],
      },
      {
        heading: "Revoking Facebook or Google login",
        body: [
          "If you authenticated with Facebook: Go to Facebook Settings & Privacy > Settings > Apps and Websites, find Whistle.day, and click Remove. You can also view your data deletion status through Facebook's App settings.",
          "If you authenticated with Google: Go to your Google Account > Security > Third-party apps with account access, select Whistle.day, and click Remove Access.",
          "Note: Revoking access in Google or Facebook stops future sign-ins. To delete existing tournament data already stored on Whistle.day, please use the in-app delete button or submit a manual deletion request.",
        ],
      },
      {
        heading: "Manual deletion request by email",
        body: [
          "If you are unable to access your account or need assistance deleting your data, you can submit a manual deletion request.",
          "Send an email to info@whistle.day with the subject 'Data Deletion Request' from the email address registered to your account.",
          "Our team will verify your identity, permanently delete your account and all associated data within 48 hours, and email you confirmation.",
        ],
      },
    ],
    faq: [
      {
        q: "Can a deleted tournament be restored?",
        a: "No. Deletion is instantaneous and permanent. All database records and tokens associated with the tournament are erased.",
      },
      {
        q: "Does deleting my account remove me from crew lists on other tournaments?",
        a: "Yes. Any referee or scorer assignments linked to your account on tournaments run by other organizers will be removed, while the match scores you entered remain intact.",
      },
      {
        q: "Is there any fee or delay for data deletion?",
        a: "No. In-app deletion is instant and free of charge. Email requests are completed within 48 hours at no cost.",
      },
    ],
    related: ["privacy", "terms"],
  },

  {
    slug: "contact",
    kind: "legal",
    title: "Contact and Support — Whistle.day",
    h1: "Contact",
    description:
      "How to reach Whistle.day for help with a tournament, the MCP server or the ChatGPT plugin, a bug report, or a privacy request.",
    lede:
      "There is one address for everything: [info@whistle.day](mailto:info@whistle.day). Write to it for help with a tournament, a bug, a question about the MCP server or the ChatGPT plugin, or a request about your data.",
    sections: [
      {
        heading: "Support",
        body: [
          "Email [info@whistle.day](mailto:info@whistle.day). Every message is read by the people who build the product.",
          "If something is wrong with a tournament, include its link (the address of the tournament or projector page) and what you expected to happen. If it is happening right now, in a hall, say so in the subject line.",
        ],
      },
      {
        heading: "Agents, the MCP server and the ChatGPT plugin",
        body: [
          "Questions and problems with connecting Claude, ChatGPT or another client go to the same address. Tell us which client you used and, if you can, the tool call that failed and the message it returned.",
          "How the server works and how to connect to it is described on the [MCP page](/mcp).",
        ],
      },
      {
        heading: "Privacy and data requests",
        body: [
          "To access, correct or delete your data, write from the email address registered to your account. You can also delete your account yourself at any time: see the [user deletion path](/user-deletion).",
        ],
      },
    ],
    faq: [
      {
        q: "Is there a phone number or a chat?",
        a: "No. Email is the only channel.",
      },
      {
        q: "Where do I report a security problem?",
        a: "The same address, info@whistle.day, with 'Security' in the subject line. Please give us a chance to fix it before publishing details.",
      },
    ],
    related: ["privacy", "terms", "user-deletion"],
  },
];
