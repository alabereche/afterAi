import React from 'react';

interface MarkdownViewProps {
  content: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  if (!content) return null;

  // Filter out developer noise, terminal commands, and raw file URIs
  let cleaned = content
    .replace(/file:\/\/\/[^\s\)]+/g, '')
    .replace(/```(?:bash|sh|cmd|powershell)?\s*npx remotion studio\s*```/gi, '')
    .replace(/```(?:bash|sh|cmd|powershell)?\s*```/gi, '')
    .trim();

  // Split into lines
  const lines = cleaned.split('\n');

  const renderedElements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (keyPrefix: number) => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul
          key={`list-${keyPrefix}`}
          style={{
            margin: '8px 0',
            paddingRight: '18px',
            paddingLeft: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          {currentList.map((item, idx) => (
            <li
              key={idx}
              style={{
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: '#d4d4d8',
              }}
            >
              {parseInlineStyles(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Check for Heading 1, 2, 3 (#, ##, ###)
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList(index);
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      renderedElements.push(
        <div
          key={`h-${index}`}
          style={{
            fontSize: level === 1 ? '15px' : level === 2 ? '14px' : '13px',
            fontWeight: 700,
            color: '#f4f4f5',
            marginTop: index > 0 ? '12px' : '4px',
            marginBottom: '6px',
            letterSpacing: '-0.01em',
          }}
        >
          {parseInlineStyles(text)}
        </div>
      );
      return;
    }

    // Check for List item (- or *)
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      currentList.push(listMatch[1]);
      return;
    }

    // Normal paragraph line
    flushList(index);
    if (trimmed.length > 0) {
      renderedElements.push(
        <p
          key={`p-${index}`}
          style={{
            margin: '6px 0',
            fontSize: '12.5px',
            lineHeight: 1.65,
            color: '#e4e4e7',
          }}
        >
          {parseInlineStyles(trimmed)}
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{renderedElements}</div>;
};

// Helper: parse **bold**, `code`, etc. into proper React elements without raw asterisks
function parseInlineStyles(text: string): React.ReactNode[] {
  // Regex to match **bold** and `code`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2] !== undefined) {
      // Bold **text**
      parts.push(
        <strong key={match.index} style={{ fontWeight: 700, color: '#ffffff' }}>
          {match[2]}
        </strong>
      );
    } else if (match[3] !== undefined) {
      // Inline `code`
      parts.push(
        <code
          key={match.index}
          style={{
            fontSize: '11.5px',
            padding: '2px 5px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#fb923c',
            fontFamily: 'monospace',
          }}
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
