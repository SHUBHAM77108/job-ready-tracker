export const sampleRoadmap = [
  "JavaScript fundamentals and scope",
  "Data types, coercion, equality and truthy/falsy",
  "Functions, arrow functions and callbacks",
  "Closures, this, call/apply/bind",
  "Objects, destructuring and optional chaining",
  "Array methods: map, filter, reduce, find",
  "Promises and async/await",
  "Event loop and timers",
  "DOM, events and event delegation",
  "Prototypes, classes and ES modules",
  "React components, JSX and props",
  "useState and event handling",
  "Conditional rendering, lists and keys",
  "Forms and validation",
  "useEffect and API requests",
  "React Router and dynamic routes",
  "Context API and useReducer",
  "TypeScript fundamentals",
  "Tailwind CSS and responsive layouts",
  "Next.js App Router fundamentals",
  "Database CRUD project",
  "Git, GitHub and deployment",
  "Portfolio project polish",
  "Frontend interview revision",
  "AI API basics and safe environment variables",
  "Build an AI chatbot UI",
  "Embeddings and vector search",
  "RAG basics and citations",
  "Build and deploy an AI project",
  "Resume, GitHub and mock interviews"
];

export const defaultTasks = [
  { id: "concept", name: "Concept learning", description: "Study a topic and write short notes", start: "09:00", end: "10:30", flexible: false },
  { id: "practice", name: "Code practice", description: "Write code yourself before checking a solution", start: "10:45", end: "12:45", flexible: false },
  { id: "project", name: "Project work", description: "Build or improve a portfolio project", start: "14:00", end: "15:30", flexible: false },
  { id: "interview", name: "Interview preparation", description: "Answer five questions from today's topic", start: "15:45", end: "16:30", flexible: true },
  { id: "leetcode", name: "Problem solving", description: "Solve one JavaScript coding problem", start: "16:30", end: "17:15", flexible: true },
  { id: "apply", name: "Job applications", description: "Apply to relevant roles and track follow-ups", start: "18:30", end: "19:00", flexible: true }
];

export const initialState = () => ({
  schemaVersion: 2,
  settings: { startDate: new Date().toISOString().slice(0,10), durationDays: 60, remindersEnabled: false, reminderMinutes: 0, theme: "light" },
  roadmap: [],
  roadmaps: [],
  activeRoadmapId: null,
  days: {},
  projects: [],
  applications: [],
  schedules: [],
  unlockedDays: [],
  selectedScheduleId: null
});
