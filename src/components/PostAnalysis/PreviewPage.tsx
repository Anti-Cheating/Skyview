import React from "react";
import { Link } from "react-router-dom";
import "./PreviewPage.css";

/**
 * Preview page to demonstrate different mock analysis scenarios
 * Access at: /analysis-preview
 */
export const PreviewPage: React.FC = () => {
  const scenarios = [
    {
      id: "clean",
      title: "Clean Interview ✓",
      description: "No suspicious activity detected. Excellent interview performance.",
      riskLevel: "Low",
      color: "#00c620",
      icon: "✓",
    },
    {
      id: "research",
      title: "External Research",
      description: "Candidate used Stack Overflow and LeetCode during interview.",
      riskLevel: "Medium",
      color: "#ffbb33",
      icon: "⚠",
    },
    {
      id: "moderate",
      title: "Moderate Risk",
      description: "Minor red flags including messaging app activity detected.",
      riskLevel: "High",
      color: "#ff8800",
      icon: "⚠",
    },
    {
      id: "critical",
      title: "Critical Issues",
      description: "Strong evidence of cheating: AI tools, remote access, answer platforms.",
      riskLevel: "Critical",
      color: "#ff4444",
      icon: "✗",
    },
  ];

  return (
    <div className="preview-page">
      <div className="preview-header">
        <h1>📊 Post-Analysis Preview</h1>
        <p>Click on a scenario to preview how the analysis panel looks with different data</p>
      </div>

      <div className="preview-grid">
        {scenarios.map((scenario) => (
          <Link
            key={scenario.id}
            to={`/interview/demo-session/analysis?mock=${scenario.id}`}
            className="preview-card"
            style={{ borderTopColor: scenario.color }}
          >
            <div className="preview-card-icon" style={{ color: scenario.color }}>
              {scenario.icon}
            </div>
            <h2>{scenario.title}</h2>
            <p>{scenario.description}</p>
            <div className="preview-risk" style={{ backgroundColor: scenario.color }}>
              Risk: {scenario.riskLevel}
            </div>
          </Link>
        ))}
      </div>

      <div className="preview-info">
        <h3>How to Use:</h3>
        <ul>
          <li>Click any scenario above to see the full analysis panel</li>
          <li>Mock data indicators will show at the top (purple banner)</li>
          <li>Try resizing your browser to test responsive design</li>
          <li>All interactive elements are functional with mock data</li>
        </ul>

        <h3>Mock Scenarios:</h3>
        <table className="scenarios-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Score</th>
              <th>Risk Level</th>
              <th>Key Features</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Clean</strong></td>
              <td>89/100</td>
              <td>Low</td>
              <td>No app categories, normal typing, clear speech</td>
            </tr>
            <tr>
              <td><strong>Research</strong></td>
              <td>72/100</td>
              <td>Medium</td>
              <td>StackOverflow + LeetCode detected, some suspicious keystrokes</td>
            </tr>
            <tr>
              <td><strong>Moderate</strong></td>
              <td>65/100</td>
              <td>High</td>
              <td>Discord messaging detected, 5 copy-paste events</td>
            </tr>
            <tr>
              <td><strong>Critical</strong></td>
              <td>34/100</td>
              <td>Critical</td>
              <td>AI tools, remote access, answer platforms, 68% suspicious keystrokes</td>
            </tr>
          </tbody>
        </table>

        <h3>Direct Links:</h3>
        <div className="direct-links">
          <a href="/interview/demo-session/analysis?mock=clean" className="direct-link">
            Clean Interview
          </a>
          <a href="/interview/demo-session/analysis?mock=research" className="direct-link">
            External Research
          </a>
          <a href="/interview/demo-session/analysis?mock=moderate" className="direct-link">
            Moderate Risk
          </a>
          <a href="/interview/demo-session/analysis?mock=critical" className="direct-link">
            Critical Issues
          </a>
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
