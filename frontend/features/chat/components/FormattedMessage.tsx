'use client';

import React from 'react';

/**
 * Strips all emojis, emoticons, and pictographs client-side as a safety net.
 */
export function removeEmojis(text: string): string {
  if (!text) return text;
  return text
    .replace(new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D\\u20E3]|[\\uD83C\\uDDE6-\\uD83C\\uDDFF]', 'gu'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Parses inline formatting like **bold**, *italic*, `code`, and [links](url).
 */
function renderInlineContent(text: string, isMine: boolean): React.ReactNode[] {
  // Regex to match: **bold**, *italic*, `code`, [link](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const content = part.slice(2, -2);
      return (
        <strong
          key={index}
          className={`font-semibold ${isMine ? 'text-white font-bold' : 'text-slate-900'}`}
        >
          {content}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <em key={index} className="italic">
          {content}
        </em>
      );
    }

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const content = part.slice(1, -1);
      return (
        <code
          key={index}
          className={`rounded px-1.5 py-0.5 text-xs font-mono ${
            isMine ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800'
          }`}
        >
          {content}
        </code>
      );
    }

    // Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline hover:opacity-80 ${isMine ? 'text-white' : 'text-teal-600'}`}
        >
          {label}
        </a>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

interface FormattedMessageProps {
  content: string;
  isMine?: boolean;
}

/**
 * Clean, modern markdown message formatter for AI chat.
 * Converts markdown lists, headings, paragraphs, and bold text into semantic React elements,
 * eliminating raw markdown characters and removing emojis.
 */
export function FormattedMessage({ content, isMine = false }: FormattedMessageProps) {
  const sanitizedContent = removeEmojis(content);

  // If traveler message, render straightforwardly while preserving newlines
  if (isMine) {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
        {sanitizedContent}
      </div>
    );
  }

  // Split content into lines to detect blocks
  const rawLines = sanitizedContent.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];

  let currentOrderedList: { index: number; text: string }[] = [];
  let currentUnorderedList: string[] = [];
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join('\n').trim();
      if (pText) {
        blocks.push(
          <p key={`p-${blocks.length}`} className="my-1.5 leading-relaxed text-slate-800">
            {renderInlineContent(pText, isMine)}
          </p>,
        );
      }
      currentParagraphLines = [];
    }
  };

  const flushOrderedList = () => {
    if (currentOrderedList.length > 0) {
      const listItems = [...currentOrderedList];
      blocks.push(
        <ol
          key={`ol-${blocks.length}`}
          className="my-2 space-y-2 list-decimal pl-5 text-slate-800 leading-relaxed"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInlineContent(item.text, isMine)}
            </li>
          ))}
        </ol>,
      );
      currentOrderedList = [];
    }
  };

  const flushUnorderedList = () => {
    if (currentUnorderedList.length > 0) {
      const listItems = [...currentUnorderedList];
      blocks.push(
        <ul
          key={`ul-${blocks.length}`}
          className="my-2 space-y-1.5 list-disc pl-5 text-slate-800 leading-relaxed"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-1">
              {renderInlineContent(item, isMine)}
            </li>
          ))}
        </ul>,
      );
      currentUnorderedList = [];
    }
  };

  const flushAllLists = () => {
    flushOrderedList();
    flushUnorderedList();
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? '';
    const trimmed = line.trim();

    // Empty line separates blocks
    if (!trimmed) {
      flushParagraph();
      flushAllLists();
      continue;
    }

    // Heading: ### Heading or ## Heading or # Heading
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushAllLists();
      const level = headingMatch[1]!.length;
      const headingText = headingMatch[2]!;
      if (level === 1 || level === 2) {
        blocks.push(
          <h4
            key={`h-${blocks.length}`}
            className="mt-3 mb-1.5 font-bold text-slate-900 text-base"
          >
            {renderInlineContent(headingText, isMine)}
          </h4>,
        );
      } else {
        blocks.push(
          <h5
            key={`h-${blocks.length}`}
            className="mt-2.5 mb-1 font-semibold text-slate-900 text-sm"
          >
            {renderInlineContent(headingText, isMine)}
          </h5>,
        );
      }
      continue;
    }

    // Ordered list: 1. Text or 1) Text
    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      flushUnorderedList();
      currentOrderedList.push({
        index: parseInt(orderedMatch[1]!, 10),
        text: orderedMatch[2]!,
      });
      continue;
    }

    // Unordered list: - Text or * Text or + Text
    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      flushOrderedList();
      currentUnorderedList.push(unorderedMatch[1]!);
      continue;
    }

    // Normal text line
    if (currentOrderedList.length > 0 || currentUnorderedList.length > 0) {
      flushAllLists();
    }
    currentParagraphLines.push(trimmed);
  }

  flushParagraph();
  flushAllLists();

  return (
    <div className="space-y-1 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {blocks}
    </div>
  );
}
