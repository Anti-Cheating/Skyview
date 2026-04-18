/**
 * Mock data for PostAnalysisPanel testing
 * Multiple scenarios to preview different analysis results
 */

export const MOCK_ANALYSIS_CLEAN = {
  id: "analysis-clean-001",
  session_id: "session-123",
  overall_score: 89,
  risk_level: "Low",
  keystroke_summary:
    "Normal typing pattern throughout the interview. Average keystroke speed was 145 WPM with no suspicious copy-paste activity detected. Typing rhythm remained consistent across all 10-minute windows.",
  voice_summary:
    "Clear and confident speech throughout. Candidate spoke at a natural pace of 120 WPM with minimal hesitations. Voice tone remained steady, indicating confidence in answers.",
  image_summary:
    "Interview IDE (VSCode) remained the primary focus window throughout. Only legitimate code editor windows and documentation tabs were visible. No external applications or suspicious websites detected.",
  full_transcript:
    "[0:00] Interviewer: Welcome! Let's start with a warm-up problem. Can you explain what a binary search tree is?\n[0:45] Candidate: Sure! A binary search tree is a data structure where each node has at most two children, left and right. The left subtree contains values smaller than the node, and the right subtree contains values greater than the node.\n[2:30] Interviewer: Great! Now let's code this. Can you implement a BST insert function?\n[3:15] Candidate: Absolutely. I'll write the code now...\n[8:20] Interviewer: Perfect! Your implementation looks good. Let's discuss the time complexity.\n[9:15] Candidate: The insert operation has O(log n) average time complexity in a balanced BST, but O(n) in the worst case if the tree becomes skewed.",
  keystroke_breakdown: {
    normal: 96,
    suspicious: 2,
    auto_complete: 2,
  },
  risk_score: 11,
  final_summary:
    "Candidate demonstrated excellent interview performance with consistent behavior throughout. No red flags detected. Strong technical knowledge, clear communication, and legitimate problem-solving approach. Highly recommended.",
  detected_app_categories: [],
  created_at: new Date().toISOString(),
};

export const MOCK_ANALYSIS_RESEARCH = {
  id: "analysis-research-001",
  session_id: "session-124",
  overall_score: 72,
  risk_level: "Medium",
  keystroke_summary:
    "Typing pattern shows normal activity with occasional pauses for research. 8 copy-paste events detected from external sources. Average keystroke speed was 138 WPM. Research activity occurred primarily during algorithm design phase.",
  voice_summary:
    "Speech was generally clear with some hesitations during complex algorithm discussion. Candidate asked clarifying questions and referenced external materials. Pace was 115 WPM with some stuttering noted.",
  image_summary:
    "VSCode IDE was primary window with multiple Stack Overflow and LeetCode tabs open during the interview. Candidate referenced external documentation and code examples while solving problems.",
  full_transcript:
    "[0:00] Interviewer: Let's solve a medium-level graph problem.\n[2:15] Candidate: I need to think about the best approach. Let me check some references...\n[5:45] Candidate: Okay, I think I should use BFS with a queue for this problem.\n[7:30] Interviewer: Good, go ahead and code it.\n[12:20] Candidate: Done! Let me trace through with an example.",
  keystroke_breakdown: {
    normal: 85,
    suspicious: 12,
    auto_complete: 3,
  },
  risk_score: 55,
  final_summary:
    "Candidate used external resources during the interview, which is concerning for proctored assessments. While technical solutions were correct, reliance on external references suggests weaker foundational knowledge. Recommend further evaluation.",
  detected_app_categories: [
    {
      categoryId: "code_resources",
      categoryLabel: "Code Reference & Learning",
      riskLevel: "MEDIUM",
      riskScore: 45,
      apps: ["StackOverflow", "LeetCode"],
    },
    {
      categoryId: "search_engines",
      categoryLabel: "Search Engines",
      riskLevel: "MEDIUM",
      riskScore: 40,
      apps: ["Google Search"],
    },
  ],
  created_at: new Date().toISOString(),
};

