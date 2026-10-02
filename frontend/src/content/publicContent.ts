/**
 * Static public content for informational pages (Notices & FAQs).
 * All operational and business data is fetched from the real FastAPI backend.
 */

export const notices = [
  {
    id: "n1",
    date: "10 September 2026",
    tag: "Deadline",
    title: "NFST 2026-27 application window extended to 31 October 2026",
    body: "Research scholars who have submitted incomplete applications may complete their submission within the extended window.",
  },
  {
    id: "n2",
    date: "02 September 2026",
    tag: "Guideline",
    title: "Revised document checklist for National Overseas Scholarship",
    body: "Applicants must now upload the university offer letter and passport in a single verified set before scrutiny.",
  },
  {
    id: "n3",
    date: "28 August 2026",
    tag: "Verification",
    title: "Institutions advised to clear pending verification queues",
    body: "Nodal officers must complete institution verification within seven working days of assignment.",
  },
  {
    id: "n4",
    date: "19 August 2026",
    tag: "Result",
    title: "Top Class Education provisional selection list published",
    body: "Provisional list for premier institution awards is available in the applicant portal under Applications.",
  },
];

export const faqs = [
  {
    q: "Who can apply for scholarships and fellowships on this portal?",
    a: "Students and research scholars belonging to a Scheduled Tribe, holding a valid caste certificate issued by a competent authority, and enrolled in or admitted to a recognised course of study.",
  },
  {
    q: "Can I apply for more than one scheme in the same academic year?",
    a: "You may submit applications to multiple schemes, but you cannot draw benefits from two central schemes for the same course and year.",
  },
  {
    q: "What happens after I submit my application?",
    a: "Your application moves through validation, document verification, institution verification, scrutiny, selection and approval. You can follow each stage on the tracking timeline in your portal.",
  },
  {
    q: "What is a deficiency and how do I resolve it?",
    a: "A deficiency is raised when a document or detail needs correction. It appears as an Action Required card in your portal with the exact issue, the action needed and a response deadline.",
  },
  {
    q: "How do I know my documents were accepted?",
    a: "Each document card shows a verification status — pending, processing, verified or rejected — along with version history if you replaced a file.",
  },
  {
    q: "Whom do I contact if my application is delayed?",
    a: "Raise a grievance from the Grievances section of your portal. Every grievance receives a ticket number and is tracked against a response timeline.",
  },
];
