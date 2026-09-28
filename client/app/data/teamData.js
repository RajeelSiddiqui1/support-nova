/**
 * SupportNova — Team & Submission Data
 * Edit this file to update team details, links and checklist status.
 * The TeamSection component reads exclusively from this file.
 */

export const teamInfo = {
  teamName: 'NovaWear AI Ops',
  projectName: 'SupportNova',
  organization: 'NovaWear Apparel',
  event: 'Aptech TechWiz 7',
  category: 'Generative AI PowerPlay',
  theme: 'ResponseX Intelligence',
}

export const members = [
  {
    name: 'Rajeel Siddiqui',
    role: 'Full-Stack & AI Engineer',
    contribution:
      'Architected the Next.js 14 App Router frontend, dual-pipeline Groq LLM integration, role-based RBAC middleware, and real-time WebSocket ticket updates.',
    skills: ['Next.js 14', 'React', 'FastAPI', 'Groq LLM', 'Tailwind CSS'],
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=500&auto=format&fit=crop',
    github: '#',
    linkedin: '#',
  },
  {
    name: 'Syed Hamza',
    role: 'Backend & RAG Specialist',
    contribution:
      'Implemented the Qdrant Vector DB RAG search, MongoDB Atlas schema design, deterministic Python ground-truth engine, and prompt-injection defenses.',
    skills: ['Python', 'Qdrant', 'MongoDB Atlas', 'FastAPI', 'Pydantic'],
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=500&auto=format&fit=crop',
    github: '#',
    linkedin: '#',
  },
  {
    name: 'Muhammad Ali',
    role: 'DevOps & Testing Lead',
    contribution:
      'Created 39 automated unit & integration test suites, AWS S3 document attachment ingestion pipeline, and audit logging workflows for reviewer overrides.',
    skills: ['Pytest', 'AWS S3', 'Docker', 'CI/CD', 'Python'],
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=500&auto=format&fit=crop',
    github: '#',
    linkedin: '#',
  },
]

export const submissionLinks = {
  githubRepo:      '#',
  liveApp:         '#',
  demoVideo:       '#',
  technicalBlog:   '#',
  projectReport:   '#',
  aiUsage:         '#',
}

/**
 * Submission checklist.
 * Set `done: true` as each deliverable is completed.
 */
export const checklist = [
  { label: 'Source code repository (GitHub)',            done: true  },
  { label: 'Dataset / sample complaint data',           done: true  },
  { label: 'Rule matrix JSON / CSV',                    done: true  },
  { label: 'Pipeline comparison report',                done: true  },
  { label: 'Security & adversarial test report',        done: true  },
  { label: 'Demo video',                                done: false },
  { label: 'Technical blog post',                       done: false },
  { label: 'AI usage declaration',                      done: true  },
]