export const MOCK_ANALYSIS_CRITICAL = {
  id: "analysis-critical-001",
  session_id: "session-125",
  overall_score: 34,
  risk_level: "Critical",
  keystroke_summary:
    "Suspicious typing patterns detected including 23 copy-paste events in rapid succession. Keystroke speed varied dramatically (50-180 WPM), suggesting non-typing input methods. Multiple rapid clipboard operations detected.",
  voice_summary:
    "Audio detected but minimal speaking. Long silences with activity suggesting candidate was reading or listening to external audio. Voice pattern inconsistent with genuine problem-solving discussion.",
  image_summary:
    "Multiple suspicious windows detected including screen sharing utilities and remote desktop applications. External chat windows and answer platforms visible. Frequent window switching between coding and messaging apps.",
  full_transcript:
    "[0:00] Interviewer: Start coding the solution.\n[0:30] Candidate: (silence)\n[2:45] Candidate: Yeah, I'm thinking about it.\n[5:15] (long silence)\n[8:30] Candidate: Got it, pasting the solution.",
  keystroke_breakdown: {
    normal: 25,
    suspicious: 68,
    auto_complete: 7,
  },
  risk_score: 89,
  final_summary:
    "CRITICAL: Significant evidence of academic dishonesty detected. Multiple suspicious behaviors including potential screen sharing with external parties, use of copy-paste from answer platforms, and lack of genuine engagement. Recommend disqualification.",
  detected_app_categories: [
    {
      categoryId: "ai_tools",
      categoryLabel: "AI Tools & Assistants",
      riskLevel: "CRITICAL",
      riskScore: 90,
      apps: ["ChatGPT", "GitHub Copilot"],
    },
    {
      categoryId: "messaging",
      categoryLabel: "Messaging & Communication",
      riskLevel: "MEDIUM",
      riskScore: 50,
      apps: ["Discord", "Slack"],
    },
    {
      categoryId: "remote_access",
      categoryLabel: "Remote Access & Screen Sharing",
      riskLevel: "CRITICAL",
      riskScore: 95,
      apps: ["TeamViewer", "Chrome Remote Desktop"],
    },
    {
      categoryId: "education_platforms",
      categoryLabel: "Education & Answer Platforms",
      riskLevel: "CRITICAL",
      riskScore: 85,
      apps: ["Chegg", "Brainly"],
    },
  ],
  created_at: new Date().toISOString(),
};

export const MOCK_ANALYSIS_MODERATE = {
  id: "analysis-moderate-001",
  session_id: "session-126",
  overall_score: 65,
  risk_level: "High",
  keystroke_summary:
    "Mostly normal typing with 5 copy-paste events detected. Keystroke speed averaged 142 WPM. Some unusual pauses during algorithm explanation suggest possible external reference checking.",
  voice_summary:
    "Clear speech with confident tone. Candidate explained thinking process well. Minor hesitations noted when discussing edge cases. Overall good communication skills.",
  image_summary:
    "Primary coding window with secondary browser window showing chat application. Chat application was minimized most of the time but showed brief periods of activity.",
  full_transcript:
    "[0:00] Interviewer: Let's build a system to handle concurrent requests.\n[2:30] Candidate: I'll use a queue-based approach with worker threads.\n[5:45] Candidate: Let me code this solution.\n[10:15] Interviewer: Good implementation. How would you handle timeout scenarios?\n[12:00] Candidate: We could implement exponential backoff retry logic.",
  keystroke_breakdown: {
    normal: 88,
    suspicious: 8,
    auto_complete: 4,
  },
  risk_score: 70,
  final_summary:
    "Candidate showed good technical skills with some minor concerning behaviors. Communication was clear and solutions were mostly correct. Minor red flags regarding potential external communication during interview. Recommend interview with closer monitoring.",
  detected_app_categories: [
    {
      categoryId: "messaging",
      categoryLabel: "Messaging & Communication",
      riskLevel: "MEDIUM",
      riskScore: 50,
      apps: ["Discord"],
    },
  ],
  created_at: new Date().toISOString(),
};

export const MOCK_ANALYSIS_SCENARIOS = {
  clean: MOCK_ANALYSIS_CLEAN,
  research: MOCK_ANALYSIS_RESEARCH,
  critical: MOCK_ANALYSIS_CRITICAL,
  moderate: MOCK_ANALYSIS_MODERATE,
};

export type MockScenario = keyof typeof MOCK_ANALYSIS_SCENARIOS;
